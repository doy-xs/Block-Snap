import { api, isSuccess, getMessage } from './api.js';
import { isLoggedIn, saveToken, saveUsername, getUsername, saveVerifyToken, clearAuth, clearVerifyToken } from './auth.js';
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
const PHONE_REGEX = /^1[3-9]\d{9}$/;
const EMAIL_REGEX = /^[A-Za-z0-9+_.-]+@(.+)$/;

function setupInputValidation(root = document) {
  root.querySelectorAll('[data-validate]').forEach((input) => {
    const handler = () => {
      const form = input.closest('form');
      const validateType = input.dataset.validate;
      const value = input.value.trim();

      let section;
      if (validateType === 'phone') {
        section = form?.querySelector('[data-code-section="phone"]');
      } else if (validateType === 'email') {
        section = form?.querySelector('[data-code-section="email"]');
      } else if (validateType === 'account') {
        section = form?.querySelector('[data-code-section="account"]');
      }

      if (!section) return;

      const formatOk = (validateType === 'phone' && PHONE_REGEX.test(value))
        || (validateType === 'email' && EMAIL_REGEX.test(value))
        || (validateType === 'account' && (PHONE_REGEX.test(value) || EMAIL_REGEX.test(value)));

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
function renderInstanceDetail(instanceId) {
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

  // Back-end field `IsNewVersion` semantics may differ from our previous `latestVersion` compare.
  // We try to infer the meaning using `latestVersion` when available; otherwise we fall back to "true=hasNew".
  const hasNewByCompare = Boolean(a.latestVersion && a.latestVersion !== a.version);
  let isLatest;
  if (typeof a?.IsNewVersion === 'boolean') {
    if (a.latestVersion != null) {
      if (hasNewByCompare === a.IsNewVersion) isLatest = !a.IsNewVersion;       // true => has new
      else if (hasNewByCompare === !a.IsNewVersion) isLatest = a.IsNewVersion; // true => already latest
      else isLatest = !a.IsNewVersion; // fallback: assume true => has new
    } else {
      isLatest = !a.IsNewVersion; // fallback when we don't have latestVersion info
    }
  } else {
    // If back-end doesn't provide `IsNewVersion`, use our previous compare logic.
    isLatest = !hasNewByCompare;
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
  const active = assets.filter((a) => !a.isDelete);
  const deleted = assets.filter((a) => a.isDelete);

  if (!active.length && !deleted.length) {
    return '<p class="empty-hint">暂无数据</p>';
  }

  const isMod = category === 'mods';

  const noteCol = isMod ? 5 : 4;
  const favCol = isMod ? 6 : 5;

  const headCoreCols = isMod
    ? `
        <div class="asset-core-col" data-col="0"><span class="asset-head-label">名称</span></div>
        <div class="asset-core-col" data-col="1"><span class="asset-head-label">版本</span></div>
        <div class="asset-core-col" data-col="2"><span class="asset-head-label">加载耗时</span></div>
        <div class="asset-core-col asset-col-created" data-col="3"><span class="asset-head-label">创建时间</span></div>
        <div class="asset-core-col" data-col="4"><span class="asset-head-label">更新时间</span></div>
        <div class="asset-core-col asset-col-note" data-col="5"><span class="asset-head-label">备注</span></div>
        <div class="asset-core-col asset-col-fav" data-col="6"><span class="sr-only">收藏</span></div>`
    : `
        <div class="asset-core-col" data-col="0"><span class="asset-head-label">名称</span></div>
        <div class="asset-core-col" data-col="1"><span class="asset-head-label">版本</span></div>
        <div class="asset-core-col asset-col-created" data-col="2"><span class="asset-head-label">创建时间</span></div>
        <div class="asset-core-col" data-col="3"><span class="asset-head-label">更新时间</span></div>
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
function renderSettings() {
  backPage = null;
  const hasVerify = !!localStorage.getItem('verifyToken');
  return `
    <div class="settings-page">
      <div class="settings-card">
        <div class="settings-grid">
          <section class="settings-section">
            <h3>二次验证</h3>
            <div class="verify-status ${hasVerify ? 'ok' : ''}">${hasVerify ? '✓ 已通过' : '○ 尚未验证'}</div>
            <form id="form-verify" class="settings-form">
              <label><span>手机 / 邮箱</span><input name="account" required data-validate="account" /></label>
              <div class="field-row code-section hidden" data-code-section="account">
                <label class="flex-grow"><span>验证码</span><input name="verificationCode" data-code-input="account" /></label>
                <button type="button" class="btn btn-secondary code-btn" data-scene="verify-account" data-target="account">获取验证码</button>
              </div>
              <button type="submit" class="btn btn-soft">验证</button>
            </form>
          </section>
          <section class="settings-section">
            <h3>修改密码</h3>
            <form id="form-password" class="settings-form">
              <label><span>原密码</span><input name="oldPassword" type="password" required /></label>
              <label><span>新密码</span><input name="newPassword" type="password" required /></label>
              <label><span>确认</span><input name="confirmNewPassword" type="password" required /></label>
              <button type="submit" class="btn btn-soft">修改</button>
            </form>
          </section>
        </div>
        <div class="settings-divider"></div>
        <section class="settings-section">
          <h3>绑定账号</h3>
          <form id="form-bind" class="settings-form settings-form-inline">
            <label><span>手机 / 邮箱</span><input name="account" required data-validate="account" /></label>
            <div class="field-row code-section hidden" data-code-section="account">
              <label class="flex-grow"><span>验证码</span><input name="verificationCode" data-code-input="account" /></label>
              <button type="button" class="btn btn-secondary code-btn" data-scene="bind-account" data-target="account">获取验证码</button>
            </div>
            <button type="submit" class="btn btn-soft">绑定</button>
          </form>
        </section>
        <div class="settings-divider"></div>
        <section class="settings-section settings-section-danger">
          <h3>退出登录</h3>
          <p class="settings-hint">退出后需要重新登录才能访问。</p>
          <button class="btn btn-danger" id="btn-logout-settings">退出登录</button>
        </section>
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
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input') || e.target.closest('[data-no-nav]')) return;
      if (card.dataset.live === '1') {
        showToast('云端实例详情页开发中', 'error');
        return;
      }
      activeInstanceId = card.dataset.instance;
      navigateTo('instance-detail', { id: card.dataset.instance });
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
    input.addEventListener('blur', () => {
      const instId = input.dataset.assetInst;
      const cat = input.dataset.assetCat;
      const key = input.dataset.assetNote;
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
  document.getElementById('form-verify')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { account, verificationCode } = getFormData(e.target);
    try {
      const r = await api.verifyAccount(account, verificationCode);
      if (isSuccess(r)) { saveVerifyToken(r.data); showToast(getMessage(r)); renderPage(); bindPageEvents(); }
      else showToast(getMessage(r), 'error');
    } catch { showToast('网络错误', 'error'); }
  });

  document.getElementById('form-password')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api.updatePassword(getFormData(e.target));
      if (isSuccess(r)) { showToast(getMessage(r)); clearAuth(); enterLanding(); }
      else showToast(getMessage(r), 'error');
    } catch { showToast('网络错误', 'error'); }
  });

  document.getElementById('form-bind')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = getFormData(e.target);
    const needVerify = !!localStorage.getItem('verifyToken');
    try {
      const r = await api.bindAccount(data.account, data.verificationCode, needVerify);
      if (isSuccess(r)) { showToast(getMessage(r)); clearVerifyToken(); e.target.reset(); renderPage(); bindPageEvents(); }
      else showToast(getMessage(r), 'error');
    } catch { showToast('网络错误', 'error'); }
  });

  bindCodeButtons(document.getElementById('content-area'));
  setupInputValidation(document.getElementById('content-area'));
}

