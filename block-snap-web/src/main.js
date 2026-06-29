import { api, isSuccess, getMessage, SCENES } from './api.js';
import {
  isLoggedIn, saveSessionFromLogin, getUsername, saveVerifyToken, clearAuth, clearVerifyToken,
  hasVerifyToken, hasBoundContact, setHasBoundContact, markPendingBoundContact,
  isPhone, isEmail, isAccount, restoreSessionFromStorage,
} from './auth.js';
import {
  CATEGORY_META, CHANGE_TYPE, RISK_LEVEL,
  INSTANCES, MODPACKS, PLATFORM_UPDATES,
  formatMs, formatDuration, pct,
  getInstance, getModpack, getLatestSnapshot,
  getInstanceAssetSummary, getPendingUpdateCount,
  getSortedInstances, toggleInstanceFavorite, setInstanceNote, setAssetNote,
  computeSnapshotDiff, getSeverityClass, getRiskClass,
} from './mock-data.js';

// ── State ──
let toastTimer = null;
let currentPage = 'instances';
let activeInstanceId = INSTANCES[0]?.id || null;
let activeSnapshotIds = {}; // { instanceId: [snapIdA, snapIdB] } for diff
let postLoginRedirect = null; // 'my-data' | null
/** 'demo' = 本地 Mock；'live' = 登录后走后端 /svc-instance/list */
let appMode = 'demo';
let liveInstances = [];
let instancesLoading = false;
let instancesLoadError = null;
/** live 实例详情：instanceId → 模组资产列表（已映射为表格行结构） */
let liveModsByInstanceId = {};
let liveModsLoading = false;
let liveModsLoadingId = null;
let liveModsError = null;
/** 我的账户：GET /sys-user/getAccount 首条记录 */
let accountProfile = null;
let accountProfileLoading = false;
let accountProfileError = null;
let verifySectionWarnTimer = null;

// ── Utils ──
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function getFormData(form) {
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v.trim(); });
  return data;
}

function startCooldown(btn, sec = 60) {
  let r = sec;
  btn.disabled = true;
  const originalText = btn.dataset.originalText || btn.textContent;
  btn.dataset.originalText = originalText;
  btn.textContent = `${r}s`;
  const t = setInterval(() => {
    r -= 1;
    if (r <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = originalText; }
    else btn.textContent = `${r}s`;
  }, 1000);
}

// ── Real-time input validation ──
function setupInputValidation(root = document) {
  root.querySelectorAll('[data-validate]').forEach((input) => {
    const handler = () => {
      const form = input.closest('form');
      const validateType = input.dataset.validate;
      const value = input.value.trim();

      let section;
      if (validateType === 'phone') {
        section = form?.querySelector('[data-code-section="phone"]')
          || form?.querySelector('[data-code-section="account"]');
      } else if (validateType === 'email') {
        section = form?.querySelector('[data-code-section="email"]')
          || form?.querySelector('[data-code-section="account"]');
      } else if (validateType === 'account') {
        section = form?.querySelector('[data-code-section="account"]');
      }

      if (!section) return;

      const formatOk = (validateType === 'phone' && isPhone(value))
        || (validateType === 'email' && isEmail(value))
        || (validateType === 'account' && isAccount(value));

      // Keep section visible if code already entered or send button in cooldown
      const codeInput = section.querySelector('[data-code-input]');
      const sendBtn = section.querySelector('.code-btn');
      const hasCode = codeInput && codeInput.value.trim() !== '';
      const isSending = sendBtn && sendBtn.disabled;

      if (formatOk || hasCode || isSending) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
        // Also clear the code when collapsing
        if (codeInput) codeInput.value = '';
      }
    };
    input.removeEventListener('input', input._validateHandler);
    input._validateHandler = handler;
    input.addEventListener('input', handler);
    handler();
  });
}

function buildRegisterPayload(data) {
  if (data.password !== data.confirmPassword) {
    throw new Error('两次输入的密码不一致');
  }
  const payload = {
    username: data.username,
    password: data.password,
    confirmPassword: data.confirmPassword,
  };
  if (data.phone) {
    if (!isPhone(data.phone)) throw new Error('手机号格式不正确');
    if (!data.phoneVerificationCode) throw new Error('请填写手机验证码');
    payload.phone = data.phone;
    payload.phoneVerificationCode = data.phoneVerificationCode;
  }
  if (data.email) {
    if (!isEmail(data.email)) throw new Error('邮箱格式不正确');
    if (!data.emailVerificationCode) throw new Error('请填写邮箱验证码');
    payload.email = data.email;
    payload.emailVerificationCode = data.emailVerificationCode;
  }
  return payload;
}

function validateForgotPayload(data) {
  if (!isAccount(data.account)) throw new Error('请输入正确的手机或邮箱');
  if (!data.verificationCode) throw new Error('请填写验证码');
  if (!data.resetPassword) throw new Error('请填写新密码');
  if (data.resetPassword !== data.confirmResetPassword) throw new Error('两次输入的新密码不一致');
  return data;
}

function validatePasswordPayload(data) {
  if (!hasAnyBoundContact(accountProfile)) {
    throw new Error('请先绑定手机或邮箱');
  }
  if (!isAccountSecurityVerified(accountProfile)) {
    throw new Error('请先在账户页完成安全验证后再修改密码');
  }
  if (!data.oldPassword) throw new Error('请填写原密码');
  if (!data.newPassword) throw new Error('请填写新密码');
  if (data.newPassword !== data.confirmNewPassword) throw new Error('两次输入的新密码不一致');
  return data;
}

function validateBindPayload(data, bindHint) {
  const hint = bindHint || document.getElementById('account-action-modal')?.dataset.bindHint || '';
  if (hint === 'phone') {
    if (!isPhone(data.account)) throw new Error('请输入正确的手机号');
  } else if (hint === 'email') {
    if (!isEmail(data.account)) throw new Error('请输入正确的邮箱');
  } else if (!isAccount(data.account)) {
    throw new Error('请输入正确的手机或邮箱');
  }
  if (!data.verificationCode) throw new Error('请填写验证码');
  if (needsSecurityVerifyForBind(hint) && !isAccountSecurityVerified(accountProfile)) {
    throw new Error('换绑前请先完成安全验证');
  }
  return data;
}

function validateVerifyPayload(data) {
  if (!isAccount(data.account)) throw new Error('请输入已绑定的手机或邮箱');
  if (!data.verificationCode) throw new Error('请填写验证码');
  return data;
}

function resetLiveSession() {
  appMode = 'demo';
  liveInstances = [];
  liveModsByInstanceId = {};
  liveModsError = null;
  instancesLoadError = null;
  accountProfile = null;
  accountProfileLoading = false;
  accountProfileError = null;
}

function formatAccountStatus(status) {
  if (status === 1) return { text: '正常', badge: 'account-badge-ok' };
  if (status === 0) return { text: '已停用', badge: 'account-badge-danger' };
  return { text: '未知', badge: 'account-badge-muted' };
}

function formatAccountField(value, emptyLabel = '未绑定') {
  const v = value == null ? '' : String(value).trim();
  return v ? escapeHtml(v) : `<span class="account-empty">${emptyLabel}</span>`;
}

async function loadAccountProfile() {
  if (!isLoggedIn()) {
    accountProfile = null;
    accountProfileError = null;
    return;
  }
  accountProfileLoading = true;
  accountProfileError = null;
  try {
    const r = await api.getAccount({ verify: hasVerifyToken() });
    if (isSuccess(r) && Array.isArray(r.data) && r.data.length > 0) {
      accountProfile = r.data[0];
      cacheAccountContacts(accountProfile);
      if (accountProfile.phone || accountProfile.email) {
        setHasBoundContact(true);
      }
      if (hasVerifyToken() && hasAnyBoundContact(accountProfile) && !isAccountSecurityVerified(accountProfile)) {
        clearVerifyToken();
      }
    } else {
      accountProfile = null;
      accountProfileError = getMessage(r);
    }
  } catch {
    accountProfile = null;
    accountProfileError = '网络错误，请稍后重试';
  } finally {
    accountProfileLoading = false;
  }
}

async function refreshSettingsPage() {
  await loadAccountProfile();
  if (currentPage === 'settings') {
    renderPage();
  }
}

// ── Screens ──
function showScreen(name) {
  ['landing', 'app', 'report'].forEach((s) => {
    document.getElementById(`screen-${s}`)?.classList.toggle('hidden', s !== name);
  });
}

function enterApp() {
  showScreen('app');
  updateAccountButton();
  navigateTo('instances');
}

function enterLanding() {
  showScreen('landing');
  updateAccountButton();
}

function goHome() {
  postLoginRedirect = null;
  enterLanding();
}

function enterDemoData() {
  postLoginRedirect = null;
  appMode = 'demo';
  updateAppModeBadge();
  enterApp();
}

async function enterMyData() {
  postLoginRedirect = null;
  appMode = 'live';
  updateAppModeBadge();
  const ok = await loadLiveInstances();
  enterApp();
  if (!ok && instancesLoadError) showToast(instancesLoadError, 'error');
}

async function loadLiveInstances() {
  instancesLoading = true;
  instancesLoadError = null;
  try {
    const r = await api.listInstances();
    if (!isSuccess(r)) {
      instancesLoadError = getMessage(r);
      liveInstances = [];
      return false;
    }
    liveInstances = (r.data || []).map(mapInstanceDtoToCard);
    return true;
  } catch {
    instancesLoadError = '网络错误，请确认网关已启动';
    liveInstances = [];
    return false;
  } finally {
    instancesLoading = false;
  }
}

/** 将后端 InstanceVO 转为卡片渲染用的统一结构（字段名与 VO 一致） */
function mapInstanceDtoToCard(dto) {
  return {
    id: String(dto.id ?? ''),
    name: dto.name || '未命名实例',
    favorite: dto.favorite ?? 0,
    note: dto.note || '',
    updateCount: dto.updateCount ?? 0,
    mcVersion: dto.mcVersion || '—',
    isNewVersion: dto.isNewVersion === 1,
    loaderType: formatLoaderLabel(dto.loaderType),
    loaderVersion: dto.loaderVersion || '',
    javaVersion: dto.javaVersion || '—',
    modCount: dto.modCount ?? 0,
    resourceCount: dto.resourceCount ?? 0,
    shaderCount: dto.shaderCount ?? 0,
    modpackName: dto.modpackName,
    modpackVersion: dto.modpackVersion,
    modpackPlatform: formatPlatformLabel(dto.modpackPlatform),
    totalLoadMs: dto.totalLoadMs ?? 0,
    lastLaunch: dto.lastLaunch ? String(dto.lastLaunch).replace('T', ' ') : null,
    _live: true,
  };
}

