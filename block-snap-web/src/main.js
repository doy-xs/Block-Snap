import { api, isSuccess, getMessage } from './api.js';
import { isLoggedIn, saveToken, saveUsername, getUsername, saveVerifyToken, clearAuth, clearVerifyToken } from './auth.js';
import {
  CATEGORY_META, CHANGE_TYPE, RISK_LEVEL,
  INSTANCES, MODPACKS, PLATFORM_UPDATES,
  formatMs, formatDuration, pct,
  getInstance, getModpack, getLatestSnapshot,
  getInstanceAssetSummary, getPendingUpdateCount,
  getSortedInstances, toggleInstanceFavorite, setInstanceNote,
  computeSnapshotDiff, getSeverityClass, getRiskClass,
} from './mock-data.js';

// ── State ──
let toastTimer = null;
let currentPage = 'instances';
let activeInstanceId = INSTANCES[0]?.id || null;
let activeSnapshotIds = {}; // { instanceId: [snapIdA, snapIdB] } for diff

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
  const btn = document.getElementById('btn-account');
  if (!btn) return;
  const name = isLoggedIn() ? (getUsername() || '用户') : getDemoDisplayName();
  btn.textContent = `欢迎回来，${name}`;
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
}

// ============================================================
// Page: 我的实例
// ============================================================
function renderInstances() {
  backPage = null;
  const list = getSortedInstances();
  const cards = list.map((inst) => {
    const mp = getModpack(inst.boundModpackId);
    const summary = getInstanceAssetSummary(inst);
    const pending = getPendingUpdateCount(inst.id);

    const hasNote = !!(inst.note && inst.note.trim());

    return `
      <article class="instance-card${inst.favorited ? ' instance-card-fav' : ''}" data-instance="${inst.id}">
        <button type="button" class="inst-fav-btn${inst.favorited ? ' fav-active' : ''}" data-inst-fav="${inst.id}" aria-label="${inst.favorited ? '取消收藏' : '收藏实例'}" title="${inst.favorited ? '取消收藏' : '收藏'}">${inst.favorited ? '★' : '☆'}</button>

        <div class="instance-card-head">
          <h3 class="instance-card-title">${escapeHtml(inst.name)}</h3>
          ${pending > 0 ? `<span class="inst-badge badge-update">${pending} 项更新</span>` : ''}
        </div>

        <div class="instance-tags">
          <span class="inst-tag">${inst.minecraftVersion}</span>
          <span class="inst-tag">${inst.loaderType} ${inst.loaderVersion}</span>
          <span class="inst-tag">Java ${inst.javaVersion}</span>
        </div>

        <div class="instance-card-stats" aria-label="资产数量">
          <div class="inst-stat">
            <span class="inst-stat-num">${summary?.modCount || 0}</span>
            <span class="inst-stat-label">模组</span>
          </div>
          <div class="inst-stat-divider" aria-hidden="true"></div>
          <div class="inst-stat">
            <span class="inst-stat-num">${summary?.rpCount || 0}</span>
            <span class="inst-stat-label">资源包</span>
          </div>
          <div class="inst-stat-divider" aria-hidden="true"></div>
          <div class="inst-stat">
            <span class="inst-stat-num">${summary?.spCount || 0}</span>
            <span class="inst-stat-label">光影</span>
          </div>
        </div>

        <div class="instance-card-modpack">
          <span class="inst-mp-icon" aria-hidden="true">📦</span>
          <span class="inst-mp-name">${mp ? `${escapeHtml(mp.name)} v${mp.version}` : '无绑定整合包'}</span>
          ${mp?.sourcePlatform ? `<span class="inst-mp-platform">${mp.sourcePlatform}</span>` : ''}
        </div>

        <div class="instance-card-note${hasNote ? '' : ' hidden'}" data-no-nav>
          <span class="inst-note-icon" aria-hidden="true">✎</span>
          <input id="note-${inst.id}" type="text" class="inst-note-input" data-inst-note="${inst.id}" value="${escapeHtml(inst.note || '')}" placeholder="为这个实例添加备注…" maxlength="120" autocomplete="off">
        </div>

        <footer class="instance-card-foot">
          <span class="inst-foot-item">🕐 ${summary?.lastLaunch ? summary.lastLaunch.slice(5, 16) : '暂无启动记录'}</span>
          <span class="inst-foot-item">⏱️ ${formatDuration(summary?.totalMs || 0)}</span>
          ${hasNote ? '' : `<button type="button" class="inst-note-add" data-note-add="${inst.id}" data-no-nav>✎ 添加备注</button>`}
          <span class="inst-foot-hint">点击进入详情 →</span>
        </footer>
      </article>`;
  }).join('');

  return `
    <div class="instances-page">
      <header class="instances-header">
        <p class="page-desc">每个游戏实例独立追踪。可收藏常用实例、添加备注，点击进入查看资产与变更。</p>
        <span class="instances-count">${list.length} 个实例</span>
      </header>
      ${list.length ? `<div class="instances-grid">${cards}</div>` : '<p class="empty-state">暂无实例。安装 Block Snap 客户端模组后启动游戏即可自动创建。</p>'}
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
          <h2>${inst.name}</h2>
          <div class="instance-tags">
            <span class="inst-tag">${inst.minecraftVersion}</span>
            <span class="inst-tag">${inst.loaderType} ${inst.loaderVersion}</span>
            <span class="inst-tag">Java ${inst.javaVersion}</span>
            <span class="inst-tag">${inst.ramAllocated}</span>
          </div>
          <p class="inst-mp">📦 整合包：${mp ? `${mp.name} v${mp.version}` : '无'} · 创建于 ${inst.createdAt}</p>
        </div>
        <div class="detail-hero-right">
          <button class="btn btn-primary btn-sm" data-action="view-diff">查看最新变更</button>
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

function renderAssetTable(category, assets, instance) {
  const active = assets.filter((a) => !a.isDelete);
  const deleted = assets.filter((a) => a.isDelete);

  if (!active.length && !deleted.length) {
    return '<p class="empty-hint">暂无数据</p>';
  }

  const isMod = category === 'mods';
  const isConfig = category === 'configs';

  function verCell(a) {
    if (isConfig) return '<td class="mono muted">—</td>';
    const notLatest = a.latestVersion && a.latestVersion !== a.version;
    if (notLatest) {
      return `<td><span class="mono ver-outdated">${a.version}</span><span class="ver-hint">新版本 ${a.latestVersion}</span></td>`;
    }
    return `<td><span class="mono ver-ok">${a.version}</span>${a.latestVersion ? '<span class="ver-hint latest">已最新</span>' : ''}</td>`;
  }

  return `
    <table class="asset-table">
      <thead>
        <tr>
          <th style="width:20%">名称</th>
          <th style="width:14%">当前版本</th>
          <th style="width:11%">添加时间</th>
          <th style="width:11%">更新时间</th>
          ${isMod ? '<th style="width:8%">加载耗时</th>' : ''}
          <th style="width:14%">备注</th>
          <th style="width:6%">状态</th>
          <th style="width:5%">收藏</th>
        </tr>
      </thead>
      <tbody>
        ${active.map((a) => `
          <tr class="${a.slow ? 'row-slow' : ''}">
            <td><strong>${a.name || a.relativePath}</strong></td>
            ${verCell(a)}
            <td class="muted mono" style="font-size:0.76rem">${formatDateTime(a.addedTime)}</td>
            <td class="muted mono" style="font-size:0.76rem">${formatDateTime(a.updateTime)}</td>
            ${isMod ? `<td class="mono">${a.loadTimeMs ? formatMs(a.loadTimeMs) : '-'}</td>` : ''}
            <td class="muted">${a.note || '-'}</td>
            <td><span class="status-tag active">活跃</span></td>
            <td><button class="fav-btn ${a.favorited ? 'fav-active' : ''}" data-fav="${a.id || a.relativePath}" data-fav-cat="${category}" data-fav-inst="${instance.id}">${a.favorited ? '⭐' : '☆'}</button></td>
          </tr>`).join('')}
        ${deleted.map((a) => `
          <tr class="row-deleted">
            <td><strong>${a.name}</strong></td>
            <td class="mono">${a.version}</td>
            <td class="muted mono" style="font-size:0.76rem">${formatDateTime(a.addedTime)}</td>
            <td class="muted mono" style="font-size:0.76rem">${formatDateTime(a.updateTime)}</td>
            ${isMod ? '<td class="mono">-</td>' : ''}
            <td class="muted">${a.note || '-'}</td>
            <td><span class="status-tag deleted">已移除</span></td>
            <td></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
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
              <button type="submit" class="btn btn-primary">验证</button>
            </form>
          </section>
          <section class="settings-section">
            <h3>修改密码</h3>
            <form id="form-password" class="settings-form">
              <label><span>原密码</span><input name="oldPassword" type="password" required /></label>
              <label><span>新密码</span><input name="newPassword" type="password" required /></label>
              <label><span>确认</span><input name="confirmNewPassword" type="password" required /></label>
              <button type="submit" class="btn btn-primary">修改</button>
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
            <button type="submit" class="btn btn-primary">绑定</button>
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
      activeInstanceId = card.dataset.instance;
      navigateTo('instance-detail', { id: card.dataset.instance });
    });
  });

  // Instance favorite
  root.querySelectorAll('[data-inst-fav]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.instFav;
      const favorited = toggleInstanceFavorite(id);
      btn.textContent = favorited ? '⭐' : '☆';
      btn.classList.toggle('fav-active', favorited);
      btn.setAttribute('aria-label', favorited ? '取消收藏' : '收藏实例');
      btn.title = favorited ? '取消收藏' : '收藏';
      const card = btn.closest('.instance-card');
      card?.classList.toggle('instance-card-fav', favorited);
      showToast(favorited ? '已加入收藏' : '已取消收藏');
      // 收藏后重排列表
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
    input.addEventListener('blur', () => {
      const id = input.dataset.instNote;
      const inst = getInstance(id);
      if (!inst) return;
      const prev = inst.note || '';
      const next = input.value.trim();
      if (next === prev) {
        // 没有内容也没有改动：恢复为"添加备注"入口
        if (!next && currentPage === 'instances') { renderPage(); bindPageEvents(); }
        return;
      }
      setInstanceNote(id, next);
      showToast(next ? '备注已保存' : '备注已清空');
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

  // Favorite toggle
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
        enterApp();
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
  showToast('已退出');
  enterLanding();
}

function setupApp() {
  // Landing page demo buttons
  document.querySelectorAll('[data-demo="report"]').forEach((btn) => {
    btn.addEventListener('click', () => enterApp());
  });

  document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  document.getElementById('btn-account').addEventListener('click', () => {
    if (isLoggedIn()) navigateTo('settings');
    else openAuthModal('login');
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
  });
}

// ============================================================
// Init
// ============================================================
function init() {
  setupAuth();
  setupApp();

  if (isLoggedIn()) {
    enterApp();
  } else {
    enterLanding();
  }
}

init();