function bindCodeButtons(root = document) {
  root.querySelectorAll('.code-btn').forEach((btn) => {
    btn.onclick = async () => {
      const form = btn.closest('form');
      const account = form.querySelector(`[name="${btn.dataset.target}"]`)?.value.trim();
      if (!account) { showToast('请先填写账号', 'error'); return; }
      btn.disabled = true;
      try {
        const r = await api.sendVerificationCode(account, btn.dataset.scene);
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
        saveToken(r.data);
        saveUsername(username);
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
      const r = await api.register(getFormData(e.target));
      if (isSuccess(r)) { showToast(getMessage(r)); switchAuthTab('login'); e.target.reset(); }
      else showToast(getMessage(r), 'error');
    } catch { showToast('网络错误', 'error'); }
  });

  document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api.forgotPassword(getFormData(e.target));
      if (isSuccess(r)) { showToast(getMessage(r)); switchAuthTab('login'); e.target.reset(); }
      else showToast(getMessage(r), 'error');
    } catch { showToast('网络错误', 'error'); }
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
  appMode = 'demo';
  liveInstances = [];
  instancesLoadError = null;
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
    showToast('登录已过期', 'error');
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

  if (isLoggedIn()) {
    await enterMyData();
  } else {
    enterLanding();
  }
}

init();