const LOADER_LABELS = { 1: 'Fabric', 2: 'Forge', 3: 'NeoForge', 4: 'Quilt' };
const PLATFORM_LABELS = { 1: 'MODRINTH', 2: 'CURSEFORGE', 3: 'FTB', 4: 'TECHNIC' };

function formatLoaderLabel(value) {
  if (value == null || value === '') return '—';
  const key = Number(value);
  if (!Number.isNaN(key) && LOADER_LABELS[key]) return LOADER_LABELS[key];
  return String(value);
}

function formatPlatformLabel(value) {
  if (value == null || value === '') return '';
  const key = Number(value);
  if (!Number.isNaN(key) && PLATFORM_LABELS[key]) return PLATFORM_LABELS[key];
  return String(value).toUpperCase();
}

function updateAppModeBadge() {
  const badge = document.getElementById('app-mode-badge');
  if (!badge) return;
  if (appMode === 'live') {
    badge.textContent = '我的数据';
    badge.classList.add('live-badge');
  } else {
    badge.textContent = '演示数据';
    badge.classList.remove('live-badge');
  }
}

function getInstancesForCards() {
  if (appMode === 'live') {
    return [...liveInstances].sort((a, b) => {
      const favA = a.favorite === 1;
      const favB = b.favorite === 1;
      if (favA !== favB) return favA ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });
  }
  return getSortedInstances().map((inst) => {
    const summary = getInstanceAssetSummary(inst);
    const mp = getModpack(inst.boundModpackId);
    return {
      id: inst.id,
      name: inst.name,
      favorite: inst.favorited ? 1 : 0,
      note: inst.note || '',
      updateCount: getPendingUpdateCount(inst.id),
      mcVersion: inst.minecraftVersion,
      isNewVersion: false,
      loaderType: inst.loaderType,
      loaderVersion: inst.loaderVersion,
      javaVersion: inst.javaVersion,
      modCount: summary?.modCount || 0,
      resourceCount: summary?.rpCount || 0,
      shaderCount: summary?.spCount || 0,
      modpackName: mp?.name,
      modpackVersion: mp?.version,
      modpackPlatform: mp?.sourcePlatform || '',
      totalLoadMs: summary?.totalMs || 0,
      lastLaunch: summary?.lastLaunch,
      _live: false,
    };
  });
}

function toggleLiveInstanceFavorite(id) {
  const inst = liveInstances.find((i) => i.id === String(id));
  if (!inst) return false;
  inst.favorite = inst.favorite === 1 ? 0 : 1;
  return inst.favorite === 1;
}

function setLiveInstanceNote(id, note) {
  const inst = liveInstances.find((i) => i.id === String(id));
  if (!inst) return;
  inst.note = (note || '').trim();
}

/** 将后端 ModVo 转为资产表行；id = mod_snapshot.id，收藏/备注 API 的 modId 同此字段 */
function mapModVoToAsset(dto) {
  const addedTime = dto.addedTime ? String(dto.addedTime).replace('T', ' ') : null;
  const updateTime = dto.updateTime ? String(dto.updateTime).replace('T', ' ') : null;
  return {
    id: String(dto.id ?? ''),
    name: dto.name || '—',
    version: dto.version || '—',
    isNewVersion: dto.isNewVersion,
    isDeleted: dto.isDeleted ?? 0,
    loadTimeMs: dto.loadTime ?? null,
    favorite: dto.favorite ?? 0,
    favorited: (dto.favorite ?? 0) === 1,
    note: dto.note || '',
    addedTime,
    updateTime,
  };
}

function findLiveMod(instanceId, modId) {
  return (liveModsByInstanceId[String(instanceId)] || []).find((m) => m.id === String(modId));
}

async function loadLiveMods(instanceId) {
  const id = String(instanceId);
  liveModsLoading = true;
  liveModsLoadingId = id;
  liveModsError = null;
  try {
    const r = await api.listMods(Number(instanceId));
    if (!isSuccess(r)) {
      liveModsError = getMessage(r);
      liveModsByInstanceId[id] = [];
      return false;
    }
    liveModsByInstanceId[id] = (r.data || []).map(mapModVoToAsset);
    return true;
  } catch {
    liveModsError = '网络错误，请确认网关已启动';
    liveModsByInstanceId[id] = [];
    return false;
  } finally {
    liveModsLoading = false;
    liveModsLoadingId = null;
  }
}

async function openLiveInstanceDetail(instanceId) {
  activeInstanceId = String(instanceId);
  navigateTo('instance-detail', { id: activeInstanceId });
  await loadLiveMods(activeInstanceId);
  if (currentPage === 'instance-detail' && String(activeInstanceId) === String(instanceId)) {
    renderPage({ id: activeInstanceId });
  }
}

function requestMyData() {
  if (isLoggedIn()) enterMyData();
  else {
    postLoginRedirect = 'my-data';
    openAuthModal('login');
  }
}

const DEMO_NAMES = [
  'Steve', 'Alex', 'Spark', 'Notch', 'Herobrine', 'Dream', 'Technoblade',
  'Jeb', 'Dinnerbone', 'Grumm', 'CaptainSparklez', 'Grian', 'Ph1LzA',
];

function getDemoDisplayName() {
  const key = 'demoDisplayName';
  let name = sessionStorage.getItem(key);
  if (!name) {
    name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)];
    sessionStorage.setItem(key, name);
  }
  return name;
}

function updateAccountButton() {
  const loggedIn = isLoggedIn();
  const name = loggedIn ? (getUsername() || '用户') : getDemoDisplayName();
  const welcomeText = `欢迎回来，${name}`;

  const appBtn = document.getElementById('btn-account');
  if (appBtn) appBtn.textContent = welcomeText;

  const landingBtn = document.getElementById('btn-landing-account');
  const landingAuth = document.querySelector('.landing-auth-btns');
  if (landingBtn) {
    landingBtn.textContent = welcomeText;
    landingBtn.classList.toggle('hidden', !loggedIn);
  }
  landingAuth?.classList.toggle('hidden', loggedIn);
}

// ── Navigation ──
const PAGE_TITLES = {
  instances: '我的实例',
  sites: '实用网站',
  timeline: '变更时间线',
  updates: '版本更新',
  news: 'MC新闻',
  minigame: '小游戏',
  settings: '我的账户',
  'instance-detail': '实例详情',
};

let backPage = null; // for instance-detail back button

function navigateTo(page, data) {
  currentPage = page;
  document.getElementById('page-title').textContent =
    PAGE_TITLES[page]?.replace('{name}', data?.name || '') || page;

  document.querySelectorAll('.nav-item').forEach((n) => {
    n.classList.toggle('active', n.dataset.page === page
      || (page === 'instance-detail' && n.dataset.page === 'instances'));
  });

  const backBtn = document.getElementById('btn-back-instance');
  if (page === 'instance-detail') {
    backBtn.style.display = '';
  } else {
    backBtn.style.display = 'none';
  }

  document.querySelector('.app-main')?.classList.toggle('app-main-centered', page === 'instances');
  document.querySelector('.app-main')?.classList.toggle('app-main-detail', page === 'instance-detail');

  if (page === 'settings' && isLoggedIn()) {
    accountProfileLoading = true;
    renderPage(data);
    loadAccountProfile().then(() => {
      if (currentPage === 'settings') renderPage(data);
    });
    return;
  }

  renderPage(data);
}

function renderPage(data) {
  const el = document.getElementById('content-area');
  switch (currentPage) {
    case 'instances':       el.innerHTML = renderInstances(); break;
    case 'instance-detail': el.innerHTML = renderInstanceDetail(data?.id || activeInstanceId); break;
    case 'sites':           el.innerHTML = renderUsefulSites(); break;
    case 'timeline':        el.innerHTML = renderTimeline(); break;
    case 'updates':         el.innerHTML = renderUpdateFeed(); break;
    case 'news':            el.innerHTML = renderPlaceholder('MC新闻', '聚合 Minecraft 生态新闻资讯，敬请期待。'); break;
    case 'minigame':        el.innerHTML = renderPlaceholder('小游戏', '内置像素风小游戏，休息一下。'); break;
    case 'settings':        el.innerHTML = renderSettings(); break;
  }
  bindPageEvents();
  requestAnimationFrame(() => {
    layoutAssetTables();
    requestAnimationFrame(layoutAssetTables);
  });
}

// ============================================================
// Page: 我的实例
// ============================================================
function renderInstanceCard(inst) {
  const hasNote = !!(inst.note && inst.note.trim());
  const favorited = inst.favorite === 1;
  const mpLabel = inst.modpackName
    ? `${escapeHtml(inst.modpackName)}${inst.modpackVersion ? ` v${escapeHtml(inst.modpackVersion)}` : ''}`
    : '无绑定整合包';
  const loaderLabel = [inst.loaderType, inst.loaderVersion].filter((v) => v && v !== '—').join(' ');

  return `
      <article class="instance-card${favorited ? ' instance-card-fav' : ''}" data-instance="${inst.id}" data-live="${inst._live ? '1' : '0'}">
        <button type="button" class="inst-fav-btn${favorited ? ' fav-active' : ''}" data-inst-fav="${inst.id}" aria-label="${favorited ? '取消收藏' : '收藏实例'}" title="${favorited ? '取消收藏' : '收藏'}">${favorited ? '★' : '☆'}</button>

        <div class="instance-card-head">
          <h3 class="instance-card-title">${escapeHtml(inst.name)}</h3>
          ${inst.updateCount > 0 ? `<span class="inst-badge badge-update">${inst.updateCount} 项更新</span>` : ''}
          ${inst.isNewVersion ? '<span class="inst-badge badge-new">有新版本</span>' : ''}
        </div>

        <div class="instance-tags">
          <span class="inst-tag">${escapeHtml(inst.mcVersion)}</span>
          <span class="inst-tag">${escapeHtml(loaderLabel || '—')}</span>
          <span class="inst-tag">Java ${escapeHtml(inst.javaVersion)}</span>
        </div>

        <div class="instance-card-stats" aria-label="资产数量">
          <div class="inst-stat">
            <span class="inst-stat-num">${inst.modCount}</span>
            <span class="inst-stat-label">模组</span>
          </div>
          <div class="inst-stat-divider" aria-hidden="true"></div>
          <div class="inst-stat">
            <span class="inst-stat-num">${inst.resourceCount}</span>
            <span class="inst-stat-label">资源包</span>
          </div>
          <div class="inst-stat-divider" aria-hidden="true"></div>
          <div class="inst-stat">
            <span class="inst-stat-num">${inst.shaderCount}</span>
            <span class="inst-stat-label">光影</span>
          </div>
        </div>

        <div class="instance-card-modpack">
          <span class="inst-mp-icon" aria-hidden="true">📦</span>
          <span class="inst-mp-name">${mpLabel}</span>
          ${inst.modpackPlatform ? `<span class="inst-mp-platform">${escapeHtml(inst.modpackPlatform)}</span>` : ''}
        </div>

        <div class="instance-card-note${hasNote ? '' : ' hidden'}" data-no-nav>
          <span class="inst-note-icon" aria-hidden="true">✎</span>
          <input id="note-${inst.id}" type="text" class="inst-note-input" data-inst-note="${inst.id}" value="${escapeHtml(inst.note || '')}" placeholder="为这个实例添加备注…" maxlength="120" autocomplete="off">
        </div>

        <footer class="instance-card-foot">
          <span class="inst-foot-item">🕐 ${inst.lastLaunch ? inst.lastLaunch.slice(5, 16) : '暂无启动记录'}</span>
          <span class="inst-foot-item">⏱️ ${formatDuration(inst.totalLoadMs || 0)}</span>
          ${hasNote ? '' : `<button type="button" class="inst-note-add" data-note-add="${inst.id}" data-no-nav>✎ 添加备注</button>`}
          <span class="inst-foot-hint">点击进入详情 →</span>
        </footer>
      </article>`;
}

function renderInstances() {
  backPage = null;

  let list = [];
  let bodyHtml;

  if (appMode === 'live' && instancesLoading) {
    bodyHtml = '<p class="empty-state">正在加载你的实例…</p>';
  } else {
    list = getInstancesForCards();
    if (list.length > 0) {
      bodyHtml = `<div class="instances-grid">${list.map(renderInstanceCard).join('')}</div>`;
    } else if (appMode === 'live' && instancesLoadError) {
      bodyHtml = `
        <p class="empty-state">暂无实例</p>
        <div class="instances-state">
          <p>${escapeHtml(instancesLoadError)}</p>
          <button type="button" class="btn btn-primary btn-sm" data-reload-instances>重新加载</button>
        </div>`;
    } else {
      bodyHtml = '<p class="empty-state">暂无实例</p>';
    }
  }

  return `
    <div class="instances-page">
      ${bodyHtml}
    </div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// Page: 实例详情
// ============================================================
function renderLiveModsPanel(instanceId) {
  const id = String(instanceId);
  if (liveModsLoading && liveModsLoadingId === id) {
    return '<p class="empty-state">正在加载模组列表…</p>';
  }
  if (liveModsError && liveModsByInstanceId[id] !== undefined && !liveModsByInstanceId[id]?.length) {
    return `
      <div class="instances-state">
        <p class="empty-state">${escapeHtml(liveModsError)}</p>
        <button type="button" class="btn btn-primary btn-sm" data-reload-mods="${id}">重新加载</button>
      </div>`;
  }
  const mods = liveModsByInstanceId[id];
  if (mods === undefined) {
    return '<p class="empty-state">正在加载模组列表…</p>';
  }
  if (!mods.length) {
    return '<p class="empty-hint">暂无模组</p>';
  }
  return renderAssetTable('mods', mods, { id, _live: true });
}

function renderLiveInstanceDetail(inst) {
  const loaderLabel = [inst.loaderType, inst.loaderVersion].filter((v) => v && v !== '—').join(' ');
  const mpLabel = inst.modpackName
    ? `${escapeHtml(inst.modpackName)}${inst.modpackVersion ? ` v${escapeHtml(inst.modpackVersion)}` : ''}`
    : '无绑定整合包';

  return `
    <div class="detail-page" data-instance="${inst.id}" data-live="1">

      <div class="detail-hero">
        <div class="detail-hero-left">
          <h2>${escapeHtml(inst.name)}</h2>
          <div class="instance-tags">
            <span class="inst-tag">${escapeHtml(inst.mcVersion)}</span>
            <span class="inst-tag">${escapeHtml(loaderLabel || '—')}</span>
            <span class="inst-tag">Java ${escapeHtml(inst.javaVersion)}</span>
          </div>
          <p class="inst-mp">📦 ${mpLabel}${inst.lastLaunch ? `<span class="inst-mp-sep">·</span>最近启动 ${inst.lastLaunch.slice(0, 16)}` : ''}</p>
        </div>
      </div>

      <div class="detail-tabs-bar">
        <button class="dtab active" data-asset-tab="mods">🧩 模组</button>
        <button class="dtab" data-asset-tab="resourcePacks">🪵 资源包</button>
        <button class="dtab" data-asset-tab="shaderPacks">☄️ 光影包</button>
        <button class="dtab" data-asset-tab="configs">📜 配置文件</button>
      </div>

      <div class="detail-asset-panels">
        <div class="asset-panel active" data-asset-panel="mods">
          ${renderLiveModsPanel(inst.id)}
        </div>
        <div class="asset-panel" data-asset-panel="resourcePacks">
          <div class="placeholder-page" style="min-height:30vh">
            <div class="placeholder-content">
              <span class="placeholder-icon">🪵</span>
              <h2>资源包</h2>
              <p>云端资源包列表开发中，敬请期待。</p>
              <span class="wip-badge">开发中</span>
            </div>
          </div>
        </div>
        <div class="asset-panel" data-asset-panel="shaderPacks">
          <div class="placeholder-page" style="min-height:30vh">
            <div class="placeholder-content">
              <span class="placeholder-icon">☄️</span>
              <h2>光影包</h2>
              <p>云端光影包列表开发中，敬请期待。</p>
              <span class="wip-badge">开发中</span>
            </div>
          </div>
        </div>
        <div class="asset-panel" data-asset-panel="configs">
          <div class="placeholder-page" style="min-height:30vh">
            <div class="placeholder-content">
              <span class="placeholder-icon">📜</span>
              <h2>配置文件</h2>
              <p>配置文件列表开发中，敬请期待。</p>
              <span class="wip-badge">开发中</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderInstanceDetail(instanceId) {
  if (appMode === 'live') {
    const liveInst = liveInstances.find((i) => i.id === String(instanceId));
    if (!liveInst) return '<p class="empty-state">实例不存在</p>';
    backPage = 'instances';
    return renderLiveInstanceDetail(liveInst);
  }

  const inst = getInstance(instanceId);
  if (!inst) return '<p class="empty-state">实例不存在</p>';

  backPage = 'instances';
  const mp = getModpack(inst.boundModpackId);
  const latest = getLatestSnapshot(inst);

  return `
    <div class="detail-page" data-instance="${inst.id}">

      <!-- 实例信息头 -->
      <div class="detail-hero">
        <div class="detail-hero-left">
          <h2>${escapeHtml(inst.name)}</h2>
          <div class="instance-tags">
            <span class="inst-tag">${inst.minecraftVersion}</span>
            <span class="inst-tag">${inst.loaderType} ${inst.loaderVersion}</span>
            <span class="inst-tag">Java ${inst.javaVersion}</span>
            <span class="inst-tag">${inst.ramAllocated}</span>
          </div>
          <p class="inst-mp">📦 ${mp ? `${escapeHtml(mp.name)} v${mp.version}` : '无绑定整合包'}<span class="inst-mp-sep">·</span>创建于 ${inst.createdAt}</p>
        </div>
        <div class="detail-hero-right">
          <button class="btn btn-soft btn-sm" data-action="view-diff">查看最新变更</button>
          <select class="snapshot-picker" data-snapshot-picker>
            ${inst.snapshots.map((s, i) => `
              <option value="${s.id}" ${i === 0 ? 'selected' : ''}>
                ${s.timestamp.slice(0, 16)} · ${formatDuration(s.totalMs)}
              </option>`).join('')}
          </select>
        </div>
      </div>

      <!-- 资产分类 Tab -->
      <div class="detail-tabs-bar">
        <button class="dtab active" data-asset-tab="mods">🧩 模组</button>
        <button class="dtab" data-asset-tab="resourcePacks">🪵 资源包</button>
        <button class="dtab" data-asset-tab="shaderPacks">☄️ 光影包</button>
        <button class="dtab" data-asset-tab="configs">📜 配置文件</button>
      </div>

      <!-- 资产列表区 -->
      <div class="detail-asset-panels">
        <div class="asset-panel active" data-asset-panel="mods">
          ${renderAssetTable('mods', latest.assets.mods, inst)}
        </div>
        <div class="asset-panel" data-asset-panel="resourcePacks">
          ${renderAssetTable('resourcePacks', latest.assets.resourcePacks, inst)}
        </div>
        <div class="asset-panel" data-asset-panel="shaderPacks">
          ${renderAssetTable('shaderPacks', latest.assets.shaderPacks, inst)}
        </div>
        <div class="asset-panel" data-asset-panel="configs">
          <div class="placeholder-page" style="min-height:30vh">
            <div class="placeholder-content">
              <span class="placeholder-icon">📜</span>
              <h2>配置文件</h2>
              <p>配置文件列表与版本对比功能开发中，敬请期待。</p>
              <span class="wip-badge">开发中</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function formatDateShort(dt) {
  if (!dt) return '—';
  return dt.length >= 10 ? dt.slice(0, 10) : dt;
}

function renderAssetNoteCell(a, category, instance, readonly = false, noteCol = 5) {
  const key = escapeHtml(a.id || a.relativePath || '');
  const note = a.note?.trim() || '';
  if (readonly) {
    return `<div class="asset-core-col asset-col-note" data-col="${noteCol}"><span class="asset-note-readonly">${note ? escapeHtml(note) : '—'}</span></div>`;
  }
  return `
    <div class="asset-core-col asset-col-note" data-col="${noteCol}" data-no-nav>
      <input type="text" class="asset-note-input${note ? ' has-value' : ''}"
        data-asset-note="${key}" data-asset-cat="${category}" data-asset-inst="${instance.id}"
        value="${escapeHtml(note)}" placeholder="添加备注…" maxlength="120" autocomplete="off">
    </div>`;
}

function renderAssetFavCell(a, category, instance, deleted = false, favCol = 6) {
  if (deleted) {
    return `<div class="asset-core-col asset-col-fav" data-col="${favCol}"></div>`;
  }
  const favId = escapeHtml(a.id || a.relativePath || '');
  return `
    <div class="asset-core-col asset-col-fav" data-col="${favCol}">
      <button type="button" class="asset-fav-btn${a.favorited ? ' fav-active' : ''}"
        data-fav="${favId}" data-fav-cat="${category}" data-fav-inst="${instance.id}"
        aria-label="${a.favorited ? '取消收藏' : '收藏'}">${a.favorited ? '★' : '☆'}</button>
    </div>`;
}

function renderAssetVerCell(a) {
  const versionText = a?.version ? String(a.version) : '—';

  let isLatest;
  if (a.isNewVersion === 1) {
    isLatest = true;
  } else if (a.isNewVersion === 2) {
    isLatest = false;
  } else {
    const hasNewByCompare = Boolean(a.latestVersion && a.latestVersion !== a.version);
    if (typeof a?.IsNewVersion === 'boolean') {
      if (a.latestVersion != null) {
        if (hasNewByCompare === a.IsNewVersion) isLatest = !a.IsNewVersion;
        else if (hasNewByCompare === !a.IsNewVersion) isLatest = a.IsNewVersion;
        else isLatest = !a.IsNewVersion;
      } else {
        isLatest = !a.IsNewVersion;
      }
    } else {
      isLatest = !hasNewByCompare;
    }
  }

  const tooltipText = isLatest ? '已最新' : '可更新';
  return `
    <span class="ver-cell${isLatest ? ' ver-latest' : ' ver-update'}" tabindex="0" role="group" aria-label="版本状态">
      <span class="mono ver-text">${escapeHtml(versionText)}</span>
      <span class="ver-tooltip">${tooltipText}</span>
    </span>`;
}

function layoutAssetTable(wrap) {
  const headCore = wrap.querySelector('.asset-table-head .asset-row-core');
  if (!headCore) return;

  const row = headCore.parentElement;
  const cols = [...headCore.querySelectorAll('[data-col]')];
  const colCount = cols.length;
  if (!colCount) return;

  const favBtn = wrap.querySelector('.asset-col-fav .asset-fav-btn');
  const favW = favBtn ? Math.ceil(favBtn.getBoundingClientRect().width) : 30;

  const widths = cols.map((col) => {
    const i = col.dataset.col;
    if (col.classList.contains('asset-col-fav')) return favW;
    let max = 0;
    wrap.querySelectorAll(`[data-col="${i}"]`).forEach((cell) => {
      cell.style.width = 'auto';
      max = Math.max(max, cell.scrollWidth);
    });
    return Math.ceil(max);
  });

  const noteIdx = cols.findIndex((c) => c.classList.contains('asset-col-note'));
  if (noteIdx >= 0) widths[noteIdx] = Math.max(widths[noteIdx], 140);

  const sum = widths.reduce((a, b) => a + b, 0);
  const rowWidth = row?.clientWidth ?? headCore.clientWidth;
  // 行宽扣除各列内容后均分为 (列数+1) 段：左留白、列间（含备注→收藏）、收藏右留白，三段等宽
  const gap = Math.max(0, Math.floor((rowWidth - sum) / (colCount + 1)));

  wrap.style.setProperty('--asset-grid-cols', widths.map((w) => `${w}px`).join(' '));
  wrap.style.setProperty('--asset-grid-gap', `${gap}px`);
}

function layoutAssetTables() {
  document.querySelectorAll('.asset-table-wrap').forEach((wrap) => {
    const panel = wrap.closest('.asset-panel');
    if (panel && !panel.classList.contains('active')) return;
    layoutAssetTable(wrap);
  });
}

function renderAssetTable(category, assets, instance) {
  const active = assets.filter((a) => !a.isDeleted);
  const deleted = assets.filter((a) => a.isDeleted);

  if (!active.length && !deleted.length) {
    return '<p class="empty-hint">暂无数据</p>';
  }

  const isMod = category === 'mods';

  const noteCol = isMod ? 5 : 4;
  const favCol = isMod ? 6 : 5;

  const headCoreCols = isMod
    ? `
        <div class="asset-core-col" data-col="0"><span class="asset-head-label">名称</span></div>
        <div class="asset-core-col" data-col="1"><span class="asset-head-label">当前版本</span></div>
        <div class="asset-core-col" data-col="2"><span class="asset-head-label">加载耗时</span></div>
        <div class="asset-core-col asset-col-created" data-col="3"><span class="asset-head-label">首次检测时间</span></div>
        <div class="asset-core-col" data-col="4"><span class="asset-head-label">最新更改时间</span></div>
        <div class="asset-core-col asset-col-note" data-col="5"><span class="asset-head-label">备注</span></div>
        <div class="asset-core-col asset-col-fav" data-col="6"><span class="sr-only">收藏</span></div>`
    : `
        <div class="asset-core-col" data-col="0"><span class="asset-head-label">名称</span></div>
        <div class="asset-core-col" data-col="1"><span class="asset-head-label">当前版本</span></div>
        <div class="asset-core-col asset-col-created" data-col="2"><span class="asset-head-label">首次检测时间</span></div>
        <div class="asset-core-col" data-col="3"><span class="asset-head-label">最新更改时间</span></div>
        <div class="asset-core-col asset-col-note" data-col="4"><span class="asset-head-label">备注</span></div>
        <div class="asset-core-col asset-col-fav" data-col="5"><span class="sr-only">收藏</span></div>`;

  const activeRows = active.map((a) => `
    <div class="asset-row">
      <div class="asset-row-core">
        <div class="asset-core-col asset-col-name" data-col="0"><span class="asset-name-text">${escapeHtml(a.name || a.relativePath)}</span></div>
        <div class="asset-core-col asset-col-ver" data-col="1">${renderAssetVerCell(a)}</div>
        ${isMod ? `<div class="asset-core-col asset-col-load mono" data-col="2">${a.loadTimeMs ? formatMs(a.loadTimeMs) : '—'}</div>` : ''}
        <div class="asset-core-col asset-col-time asset-col-created mono" data-col="${isMod ? 3 : 2}">${formatDateShort(a.addedTime)}</div>
        <div class="asset-core-col asset-col-time mono" data-col="${isMod ? 4 : 3}">${formatDateShort(a.updateTime)}</div>
        ${renderAssetNoteCell(a, category, instance, false, noteCol)}
        ${renderAssetFavCell(a, category, instance, false, favCol)}
      </div>
    </div>`).join('');

  const deletedRows = deleted.length ? `
    <div class="asset-section-row">已移除 · ${deleted.length}</div>
    ${deleted.map((a) => `
      <div class="asset-row row-deleted">
        <div class="asset-row-core">
          <div class="asset-core-col asset-col-name" data-col="0"><span class="asset-name-text">${escapeHtml(a.name || a.relativePath)}</span></div>
          <div class="asset-core-col asset-col-ver mono muted" data-col="1">${escapeHtml(a.version || '—')}</div>
          ${isMod ? '<div class="asset-core-col asset-col-load muted" data-col="2">—</div>' : ''}
          <div class="asset-core-col asset-col-time asset-col-created mono muted" data-col="${isMod ? 3 : 2}">${formatDateShort(a.addedTime)}</div>
          <div class="asset-core-col asset-col-time mono muted" data-col="${isMod ? 4 : 3}">${formatDateShort(a.updateTime)}</div>
          ${renderAssetNoteCell(a, category, instance, true, noteCol)}
          ${renderAssetFavCell(a, category, instance, true, favCol)}
        </div>
      </div>`).join('')}` : '';

  return `
    <div class="asset-table-wrap">
      <div class="asset-table${isMod ? '' : ' asset-table-no-load'}">
        <div class="asset-row asset-table-head">
          <div class="asset-row-core">${headCoreCols}</div>
        </div>
        <div class="asset-table-body">${activeRows}${deletedRows}</div>
      </div>
      <p class="asset-table-foot">${active.length} 项活跃${deleted.length ? ` · ${deleted.length} 项已移除` : ''}</p>
    </div>`;
}

// ── Format datetime (年月日 时分秒) ──
function formatDateTime(dt) {
  if (!dt) return '-';
  if (dt.includes(' ')) return dt;
  return dt + ' 00:00:00';
}

function renderPlaceholder(title, desc) {
  return `
    <div class="placeholder-page">
      <div class="placeholder-content">
        <span class="placeholder-icon">🚧</span>
        <h2>${title}</h2>
        <p>${desc}</p>
        <span class="wip-badge">开发中</span>
      </div>
    </div>`;
}

// ============================================================
// Page: 变更时间线
// ============================================================
function renderTimeline() {
  backPage = null;

  // Pick an instance for timeline
  const instanceOptions = INSTANCES.map((inst, i) =>
    `<option value="${inst.id}" ${inst.id === activeInstanceId ? 'selected' : ''}>${inst.name}</option>`
  ).join('');

  const inst = getInstance(activeInstanceId);
  if (!inst || inst.snapshots.length < 2) {
    return `
      <div class="timeline-page">
        <div class="timeline-header">
          <p class="page-desc">选择实例，对比任意两次启动之间的资产变更。</p>
          <select class="snapshot-picker wide" data-timeline-instance>
            ${instanceOptions}
          </select>
        </div>
        ${inst ? '<p class="empty-hint">该实例仅有 1 次快照，需要至少 2 次启动才能生成变更对比。</p>'
               : '<p class="empty-state">暂无实例数据</p>'}
      </div>`;
  }

  const snapshots = inst.snapshots;
  // Default: compare latest (snapshots[0]) with previous (snapshots[1])
  const pair = activeSnapshotIds[activeInstanceId] || [snapshots[0].id, snapshots[1].id];
  const older = snapshots.find((s) => s.id === pair[1]) || snapshots[1];
  const newer = snapshots.find((s) => s.id === pair[0]) || snapshots[0];
  const diff = computeSnapshotDiff(older, newer);

  return `
    <div class="timeline-page" data-instance="${inst.id}">
      <div class="timeline-header">
        <p class="page-desc">选择实例，对比任意两次启动之间的五类资产变更。</p>
        <select class="snapshot-picker wide" data-timeline-instance>
          ${instanceOptions}
        </select>
      </div>

      <!-- 快照选择器 -->
      <div class="diff-selector">
        <div class="diff-select-col">
          <label>较新快照</label>
          <select class="snapshot-picker" data-diff-pick="newer">
            ${snapshots.map((s, i) => `
              <option value="${s.id}" ${s.id === newer.id ? 'selected' : ''}>
                ${s.timestamp.slice(0, 16)} · ${formatDuration(s.totalMs)}
              </option>`).join('')}
          </select>
        </div>
        <span class="diff-arrow">vs</span>
        <div class="diff-select-col">
          <label>较早快照</label>
          <select class="snapshot-picker" data-diff-pick="older">
            ${snapshots.map((s, i) => `
              <option value="${s.id}" ${s.id === older.id ? 'selected' : ''}>
                ${s.timestamp.slice(0, 16)} · ${formatDuration(s.totalMs)}
              </option>`).join('')}
          </select>
        </div>
      </div>

      <!-- 变更摘要 -->
      <div class="diff-summary">
        ${Object.entries(diff).length === 0
          ? '<p class="empty-hint">✅ 两次快照之间无资产变更</p>'
          : Object.entries(diff).map(([cat, changes]) => {
              const meta = CATEGORY_META[cat === 'mods' ? 'mod' : cat === 'resourcePacks' ? 'resource' : cat === 'shaderPacks' ? 'shader' : 'config'];
              const adds = changes.filter((c) => c.type === 'ADD').length;
              const rems = changes.filter((c) => c.type === 'REMOVE').length;
              const upds = changes.filter((c) => c.type === 'UPDATE').length;
              return `
                <div class="diff-cat-card">
                  <div class="diff-cat-head">
                    <span>${meta?.icon || '📦'} ${meta?.label || cat}</span>
                    <span class="diff-cat-counts">
                      ${adds > 0 ? `<span class="diff-count add">+${adds}</span>` : ''}
                      ${rems > 0 ? `<span class="diff-count remove">-${rems}</span>` : ''}
                      ${upds > 0 ? `<span class="diff-count update">~${upds}</span>` : ''}
                    </span>
                  </div>
                  <div class="diff-items">
                    ${changes.map(renderDiffItem).join('')}
                  </div>
                </div>`;
            }).join('')}
      </div>
    </div>`;
}

function renderDiffItem(change) {
  const { type, asset, oldAsset, category } = change;
  const typeInfo = CHANGE_TYPE[type];

  if (type === 'ADD') {
    return `
      <div class="diff-item ${typeInfo.cls}">
        <span class="diff-type">${typeInfo.icon} ${typeInfo.label}</span>
        <strong>${asset.name || asset.relativePath}</strong>
        <span class="mono">${asset.version || ''}</span>
      </div>`;
  }
  if (type === 'REMOVE') {
    return `
      <div class="diff-item ${typeInfo.cls}">
        <span class="diff-type">${typeInfo.icon} ${typeInfo.label}</span>
        <strong>${asset.name || asset.relativePath}</strong>
        <span class="mono muted">${asset.version || ''}</span>
      </div>`;
  }
  if (type === 'UPDATE') {
    if (category === 'configs') {
      return `
        <div class="diff-item ${typeInfo.cls}">
          <span class="diff-type">${typeInfo.icon} ${typeInfo.label}</span>
          <code>${asset.relativePath}</code>
          <span class="mono muted">文件内容变更</span>
        </div>`;
    }
    return `
      <div class="diff-item ${typeInfo.cls}">
        <span class="diff-type">${typeInfo.icon} ${typeInfo.label}</span>
        <strong>${asset.name}</strong>
        <span class="mono"><span class="diff-old-ver">${change.oldVersion}</span> → <span class="diff-new-ver">${change.newVersion}</span></span>
      </div>`;
  }
  return '';
}

// ============================================================
// Page: 版本更新内容
// ============================================================
function renderUpdateFeed() {
  backPage = null;

  const allFiltered = PLATFORM_UPDATES.sort(
    (a, b) => new Date(b.releaseDate) - new Date(a.releaseDate)
  );

  return `
    <div class="updates-page">
      <p class="page-desc">聚合 CurseForge、Modrinth 等平台的已安装资产的版本更新信息。标注你当前落后了几个版本。</p>

      <div class="filter-bar">
        <button class="filter-chip active" data-update-filter="all">全部</button>
        <button class="filter-chip" data-update-filter="mod">🧩 模组</button>
        <button class="filter-chip" data-update-filter="resource">🪵 资源包</button>
        <button class="filter-chip" data-update-filter="shader">☄️ 光影包</button>
        <button class="filter-chip" data-update-filter="modpack">📦 整合包</button>
        <button class="filter-chip" data-update-filter="danger">🔴 破坏性变更</button>
        <button class="filter-chip" data-update-filter="installed">仅已安装</button>
      </div>

      <div class="update-feed">
        ${allFiltered.map(renderUpdateCard).join('')}
      </div>
    </div>`;
}

function renderUpdateCard(update) {
  const risk = RISK_LEVEL[update.severity];
  const catMeta = CATEGORY_META[update.assetType] || CATEGORY_META.mod;

  return `
    <div class="update-card" data-asset-type="${update.assetType}" data-severity="${update.severity}" data-installed="true">
      <div class="update-card-head">
        <div class="update-card-main">
          <span class="update-asset-icon">${update.assetIcon || catMeta.icon}</span>
          <div>
            <h4>${update.assetName}</h4>
            <span class="update-ver-info mono">
              ${update.currentVersion} → <strong>${update.latestVersion}</strong>
              ${update.versionGap > 0 ? `<span class="ver-gap">（落后 ${update.versionGap} 个版本）</span>` : ''}
              · ${update.releaseDate}
            </span>
          </div>
        </div>
        <span class="severity-badge ${getRiskClass(update.severity)}">${risk.icon} ${risk.label}</span>
      </div>
      <p class="update-changelog">${update.changelog}</p>
      <div class="update-card-foot">
        <span class="update-source">来源：${update.sourcePlatform}</span>
        ${update.isBreaking ? '<span class="breaking-tag">⚠ 破坏性变更</span>' : ''}
        <span class="update-instances">影响实例：${update.affectedInstances.map((id) => {
          const i = getInstance(id);
          return i ? i.name : id;
        }).join('、')}</span>
      </div>
    </div>`;
}

// ============================================================
// Page: MC 大事件
// ============================================================
function renderMCEvents() {
  backPage = null;

  const sorted = [...MC_EVENTS].sort(
    (a, b) => new Date(b.publishTime) - new Date(a.publishTime)
  );

  return `
    <div class="events-page">
      <p class="page-desc">影响 Minecraft 模组生态的重要事件时间线。标注每个事件影响的范围。</p>

      <div class="filter-bar">
        <button class="filter-chip active" data-event-filter="all">全部</button>
        <button class="filter-chip" data-event-filter="CRITICAL">🛡️ 严重</button>
        <button class="filter-chip" data-event-filter="WARNING">⚠️ 警告</button>
        <button class="filter-chip" data-event-filter="INFO">ℹ️ 信息</button>
      </div>

      <div class="event-timeline">
        <div class="event-line"></div>
        ${sorted.map((evt) => renderEventCard(evt)).join('')}
      </div>
    </div>`;
}

function renderEventCard(evt) {
  const catLabels = {
    VERSION_RELEASE: 'MC 版本',
    LOADER_UPDATE: '加载器更新',
    PLATFORM_POLICY: '平台政策',
    SECURITY: '安全漏洞',
    MOD_MILESTONE: '模组里程碑',
  };

  return `
    <div class="event-card ${getSeverityClass(evt.severity)}" data-severity="${evt.severity}">
      <div class="event-dot ${getSeverityClass(evt.severity)}"></div>
      <div class="event-body">
        <div class="event-head">
          <span class="event-icon">${evt.icon}</span>
          <div>
            <h4>${evt.title}</h4>
            <span class="event-meta mono">
              ${catLabels[evt.category] || evt.category} · ${evt.publishTime}
            </span>
          </div>
          <span class="severity-badge ${getSeverityClass(evt.severity)}">${evt.severity}</span>
        </div>
        <p class="event-content">${evt.content}</p>
        <div class="event-foot">
          ${evt.affectedVersions.length > 0
            ? `<span class="event-tags">影响版本：${evt.affectedVersions.map((v) => `<span class="evt-tag">${v}</span>`).join(' ')}</span>`
            : '<span class="event-tags">全局事件</span>'}
          ${evt.relatedUrl
            ? `<a href="${evt.relatedUrl}" target="_blank" rel="noreferrer" class="btn btn-outline btn-sm">查看详情 →</a>`
            : ''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// Page: 实用网站
// ============================================================
const USEFUL_SITES = [
  {
    id: 'modrinth',
    name: 'Modrinth',
    url: 'https://modrinth.com',
    desc: '开源模组平台 · 模组/资源包/光影包/整合包',
    color: '#1bd96a',
    icon: 'https://modrinth.com/favicon.ico',
  },
  {
    id: 'curseforge',
    name: 'CurseForge',
    url: 'https://www.curseforge.com/minecraft',
    desc: '最大的 MC 模组平台 · 模组/整合包/资源包',
    color: '#f16436',
    icon: 'https://www.curseforge.com/favicon.ico',
  },
  {
    id: 'mcmod',
    name: 'MC 百科',
    url: 'https://www.mcmod.cn',
    desc: '中文 Minecraft 模组百科 · 教程/资料/社区',
    color: '#2196F3',
    icon: 'https://www.mcmod.cn/favicon.ico',
  },
  {
    id: 'planetminecraft',
    name: 'Planet Minecraft',
    url: 'https://www.planetminecraft.com',
    desc: '资源包/光影包/地图/皮肤社区',
    color: '#8BC34A',
    icon: 'https://www.planetminecraft.com/favicon.ico',
  },
  {
    id: 'minecraft-wiki',
    name: 'Minecraft Wiki',
    url: 'https://zh.minecraft.wiki',
    desc: '官方中文 Minecraft Wiki · 最全的游戏百科',
    color: '#795548',
    icon: 'https://zh.minecraft.wiki/favicon.ico',
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/topics/minecraft-mod',
    desc: '模组源码与 Issue 追踪 · 开发者社区',
    color: '#6e7681',
    icon: 'https://github.com/favicon.ico',
  },
];

function renderUsefulSites() {
  return `
    <div class="sites-page">
      <p class="page-desc">常用 Minecraft 模组生态网站。点击卡片直接跳转。</p>
      <div class="sites-grid">
        ${USEFUL_SITES.map((site) => `
          <a href="${site.url}" target="_blank" rel="noreferrer" class="site-card" style="--site-color:${site.color}">
            <div class="site-card-img">
              <img src="${site.icon}" alt="${site.name}" onerror="this.style.display='none';this.nextElementSibling.style.display=''" />
              <span class="site-card-fallback" style="display:none;font-size:2rem">🌐</span>
            </div>
            <div class="site-card-body">
              <h4>${site.name}</h4>
              <p>${site.desc}</p>
            </div>
            <span class="site-card-arrow">→</span>
          </a>`).join('')}
      </div>
    </div>`;
}

// ============================================================
// Page: 我的账户
// ============================================================
function hasBoundPhone(phone) {
  return phone != null && String(phone).trim() !== '';
}

function hasBoundEmail(email) {
  return email != null && String(email).trim() !== '';
}

/** 是否已绑定任一联系方式（与后端 VerifyTokenInterceptor / bindAccount 一致） */
function hasAnyBoundContact(profile = accountProfile) {
  if (!profile) return false;
  return hasBoundPhone(profile.phone) || hasBoundEmail(profile.email);
}

/** 换绑 / 改密前是否需先完成安全验证 */
function needsSecurityVerify(profile = accountProfile) {
  return hasAnyBoundContact(profile);
}

/** 绑定操作是否需安全验证（首次绑定手机/邮箱且两者均为空时不需要） */
function needsSecurityVerifyForBind(bindHint, profile = accountProfile) {
  if (!hasAnyBoundContact(profile)) return false;
  return true;
}

/**
 * 是否已通过安全验证：getAccount 在携带有效 Verify-Token 时返回完整联系方式（非脱敏）
 */
function isAccountSecurityVerified(profile = accountProfile) {
  if (!profile || !hasAnyBoundContact(profile)) return false;
  if (hasBoundPhone(profile.phone) && isMaskedContact(profile.phone)) return false;
  if (hasBoundEmail(profile.email) && isMaskedContact(profile.email)) return false;
  return true;
}

function clearVerifySectionHighlight() {
  if (verifySectionWarnTimer) {
    clearTimeout(verifySectionWarnTimer);
    verifySectionWarnTimer = null;
  }
  const section = document.getElementById('account-verify-section');
  section?.classList.remove('account-verify-section--warn');
  document.getElementById('account-verify-warn')?.classList.add('hidden');
}

function highlightVerifySection(message) {
  const section = document.getElementById('account-verify-section');
  if (!section) {
    showToast(message, 'error');
    return;
  }
  const warn = document.getElementById('account-verify-warn');
  if (warn) {
    warn.textContent = message;
    warn.classList.remove('hidden');
  }
  section.classList.add('account-verify-section--warn');
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (verifySectionWarnTimer) clearTimeout(verifySectionWarnTimer);
  verifySectionWarnTimer = setTimeout(clearVerifySectionHighlight, 6000);
}

function handleAccountActionClick(kind, bindHint) {
  const profile = accountProfile;

  if (kind === 'password') {
    if (!hasAnyBoundContact(profile)) {
      showToast('请先绑定手机或邮箱', 'error');
      return;
    }
    if (!isAccountSecurityVerified(profile)) {
      highlightVerifySection('请先完成安全验证后再修改密码');
      return;
    }
    openAccountModal('password');
    return;
  }

  if (kind === 'bind') {
    if (needsSecurityVerifyForBind(bindHint, profile) && !isAccountSecurityVerified(profile)) {
      const isRebind = bindHint === 'phone'
        ? hasBoundPhone(profile?.phone)
        : bindHint === 'email'
          ? hasBoundEmail(profile?.email)
          : false;
      highlightVerifySection(isRebind ? '请先完成安全验证后再换绑' : '请先完成安全验证后再绑定');
      return;
    }
    openAccountModal('bind', bindHint);
  }
}

function setAccountModalFormDisabled(form, disabled) {
  if (!form) return;
  form.querySelectorAll('input, button').forEach((el) => {
    el.disabled = disabled;
  });
}

function isMaskedContact(value) {
  if (value == null) return false;
  const s = String(value);
  return s.includes('****') || (s.includes('***') && s.includes('@'));
}

function cacheAccountContacts(profile) {
  if (profile?.phone && !isMaskedContact(profile.phone)) {
    sessionStorage.setItem('accountPhone', String(profile.phone).trim());
  }
  if (profile?.email && !isMaskedContact(profile.email)) {
    sessionStorage.setItem('accountEmail', String(profile.email).trim());
  }
}

function renderVerifySection(profile, verified) {
  const hasPhone = hasBoundPhone(profile.phone);
  const hasEmail = hasBoundEmail(profile.email);
  if (!hasPhone && !hasEmail) return '';

  if (verified) {
    return `
      <div id="account-verify-section" class="account-verify-section account-verify-section--done">
        <div class="account-verify-section-head">
          <h3>安全验证</h3>
          <span class="account-inline-ok">✓ 已通过</span>
        </div>
      </div>`;
  }

  const accountField = `<input name="account" class="account-verify-account" type="text" required placeholder="请输入已绑定的手机或邮箱" aria-label="验证账号" autocomplete="username" />`;

  return `
    <div id="account-verify-section" class="account-verify-section">
      <div class="account-verify-section-head">
        <h3>安全验证</h3>
      </div>
      <p id="account-verify-warn" class="account-verify-warn-msg hidden" role="alert"></p>
      <form id="form-verify" class="account-verify-inline">
        ${accountField}
        <input name="verificationCode" class="account-verify-code" type="text" inputmode="numeric" placeholder="验证码" required maxlength="6" autocomplete="one-time-code" />
        <button type="button" class="btn btn-secondary btn-sm code-btn" data-scene="${SCENES.VERIFY_ACCOUNT}" data-target="account">发码</button>
        <button type="submit" class="btn btn-soft btn-sm">验证</button>
      </form>
    </div>`;
}

function openAccountModal(kind, bindHint) {
  const modal = document.getElementById('account-action-modal');
  const titleEl = document.getElementById('account-modal-title');
  const panePassword = document.getElementById('account-modal-pane-password');
  const paneBind = document.getElementById('account-modal-pane-bind');
  if (!modal || !titleEl) return;

  panePassword?.classList.add('hidden');
  paneBind?.classList.add('hidden');

  const profile = accountProfile;

  if (kind === 'password') {
    titleEl.textContent = '修改密码';
    panePassword?.classList.remove('hidden');
    document.getElementById('account-modal-password-hint')?.classList.add('hidden');
    setAccountModalFormDisabled(document.getElementById('form-password'), false);
  } else if (kind === 'bind') {
    const isPhone = bindHint === 'phone';
    const isEmail = bindHint === 'email';
    const phoneBound = hasBoundPhone(profile?.phone);
    const emailBound = hasBoundEmail(profile?.email);
    const isRebind = isPhone ? phoneBound : isEmail ? emailBound : false;

    titleEl.textContent = isRebind
      ? (isPhone ? '换绑手机' : '换绑邮箱')
      : (isPhone ? '绑定手机' : isEmail ? '绑定邮箱' : '绑定联系方式');

    paneBind?.classList.remove('hidden');

    const currentWrap = document.getElementById('account-modal-current-wrap');
    const currentLabel = document.getElementById('account-modal-current-label');
    const currentValue = document.getElementById('account-modal-current-value');
    const bindHintEl = document.getElementById('account-modal-bind-hint');
    const newLabel = document.getElementById('account-modal-new-label');
    const form = document.getElementById('form-bind');
    const input = form?.querySelector('[name="account"]');
    const codeSection = form?.querySelector('[data-code-section="account"]');

    bindHintEl?.classList.add('hidden');

    if (isRebind && currentWrap && currentLabel && currentValue) {
      currentWrap.classList.remove('hidden');
      if (isPhone) {
        currentLabel.textContent = '原手机号';
        currentValue.textContent = String(profile.phone).trim();
        if (newLabel) newLabel.textContent = '新手机号';
        if (input) input.placeholder = '请输入新的手机号';
        if (input) input.dataset.validate = 'phone';
      } else {
        currentLabel.textContent = '原邮箱';
        currentValue.textContent = String(profile.email).trim();
        if (newLabel) newLabel.textContent = '新邮箱';
        if (input) input.placeholder = '请输入新的邮箱地址';
        if (input) input.dataset.validate = 'email';
      }
    } else {
      currentWrap?.classList.add('hidden');
      if (newLabel) newLabel.textContent = isPhone ? '手机号' : isEmail ? '邮箱' : '手机 / 邮箱';
      if (input) {
        input.placeholder = isPhone
          ? '请输入手机号'
          : isEmail
            ? '请输入邮箱地址'
            : '请输入手机号或邮箱';
        input.dataset.validate = isPhone ? 'phone' : isEmail ? 'email' : 'account';
      }
    }

    form?.reset?.();
    codeSection?.classList.add('hidden');
    setAccountModalFormDisabled(form, false);
    setupInputValidation(form);
  }

  modal.classList.remove('hidden');
  if (kind === 'bind') {
    modal.dataset.bindHint = bindHint || '';
  }
}

function closeAccountModal() {
  document.getElementById('account-action-modal')?.classList.add('hidden');
}

function renderAccountRow(label, valueHtml, actionHtml = '') {
  return `
    <div class="account-row">
      <span class="account-row-label">${label}</span>
      <span class="account-row-value">${valueHtml}</span>
      ${actionHtml ? `<div class="account-row-action">${actionHtml}</div>` : ''}
    </div>`;
}

function renderSettings() {
  backPage = null;
  const verified = accountProfile ? isAccountSecurityVerified(accountProfile) : false;

  if (accountProfileLoading) {
    return `
      <div class="settings-page">
        <div class="settings-card">
          <div class="account-profile-head"><h3>我的账户</h3></div>
          <p class="settings-hint account-loading">正在加载…</p>
        </div>
      </div>`;
  }

  if (accountProfileError && !accountProfile) {
    return `
      <div class="settings-page">
        <div class="settings-card">
          <div class="account-profile-head">
            <h3>我的账户</h3>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-reload-account">重试</button>
          </div>
          <p class="settings-hint settings-warn">${escapeHtml(accountProfileError)}</p>
        </div>
      </div>`;
  }

  if (!accountProfile) {
    return `
      <div class="settings-page">
        <div class="settings-card">
          <div class="account-profile-head">
            <h3>我的账户</h3>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-reload-account">刷新</button>
          </div>
          <p class="settings-hint">暂无账户数据。</p>
        </div>
      </div>`;
  }

  const a = accountProfile;
  const st = formatAccountStatus(a.status);
  const phoneBound = hasBoundPhone(a.phone);
  const emailBound = hasBoundEmail(a.email);
  const phoneBtnLabel = phoneBound ? '换绑' : '绑定';
  const emailBtnLabel = emailBound ? '换绑' : '绑定';

  return `
    <div class="settings-page">
      <div class="settings-card">
        <div class="account-profile-head">
          <h3>我的账户</h3>
          <div class="account-profile-actions">
            <button type="button" class="btn btn-sm account-head-btn" id="btn-reload-account">刷新</button>
            <button type="button" class="btn btn-sm account-head-btn account-logout-btn" id="btn-logout-settings">退出登录</button>
          </div>
        </div>

        <div class="account-rows">
          ${renderAccountRow('账户名', formatAccountField(a.username, '—'))}
          ${renderAccountRow('昵称', formatAccountField(a.nickname, '—'))}
          ${renderAccountRow(
            '手机',
            formatAccountField(a.phone),
            `<button type="button" class="btn btn-text btn-sm" data-open-account-modal="bind" data-bind-hint="phone">${phoneBtnLabel}</button>`,
          )}
          ${renderAccountRow(
            '邮箱',
            formatAccountField(a.email),
            `<button type="button" class="btn btn-text btn-sm" data-open-account-modal="bind" data-bind-hint="email">${emailBtnLabel}</button>`,
          )}
          ${renderAccountRow(
            '登录密码',
            '<span class="account-masked">••••••••</span>',
            '<button type="button" class="btn btn-text btn-sm" data-open-account-modal="password">修改</button>',
          )}
          ${renderAccountRow('账户状态', `<span class="account-badge ${st.badge}">${st.text}</span>`)}
          ${renderAccountRow('最后登录 IP', `<span class="mono">${formatAccountField(a.lastLoginIp, '—')}</span>`)}
        </div>

        ${renderVerifySection(a, verified)}
      </div>
    </div>`;
}

// ============================================================
// Page Events
// ============================================================
function bindPageEvents() {
  const root = document.getElementById('content-area');

  // Instance card clicks
  root.querySelectorAll('[data-instance]').forEach((card) => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input') || e.target.closest('[data-no-nav]')) return;
      if (card.dataset.live === '1') {
        await openLiveInstanceDetail(card.dataset.instance);
        return;
      }
      activeInstanceId = card.dataset.instance;
      navigateTo('instance-detail', { id: card.dataset.instance });
    });
  });

  root.querySelectorAll('[data-reload-mods]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.reloadMods;
      await loadLiveMods(id);
      if (currentPage === 'instance-detail') renderPage({ id });
    });
  });

  root.querySelectorAll('[data-reload-instances]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await loadLiveInstances();
      renderPage();
    });
  });

  // Instance favorite
  root.querySelectorAll('[data-inst-fav]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.instFav;
      const isLive = btn.closest('[data-live="1"]');
      if (isLive) {
        const inst = liveInstances.find((i) => i.id === String(id));
        if (!inst) return;
        const nextFav = inst.favorite === 1 ? 0 : 1;
        const result = await api.updateInstanceFavorite(Number(id), nextFav);
        if (!isSuccess(result)) {
          showToast(getMessage(result), 'error');
          return;
        }
        inst.favorite = nextFav;
        const favorited = inst.favorite === 1;
        showToast(favorited ? '已加入收藏' : '已取消收藏');
        btn.textContent = favorited ? '★' : '☆';
        btn.classList.toggle('fav-active', favorited);
        btn.setAttribute('aria-label', favorited ? '取消收藏' : '收藏实例');
        btn.title = favorited ? '取消收藏' : '收藏';
        const card = btn.closest('.instance-card');
        card?.classList.toggle('instance-card-fav', favorited);
        if (currentPage === 'instances') {
          renderPage();
          bindPageEvents();
        }
        return;
      }
      const favorited = toggleInstanceFavorite(id);
      showToast(favorited ? '已加入收藏' : '已取消收藏');
      btn.textContent = favorited ? '★' : '☆';
      btn.classList.toggle('fav-active', favorited);
      btn.setAttribute('aria-label', favorited ? '取消收藏' : '收藏实例');
      btn.title = favorited ? '取消收藏' : '收藏';
      const card = btn.closest('.instance-card');
      card?.classList.toggle('instance-card-fav', favorited);
      if (currentPage === 'instances') {
        renderPage();
        bindPageEvents();
      }
    });
  });

  // Add-note trigger (shown when instance has no note yet)
  root.querySelectorAll('[data-note-add]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.noteAdd;
      const card = btn.closest('.instance-card');
      const noteRow = card?.querySelector('.instance-card-note');
      if (!noteRow) return;
      noteRow.classList.remove('hidden');
      btn.style.display = 'none';
      const input = noteRow.querySelector('.inst-note-input');
      input?.focus();
    });
  });

  // Instance note input
  root.querySelectorAll('[data-inst-note]').forEach((input) => {
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') input.blur();
    });
    input.addEventListener('blur', async () => {
      const id = input.dataset.instNote;
      const isLive = input.closest('[data-live="1"]');
      const inst = isLive ? liveInstances.find((i) => i.id === String(id)) : getInstance(id);
      if (!inst) return;
      const prev = inst.note || '';
      const next = input.value.trim();
      if (next === prev) {
        if (!next && currentPage === 'instances') { renderPage(); bindPageEvents(); }
        return;
      }
      if (isLive) {
        const result = await api.updateInstanceNote(Number(id), next);
        if (!isSuccess(result)) {
          input.value = prev;
          showToast(getMessage(result), 'error');
          return;
        }
        setLiveInstanceNote(id, next);
        showToast(next ? '备注已保存' : '备注已清空');
      } else {
        setInstanceNote(id, next);
        showToast(next ? '备注已保存' : '备注已清空');
      }
      if (currentPage === 'instances') { renderPage(); bindPageEvents(); }
    });
  });

  // Back button
  document.getElementById('btn-back-instance').onclick = () => {
    if (backPage) navigateTo(backPage);
    else navigateTo('instances');
  };

  // View diff from detail page
  root.querySelectorAll('[data-action="view-diff"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const detailPage = btn.closest('.detail-page');
      if (detailPage) activeInstanceId = detailPage.dataset.instance;
      navigateTo('timeline');
    });
  });

  // Asset tabs
  root.querySelectorAll('[data-asset-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const cat = tab.dataset.assetTab;
      root.querySelectorAll('[data-asset-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      root.querySelectorAll('[data-asset-panel]').forEach((p) => {
        p.classList.toggle('active', p.dataset.assetPanel === cat);
      });
      requestAnimationFrame(() => layoutAssetTables());
    });
  });

  // Timeline instance selector
  root.querySelectorAll('[data-timeline-instance]').forEach((sel) => {
    sel.addEventListener('change', () => {
      activeInstanceId = sel.value;
      delete activeSnapshotIds[activeInstanceId];
      renderPage();
      bindPageEvents();
    });
  });

  // Diff picker
  root.querySelectorAll('[data-diff-pick]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const inst = getInstance(activeInstanceId);
      if (!inst) return;
      const newerSel = root.querySelector('[data-diff-pick="newer"]');
      const olderSel = root.querySelector('[data-diff-pick="older"]');
      activeSnapshotIds[activeInstanceId] = [newerSel.value, olderSel.value];
      renderPage();
      bindPageEvents();
    });
  });

  // Update filters
  root.querySelectorAll('[data-update-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      root.querySelectorAll('[data-update-filter]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.dataset.updateFilter;
      root.querySelectorAll('.update-card').forEach((card) => {
        let show = true;
        if (filter === 'danger') show = card.dataset.severity === 'DANGER';
        else if (filter === 'installed') show = card.dataset.installed === 'true';
        else if (filter !== 'all') show = card.dataset.assetType === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });

  // Asset note input
  root.querySelectorAll('[data-asset-note]').forEach((input) => {
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') input.blur();
    });
    input.addEventListener('input', () => {
      input.classList.toggle('has-value', !!input.value.trim());
    });
    input.addEventListener('blur', async () => {
      const instId = input.dataset.assetInst;
      const cat = input.dataset.assetCat;
      const key = input.dataset.assetNote;
      const detailLive = input.closest('.detail-page[data-live="1"]');
      if (detailLive && cat === 'mods') {
        const mod = findLiveMod(instId, key);
        const prev = mod?.note || '';
        const next = input.value.trim();
        if (next === prev) return;
        const result = await api.updateModNote(Number(mod.id), next);
        if (!isSuccess(result)) {
          input.value = prev;
          showToast(getMessage(result), 'error');
          return;
        }
        if (mod) mod.note = next;
        input.classList.toggle('has-value', !!next);
        showToast(next ? '备注已保存' : '备注已清空');
        return;
      }
      const inst = getInstance(instId);
      if (!inst) return;
      const latest = getLatestSnapshot(inst);
      const asset = latest?.assets?.[cat]?.find((a) => (a.id || a.relativePath) === key);
      const prev = asset?.note || '';
      const next = input.value.trim();
      if (next === prev) return;
      setAssetNote(instId, cat, key, next);
      showToast(next ? '备注已保存' : '备注已清空');
    });
  });

  // Favorite toggle (asset table)
  root.querySelectorAll('.asset-fav-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const favId = btn.dataset.fav;
      const favCat = btn.dataset.favCat;
      const favInst = btn.dataset.favInst;
      const detailLive = btn.closest('.detail-page[data-live="1"]');
      if (detailLive && favCat === 'mods') {
        const mod = findLiveMod(favInst, favId);
        if (!mod) return;
        const nextFav = mod.favorited ? 0 : 1;
        const result = await api.updateModFavorite(Number(mod.id), nextFav);
        if (!isSuccess(result)) {
          showToast(getMessage(result), 'error');
          return;
        }
        mod.favorite = nextFav;
        mod.favorited = nextFav === 1;
        btn.textContent = mod.favorited ? '★' : '☆';
        btn.classList.toggle('fav-active', mod.favorited);
        btn.setAttribute('aria-label', mod.favorited ? '取消收藏' : '收藏');
        showToast(mod.favorited ? '已收藏' : '已取消收藏');
        return;
      }
      const inst = getInstance(favInst);
      if (!inst) return;
      const latest = getLatestSnapshot(inst);
      if (!latest) return;
      const assets = latest.assets[favCat] || [];
      const asset = assets.find((a) => (a.id || a.relativePath) === favId);
      if (asset) {
        asset.favorited = !asset.favorited;
        btn.textContent = asset.favorited ? '★' : '☆';
        btn.classList.toggle('fav-active', asset.favorited);
        btn.setAttribute('aria-label', asset.favorited ? '取消收藏' : '收藏');
        showToast(asset.favorited ? '已收藏' : '已取消收藏');
      }
    });
  });

  // Legacy fav-btn (if any remain)
  root.querySelectorAll('.fav-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const favId = btn.dataset.fav;
      const favCat = btn.dataset.favCat;
      const favInst = btn.dataset.favInst;
      const inst = getInstance(favInst);
      if (!inst) return;
      const latest = getLatestSnapshot(inst);
      if (!latest) return;
      const assets = latest.assets[favCat] || [];
      const asset = assets.find((a) => (a.id || a.relativePath) === favId);
      if (asset) {
        asset.favorited = !asset.favorited;
        btn.textContent = asset.favorited ? '⭐' : '☆';
        btn.classList.toggle('fav-active', asset.favorited);
        showToast(asset.favorited ? '已收藏' : '已取消收藏');
      }
    });
  });

  // Version hover: for "已最新" only, wait 0.6s then show tooltip.
  // For "可更新", tooltip is always visible via CSS.
  const latestCells = root.querySelectorAll('.ver-cell.ver-latest');
  const latestTimers = new Map();
  latestCells.forEach((cell) => {
    const clear = () => {
      const t = latestTimers.get(cell);
      if (t) clearTimeout(t);
      latestTimers.delete(cell);
      cell.classList.remove('ver-hover', 'ver-tooltip-show');
    };
    const schedule = () => {
      cell.classList.add('ver-hover');
      const prev = latestTimers.get(cell);
      if (prev) clearTimeout(prev);
      latestTimers.set(cell, setTimeout(() => {
        cell.classList.add('ver-tooltip-show');
      }, 600));
    };

    cell.addEventListener('mouseenter', schedule);
    cell.addEventListener('mouseleave', clear);
    cell.addEventListener('focus', schedule);
    cell.addEventListener('blur', clear);
  });

  // Settings forms
  if (currentPage === 'settings') bindSettingsForms();
  // Always re-validate after page render (settings forms are dynamic)
  setupInputValidation(document.getElementById('content-area'));
}

// ============================================================
// Auth & Settings forms (unchanged)
// ============================================================
function bindSettingsForms() {
  const verifyForm = document.getElementById('form-verify');
  verifyForm?.addEventListener('focusin', clearVerifySectionHighlight);
  verifyForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = validateVerifyPayload(getFormData(e.target));
      const r = await api.verifyAccount(data.account, data.verificationCode);
      if (isSuccess(r)) {
        saveVerifyToken(r.data);
        setHasBoundContact(true);
        clearVerifySectionHighlight();
        showToast(getMessage(r));
        await refreshSettingsPage();
      } else showToast(getMessage(r), 'error');
    } catch (err) { showToast(err.message || '网络错误', 'error'); }
  });

  bindCodeButtons(document.getElementById('content-area'));
  setupInputValidation(document.getElementById('content-area'));

  document.getElementById('btn-reload-account')?.addEventListener('click', () => {
    refreshSettingsPage();
  });
}

function setupAccountModal() {
  document.getElementById('form-password')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = validatePasswordPayload(getFormData(e.target));
      const r = await api.updatePassword(data);
      if (isSuccess(r)) {
        closeAccountModal();
        showToast(getMessage(r));
        clearAuth();
        resetLiveSession();
        enterLanding();
      } else showToast(getMessage(r), 'error');
    } catch (err) { showToast(err.message || '网络错误', 'error'); }
  });

  document.getElementById('form-bind')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = validateBindPayload(getFormData(e.target));
      const needVerify = needsSecurityVerifyForBind(
        document.getElementById('account-action-modal')?.dataset.bindHint,
        accountProfile,
      );
      const r = await api.bindAccount(data.account, data.verificationCode, needVerify);
      if (isSuccess(r)) {
        setHasBoundContact(true);
        clearVerifyToken();
        closeAccountModal();
        showToast(getMessage(r));
        e.target.reset();
        await refreshSettingsPage();
      } else {
        const msg = getMessage(r);
        if (msg.includes('二次验证')) showToast('请先完成安全验证后再换绑', 'error');
        else showToast(msg, 'error');
      }
    } catch (err) { showToast(err.message || '网络错误', 'error'); }
  });

  document.querySelectorAll('[data-close-account-modal]').forEach((el) => {
    el.addEventListener('click', closeAccountModal);
  });

  document.getElementById('content-area')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-account-modal]');
    if (!btn) return;
    handleAccountActionClick(btn.dataset.openAccountModal, btn.dataset.bindHint);
  });

  bindCodeButtons(document.getElementById('account-action-modal'));
  setupInputValidation(document.getElementById('account-action-modal'));
}

function bindCodeButtons(root = document) {
  root.querySelectorAll('.code-btn').forEach((btn) => {
    btn.onclick = async () => {
      const form = btn.closest('form');
      const field = form.querySelector(`[name="${btn.dataset.target}"]`);
      const account = (field?.value ?? '').trim();
      const scene = btn.dataset.scene;
      if (!account) { showToast('请先选择或填写账号', 'error'); return; }
      if (!isAccount(account) && scene !== SCENES.REGISTER) {
        showToast('请输入正确的手机或邮箱', 'error');
        return;
      }
      if (scene === SCENES.REGISTER) {
        const target = btn.dataset.target;
        if (target === 'phone' && !isPhone(account)) { showToast('手机号格式不正确', 'error'); return; }
        if (target === 'email' && !isEmail(account)) { showToast('邮箱格式不正确', 'error'); return; }
      }
      btn.disabled = true;
      try {
        const r = await api.sendVerificationCode(account, scene);
        if (isSuccess(r)) { showToast(getMessage(r)); startCooldown(btn); }
        else { showToast(getMessage(r), 'error'); btn.disabled = false; }
      } catch { showToast('网络错误', 'error'); btn.disabled = false; }
    };
  });
}

// ============================================================
// Auth Modal (unchanged)
// ============================================================
function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal').classList.remove('hidden');
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.authTab === tab);
  });
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('form-forgot').classList.toggle('hidden', tab !== 'forgot');
}

function setupAuth() {
  document.querySelectorAll('[data-auth]').forEach((el) => {
    el.addEventListener('click', () => openAuthModal(el.dataset.auth));
  });
  document.querySelectorAll('[data-auth-tab]').forEach((tab) => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.authTab));
  });
  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeAuthModal);
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { username, password } = getFormData(e.target);
    try {
      const r = await api.login(username, password);
      if (isSuccess(r)) {
        saveSessionFromLogin(r.data, username);
        clearVerifyToken();
        showToast(getMessage(r));
        closeAuthModal();
        updateAccountButton();
        if (postLoginRedirect === 'my-data') {
          postLoginRedirect = null;
          await enterMyData();
        } else {
          appMode = isLoggedIn() ? 'live' : 'demo';
          updateAppModeBadge();
          if (appMode === 'live') await loadLiveInstances();
          enterApp();
        }
      } else showToast(getMessage(r), 'error');
    } catch { showToast('网络错误，请确认网关已启动', 'error'); }
  });

  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = buildRegisterPayload(getFormData(e.target));
      const r = await api.register(payload);
      if (isSuccess(r)) {
        if (payload.phone || payload.email) markPendingBoundContact();
        showToast(getMessage(r));
        switchAuthTab('login');
        e.target.reset();
      } else showToast(getMessage(r), 'error');
    } catch (err) { showToast(err.message || '网络错误', 'error'); }
  });

  document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = validateForgotPayload(getFormData(e.target));
      const r = await api.forgotPassword(payload);
      if (isSuccess(r)) { showToast(getMessage(r)); switchAuthTab('login'); e.target.reset(); }
      else showToast(getMessage(r), 'error');
    } catch (err) { showToast(err.message || '网络错误', 'error'); }
  });

  bindCodeButtons(document.getElementById('auth-modal'));
  setupInputValidation(document.getElementById('auth-modal'));
}

// ============================================================
// App Shell
// ============================================================
async function handleLogout() {
  try { if (isLoggedIn()) await api.logout(); } catch { /* ignore */ }
  clearAuth();
  resetLiveSession();
  showToast('已退出');
  enterLanding();
}

function setupApp() {
  document.querySelectorAll('[data-go-home]').forEach((el) => {
    el.addEventListener('click', goHome);
  });

  document.querySelectorAll('[data-demo="report"]').forEach((btn) => {
    btn.addEventListener('click', () => enterDemoData());
  });

  document.querySelectorAll('[data-action="my-data"]').forEach((btn) => {
    btn.addEventListener('click', () => requestMyData());
  });

  document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.page === 'instances' && appMode === 'live') {
        await loadLiveInstances();
      }
      navigateTo(btn.dataset.page);
    });
  });

  document.getElementById('btn-account').addEventListener('click', () => {
    if (isLoggedIn()) navigateTo('settings');
    else openAuthModal('login');
  });

  document.getElementById('btn-landing-account')?.addEventListener('click', async () => {
    if (!isLoggedIn()) {
      openAuthModal('login');
      return;
    }
    await enterMyData();
    navigateTo('settings');
  });

  // Logout from settings page (delegated)
  document.getElementById('content-area').addEventListener('click', (e) => {
    if (e.target.id === 'btn-logout-settings') {
      handleLogout();
    }
  });

  window.addEventListener('auth:logout', () => {
    clearAuth();
    resetLiveSession();
    showToast('登录已过期，请重新登录', 'error');
    enterLanding();
    updateAccountButton();
  });

  let assetLayoutTimer;
  window.addEventListener('resize', () => {
    clearTimeout(assetLayoutTimer);
    assetLayoutTimer = setTimeout(layoutAssetTables, 120);
  });
}

// ============================================================
// Init
// ============================================================
async function init() {
  setupAuth();
  setupApp();
  setupAccountModal();
  restoreSessionFromStorage();

  if (isLoggedIn()) {
    await enterMyData();
  } else {
    enterLanding();
  }
}

init();
