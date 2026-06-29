// ============================================================
// Block Snap — Mock Data (v2: Instance-centric model)
// 对齐核心结构设计：Account → Instance → Snapshot → Assets
// ============================================================

// ── 资产类别元数据 ──
export const CATEGORY_META = {
  mod:      { label: '模组',     icon: '🧩', color: '#7CB342' },
  resource: { label: '资源包',   icon: '🪵', color: '#42A5F5' },
  shader:   { label: '光影包',   icon: '☄',  color: '#AB47BC' },
  config:   { label: '配置文件', icon: '📜', color: '#FFB74D' },
  modpack:  { label: '整合包',   icon: '📦', color: '#FF9800' },
};

// ── 变更类型 ──
export const CHANGE_TYPE = {
  ADD:    { label: '新增', icon: '➕', cls: 'diff-add' },
  REMOVE: { label: '移除', icon: '➖', cls: 'diff-remove' },
  UPDATE: { label: '版本变更', icon: '🔄', cls: 'diff-update' },
};

// ── 风险等级 ──
export const RISK_LEVEL = {
  SAFE:    { label: '安全', color: '#7CB342', icon: '🟢' },
  CAUTION: { label: '需关注', color: '#FFB74D', icon: '🟡' },
  DANGER:  { label: '破坏性变更', color: '#EF5350', icon: '🔴' },
};

// 平台更新中定义的各资产最新版本
const LATEST_VERSION_MAP = {
  mod: {
    'sodium': '0.6.0', 'lithium': '0.12.0', 'iris': '1.7.3',
    'fabric-api': '0.100.8', 'modmenu': '11.0.1', 'create': '0.6.0',
    'jei': '15.12.0', 'journeymap': '5.10.3', 'cloth-config': '13.0.138',
    'appleskin': '2.5.1', 'xaeros-minimap': '24.2.0',
    'cobblemon': '1.6.0', 'biomes-o-plenty': '18.1.0',
  },
  resource: {
    'Fresh Animations': '1.10.0', 'Default Dark Mode': '3.9.4',
    'Cobblemon RP': '1.5', 'Cobblemon 3D Models': '2.1',
  },
  shader: {
    'BSL Shaders': '8.2.09', 'Complementary Reimagined': '5.3.0', 'MakeUp Ultra Fast': '9.2',
  },
};

// 收藏预设
const FAVORITED_PRESET = {
  mod: ['create', 'sodium', 'cobblemon'],
  resource: ['Fresh Animations'],
  shader: ['BSL Shaders'],
};

// 为资产注入 latestVersion 和 favorited 字段
function enrichAsset(asset, category) {
  const catKey = category === 'mods' ? 'mod' : category === 'resourcePacks' ? 'resource' : category === 'shaderPacks' ? 'shader' : null;
  if (!catKey) return asset;
  const verMap = LATEST_VERSION_MAP[catKey] || {};
  const favSet = new Set(FAVORITED_PRESET[catKey] || []);
  const latestVersion = verMap[asset.name] || null;
  return {
    ...asset,
    latestVersion,
    favorited: favSet.has(asset.name),
    // Back-end field: true => there is a newer version available (i.e. "可更新")
    IsNewVersion: latestVersion != null ? latestVersion !== asset.version : false,
  };
}

// ============================================================
// 整合包定义
// ============================================================
export const MODPACKS = {
  'mp-vanilla-plus': {
    id: 'mp-vanilla-plus',
    name: '原版+ 轻量包',
    version: '3.0.0',
    sourcePlatform: 'CURSEFORGE',
    description: '以原版体验为基础，加入 Create、JourneyMap 等轻量模组，适合长期生存。',
    manifest: [
      { modId: 'sodium', version: '0.5.11' },
      { modId: 'lithium', version: '0.11.3' },
      { modId: 'iris', version: '1.7.2' },
      { modId: 'fabric-api', version: '0.100.8' },
      { modId: 'modmenu', version: '11.0.1' },
      { modId: 'create', version: '0.5.1f' },
      { modId: 'jei', version: '15.12.0' },
      { modId: 'journeymap', version: '5.10.1' },
      { modId: 'cloth-config', version: '13.0.138' },
      { modId: 'appleskin', version: '2.5.1' },
      { modId: 'xaeros-minimap', version: '24.2.0' },
    ],
    resourcePacks: [
      { name: 'Fresh Animations', version: '1.9.2' },
      { name: 'Default Dark Mode', version: '3.9.4' },
    ],
    shaderPacks: [
      { name: 'BSL Shaders', version: '8.2.07' },
    ],
  },
  'mp-cobblemon': {
    id: 'mp-cobblemon',
    name: 'Cobblemon 冒险包',
    version: '1.4.0',
    sourcePlatform: 'MODRINTH',
    description: '以宝可梦模组 Cobblemon 为核心，加入生态群系与探索内容。',
    manifest: [
      { modId: 'cobblemon', version: '1.5.2' },
      { modId: 'biomes-o-plenty', version: '18.0.0' },
      { modId: 'sodium', version: '0.5.11' },
      { modId: 'fabric-api', version: '0.92.2' },
      { modId: 'jei', version: '15.12.0' },
      { modId: 'journeymap', version: '5.10.1' },
    ],
    resourcePacks: [
      { name: 'Cobblemon RP', version: '1.4' },
    ],
    shaderPacks: [
      { name: 'MakeUp Ultra Fast', version: '9.1' },
    ],
  },
};

// ============================================================
// 游戏实例 + 快照
// ============================================================
export const INSTANCES = [
  {
    id: 'inst-001',
    name: 'Spark · 生存主世界',
    favorited: true,
    note: '周末开荒 · 长期生存',
    minecraftVersion: '1.21.1',
    loaderType: 'Fabric',
    loaderVersion: '0.16.5',
    javaVersion: '21.0.2',
    ramAllocated: '6 GB',
    createdAt: '2026-05-10',
    boundModpackId: 'mp-vanilla-plus',
    snapshots: [
      {
        id: 'snap-001a',
        timestamp: '2026-06-08 19:42:18',
        gameReadyMs: 42100,
        totalMs: 38420,
        assets: {
          mods: [
            { id: 'sodium',        name: 'Sodium',           version: '0.5.11',  addedTime: '2026-05-30', updateTime: '2026-06-07', note: '', isDeleted: false, fileHash: 'h001', fileSize: 890240, loadTimeMs: 820,  sourcePlatform: 'MODRINTH',  projectId: 'sodium' },
            { id: 'lithium',       name: 'Lithium',          version: '0.11.3',  addedTime: '2026-05-30', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h002', fileSize: 720400, loadTimeMs: 640,  sourcePlatform: 'MODRINTH',  projectId: 'lithium' },
            { id: 'iris',          name: 'Iris',             version: '1.7.2',   addedTime: '2026-05-30', updateTime: '2026-06-07', note: '需配合 Sodium 使用', isDeleted: false, fileHash: 'h003', fileSize: 2100500, loadTimeMs: 1120, sourcePlatform: 'MODRINTH',  projectId: 'iris' },
            { id: 'fabric-api',    name: 'Fabric API',       version: '0.100.8', addedTime: '2026-05-30', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h004', fileSize: 1950300, loadTimeMs: 980,  sourcePlatform: 'MODRINTH',  projectId: 'fabric-api' },
            { id: 'modmenu',       name: 'Mod Menu',         version: '11.0.1',  addedTime: '2026-05-30', updateTime: '2026-05-30', note: '', isDeleted: false, fileHash: 'h005', fileSize: 540200,  loadTimeMs: 310,  sourcePlatform: 'MODRINTH',  projectId: 'modmenu' },
            { id: 'create',        name: 'Create',           version: '0.5.1f',  addedTime: '2026-05-15', updateTime: '2026-06-07', note: '机械动力核心', isDeleted: false, fileHash: 'h006', fileSize: 12800400, loadTimeMs: 4280, sourcePlatform: 'CURSEFORGE', projectId: 'create',   slow: true },
            { id: 'jei',           name: 'JEI',              version: '15.12.0', addedTime: '2026-05-30', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h007', fileSize: 980300,  loadTimeMs: 1560, sourcePlatform: 'CURSEFORGE', projectId: 'jei' },
            { id: 'journeymap',    name: 'JourneyMap',       version: '5.10.1',  addedTime: '2026-05-20', updateTime: '2026-06-07', note: '', isDeleted: false, fileHash: 'h008', fileSize: 4200100, loadTimeMs: 2340, sourcePlatform: 'CURSEFORGE', projectId: 'journeymap', slow: true },
            { id: 'cloth-config',  name: 'Cloth Config',     version: '13.0.138',addedTime: '2026-05-30', updateTime: '2026-05-30', note: '', isDeleted: false, fileHash: 'h009', fileSize: 640100,  loadTimeMs: 420,  sourcePlatform: 'MODRINTH',  projectId: 'cloth-config' },
            { id: 'appleskin',     name: 'AppleSkin',        version: '2.5.1',   addedTime: '2026-06-05', updateTime: '2026-06-05', note: '', isDeleted: false, fileHash: 'h010', fileSize: 180200,  loadTimeMs: 180,  sourcePlatform: 'MODRINTH',  projectId: 'appleskin' },
            { id: 'xaeros-minimap',name: 'Xaero\'s Minimap',  version: '24.2.0',  addedTime: '2026-05-30', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h011', fileSize: 780300,  loadTimeMs: 1890, sourcePlatform: 'CURSEFORGE', projectId: 'xaero-minimap' },
            { id: 'optifine',      name: 'OptiFine',         version: 'HD_U_G5', addedTime: '2026-04-10', updateTime: '2026-05-30', note: '已移除，与 Sodium 冲突', isDeleted: true, fileHash: 'h012_del', fileSize: 2100400, loadTimeMs: 0, sourcePlatform: 'CURSEFORGE', projectId: 'optifine' },
          ],
          resourcePacks: [
            { id: 'rp-fresh',      name: 'Fresh Animations',  version: '1.9.2', packFormat: 15, addedTime: '2026-05-29', updateTime: '2026-06-07', note: '', isDeleted: false, fileHash: 'rh001', fileSize: 8400200,  sourcePlatform: 'MODRINTH' },
            { id: 'rp-dark',       name: 'Default Dark Mode',  version: '3.9.4', packFormat: 15, addedTime: '2026-05-18', updateTime: '2026-06-01', note: '深色主题覆盖', isDeleted: false, fileHash: 'rh002', fileSize: 1200300, sourcePlatform: 'CURSEFORGE' },
          ],
          shaderPacks: [
            { id: 'sp-bsl',        name: 'BSL Shaders',       version: '8.2.07', addedTime: '2026-05-28', updateTime: '2026-06-08', note: '已配置低延迟模式', isDeleted: false, fileHash: 'sh001', fileSize: 3200400, shaderLoader: 'IRIS', sourcePlatform: 'CURSEFORGE' },
          ],
          configs: [
            { relativePath: 'config/sodium-options.json',   fileHash: 'abc123_v3',  format: 'json', associatedModId: 'sodium',       fileSize: 2400, addedTime: '2026-05-30', updateTime: '2026-06-07' },
            { relativePath: 'config/iris.properties',       fileHash: 'ghi456_v1',  format: 'properties', associatedModId: 'iris',    fileSize: 800,  addedTime: '2026-05-30', updateTime: '2026-06-07' },
            { relativePath: 'config/create-client.toml',    fileHash: 'mno789_v2',  format: 'toml', associatedModId: 'create',        fileSize: 3400, addedTime: '2026-05-15', updateTime: '2026-06-07' },
            { relativePath: 'config/journeymap.json',       fileHash: 'stu012_v3',  format: 'json', associatedModId: 'journeymap',    fileSize: 1800, addedTime: '2026-05-20', updateTime: '2026-06-07' },
            { relativePath: 'config/jei-client.ini',        fileHash: 'yza345_v1',  format: 'ini',  associatedModId: 'jei',           fileSize: 600,  addedTime: '2026-05-30', updateTime: '2026-06-01' },
            { relativePath: 'config/cloth-config.json',     fileHash: 'cfg_cloth',  format: 'json', associatedModId: 'cloth-config',  fileSize: 1200, addedTime: '2026-05-30', updateTime: '2026-05-30' },
            { relativePath: 'config/appleskin.properties',   fileHash: 'cfg_apple', format: 'properties', associatedModId: 'appleskin', fileSize: 400, addedTime: '2026-06-05', updateTime: '2026-06-05' },
          ],
        },
      },
      {
        id: 'snap-001b',
        timestamp: '2026-06-07 21:15:03',
        gameReadyMs: 38900,
        totalMs: 35100,
        assets: {
          mods: [
            { id: 'sodium',       name: 'Sodium',          version: '0.5.11',  addedTime: '2026-05-30', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h001', fileSize: 890240, loadTimeMs: 790, sourcePlatform: 'MODRINTH', projectId: 'sodium' },
            { id: 'create',       name: 'Create',          version: '0.5.1f',   addedTime: '2026-05-15', updateTime: '2026-06-07', note: '机械动力核心', isDeleted: false, fileHash: 'h006', fileSize: 12800400, loadTimeMs: 4010, sourcePlatform: 'CURSEFORGE', projectId: 'create', slow: true },
            { id: 'journeymap',   name: 'JourneyMap',      version: '5.10.0',   addedTime: '2026-05-20', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h008_old', fileSize: 4100100, loadTimeMs: 2180, sourcePlatform: 'CURSEFORGE', projectId: 'journeymap', slow: true },
            { id: 'jei',          name: 'JEI',             version: '15.12.0',  addedTime: '2026-05-30', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h007', fileSize: 980300, loadTimeMs: 1520, sourcePlatform: 'CURSEFORGE', projectId: 'jei' },
            { id: 'optifine',     name: 'OptiFine',        version: 'HD_U_G5',  addedTime: '2026-04-10', updateTime: '2026-05-30', note: '已移除', isDeleted: false, fileHash: 'h012', fileSize: 2100400, loadTimeMs: 3800, sourcePlatform: 'CURSEFORGE', projectId: 'optifine', slow: true },
            { id: 'appleskin',    name: 'AppleSkin',       version: '2.5.0',    addedTime: '2026-06-05', updateTime: '2026-06-05', note: '', isDeleted: false, fileHash: 'h010_old', fileSize: 175000, loadTimeMs: 170, sourcePlatform: 'MODRINTH', projectId: 'appleskin' },
          ],
          resourcePacks: [
            { id: 'rp-fresh',     name: 'Fresh Animations', version: '1.9.1', packFormat: 14, addedTime: '2026-05-29', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'rh001_old', fileSize: 8300100, sourcePlatform: 'MODRINTH' },
          ],
          shaderPacks: [
            { id: 'sp-bsl',       name: 'BSL Shaders',      version: '8.2.06', addedTime: '2026-05-28', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'sh001_old', fileSize: 3100100, shaderLoader: 'IRIS', sourcePlatform: 'CURSEFORGE' },
          ],
          configs: [
            { relativePath: 'config/sodium-options.json',  fileHash: 'abc123_v2', format: 'json',  associatedModId: 'sodium',    fileSize: 2300, addedTime: '2026-05-30', updateTime: '2026-06-01' },
            { relativePath: 'config/create-client.toml',   fileHash: 'mno789_v1', format: 'toml',  associatedModId: 'create',    fileSize: 3200, addedTime: '2026-05-15', updateTime: '2026-06-01' },
          ],
        },
      },
      {
        id: 'snap-001c',
        timestamp: '2026-06-01 10:05:12',
        gameReadyMs: 40200,
        totalMs: 36800,
        assets: {
          mods: [
            { id: 'sodium',      name: 'Sodium',         version: '0.5.10', addedTime: '2026-05-30', updateTime: '2026-05-30', note: '', isDeleted: false, fileHash: 'h001_old2', fileSize: 880240, loadTimeMs: 860, sourcePlatform: 'MODRINTH', projectId: 'sodium' },
            { id: 'create',      name: 'Create',         version: '0.5.1f',  addedTime: '2026-05-15', updateTime: '2026-05-15', note: '机械动力核心', isDeleted: false, fileHash: 'h006', fileSize: 12800400, loadTimeMs: 4150, sourcePlatform: 'CURSEFORGE', projectId: 'create', slow: true },
            { id: 'optifine',    name: 'OptiFine',       version: 'HD_U_G5', addedTime: '2026-04-10', updateTime: '2026-04-10', note: '', isDeleted: false, fileHash: 'h012', fileSize: 2100400, loadTimeMs: 4200, sourcePlatform: 'CURSEFORGE', projectId: 'optifine', slow: true },
            { id: 'journeymap',  name: 'JourneyMap',     version: '5.9.3',   addedTime: '2026-05-20', updateTime: '2026-05-20', note: '', isDeleted: false, fileHash: 'h008_v1', fileSize: 4000100, loadTimeMs: 2250, sourcePlatform: 'CURSEFORGE', projectId: 'journeymap', slow: true },
          ],
          resourcePacks: [
            { id: 'rp-fresh',    name: 'Fresh Animations', version: '1.8.0', packFormat: 12, addedTime: '2026-05-29', updateTime: '2026-05-29', note: '', isDeleted: false, fileHash: 'rh001_v1', fileSize: 8100100, sourcePlatform: 'MODRINTH' },
          ],
          shaderPacks: [
            { id: 'sp-comp',     name: 'Complementary Reimagined', version: '5.2.1', addedTime: '2026-05-20', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'sh002', fileSize: 4500100, shaderLoader: 'IRIS', sourcePlatform: 'CURSEFORGE' },
          ],
          configs: [
            { relativePath: 'config/sodium-options.json',  fileHash: 'abc123_v1', format: 'json',  associatedModId: 'sodium',    fileSize: 2100, addedTime: '2026-05-30', updateTime: '2026-05-30' },
            { relativePath: 'config/iris.properties',      fileHash: 'ghi456_v1', format: 'properties', associatedModId: 'iris', fileSize: 800,  addedTime: '2026-05-30', updateTime: '2026-05-30' },
          ],
        },
      },
    ],
  },
  {
    id: 'inst-002',
    name: '腐竹测试服 · 客户端',
    favorited: false,
    note: '',
    minecraftVersion: '1.20.1',
    loaderType: 'Fabric',
    loaderVersion: '0.15.11',
    javaVersion: '17.0.9',
    ramAllocated: '8 GB',
    createdAt: '2026-06-01',
    boundModpackId: 'mp-cobblemon',
    snapshots: [
      {
        id: 'snap-002a',
        timestamp: '2026-06-05 14:28:44',
        gameReadyMs: 74800,
        totalMs: 68200,
        assets: {
          mods: [
            { id: 'cobblemon',         name: 'Cobblemon',           version: '1.5.2',   addedTime: '2026-06-01', updateTime: '2026-06-05', note: '核心宝可梦模组', isDeleted: false, fileHash: 'h101', fileSize: 28400100, loadTimeMs: 8920, sourcePlatform: 'MODRINTH', projectId: 'cobblemon', slow: true },
            { id: 'biomes-o-plenty',   name: 'Biomes O\' Plenty',   version: '18.0.0',   addedTime: '2026-06-01', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h102', fileSize: 15200300, loadTimeMs: 5640, sourcePlatform: 'CURSEFORGE', projectId: 'biomes-o-plenty', slow: true },
            { id: 'sodium',            name: 'Sodium',              version: '0.5.11',   addedTime: '2026-06-01', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h103', fileSize: 890240,   loadTimeMs: 910,  sourcePlatform: 'MODRINTH', projectId: 'sodium' },
            { id: 'fabric-api',        name: 'Fabric API',          version: '0.92.2',   addedTime: '2026-06-01', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h104', fileSize: 1900400,  loadTimeMs: 1020, sourcePlatform: 'MODRINTH', projectId: 'fabric-api' },
            { id: 'jei',               name: 'JEI',                 version: '15.12.0',  addedTime: '2026-06-01', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h105', fileSize: 980300,   loadTimeMs: 1480, sourcePlatform: 'CURSEFORGE', projectId: 'jei' },
            { id: 'journeymap',        name: 'JourneyMap',          version: '5.10.1',   addedTime: '2026-06-01', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'h106', fileSize: 4200100,  loadTimeMs: 2180, sourcePlatform: 'CURSEFORGE', projectId: 'journeymap' },
          ],
          resourcePacks: [
            { id: 'rp-cobble',    name: 'Cobblemon RP',         version: '1.4',   packFormat: 12, addedTime: '2026-06-01', updateTime: '2026-06-05', note: '', isDeleted: false, fileHash: 'rh101', fileSize: 48001200, sourcePlatform: 'MODRINTH' },
            { id: 'rp-3d',        name: 'Cobblemon 3D Models',  version: '2.1',   packFormat: 12, addedTime: '2026-06-01', updateTime: '2026-06-01', note: '', isDeleted: false, fileHash: 'rh102', fileSize: 92001000, sourcePlatform: 'CURSEFORGE' },
          ],
          shaderPacks: [
            { id: 'sp-makeup',    name: 'MakeUp Ultra Fast',    version: '9.1',   addedTime: '2026-06-01', updateTime: '2026-06-05', note: '', isDeleted: false, fileHash: 'sh101', fileSize: 2800400, shaderLoader: 'IRIS', sourcePlatform: 'MODRINTH' },
          ],
          configs: [
            { relativePath: 'config/cobblemon/main.json',           fileHash: 'cfg001', format: 'json', associatedModId: 'cobblemon',       fileSize: 5600, addedTime: '2026-06-01', updateTime: '2026-06-05' },
            { relativePath: 'config/biomesoplenty/generation.toml', fileHash: 'cfg002', format: 'toml', associatedModId: 'biomes-o-plenty', fileSize: 3200, addedTime: '2026-06-01', updateTime: '2026-06-01' },
            { relativePath: 'config/sodium-options.json',            fileHash: 'cfg003', format: 'json', associatedModId: 'sodium',          fileSize: 2200, addedTime: '2026-06-01', updateTime: '2026-06-01' },
          ],
        },
      },
    ],
  },
];

// ── 为所有快照中的资产注入 latestVersion + favorited ──
INSTANCES.forEach((inst) => {
  inst.snapshots.forEach((snap) => {
    ['mods', 'resourcePacks', 'shaderPacks'].forEach((cat) => {
      if (snap.assets[cat]) {
        snap.assets[cat] = snap.assets[cat].map((a) => enrichAsset(a, cat));
      }
    });
  });
});

// ============================================================
// 平台更新信息 (版本更新内容板块)
// ============================================================
export const PLATFORM_UPDATES = [
  {
    id: 'upd-001',
    assetType: 'mod',
    assetName: 'Create',
    assetIcon: '🧩',
    currentVersion: '0.5.1f',
    latestVersion: '0.6.0',
    releaseDate: '2026-06-10',
    severity: 'DANGER',
    isBreaking: true,
    changelog: '完全重写了传动系统 API，旧的 stress 单位计算方式已废弃。所有附属模组需要更新至兼容版本。新增蒸汽引擎与电力网络系统。',
    sourcePlatform: 'CURSEFORGE',
    affectedInstances: ['inst-001'],
    versionGap: 2, // 落后 2 个大版本 (0.5.1 → 0.6.0 中间可能有 0.5.2)
  },
  {
    id: 'upd-002',
    assetType: 'mod',
    assetName: 'JourneyMap',
    assetIcon: '🧩',
    currentVersion: '5.10.1',
    latestVersion: '5.10.3',
    releaseDate: '2026-06-09',
    severity: 'SAFE',
    isBreaking: false,
    changelog: '修复了小地图在高分辨率下的渲染偏移问题。优化了区块缓存策略，减少内存占用。',
    sourcePlatform: 'CURSEFORGE',
    affectedInstances: ['inst-001', 'inst-002'],
    versionGap: 0,
  },
  {
    id: 'upd-003',
    assetType: 'resource',
    assetName: 'Fresh Animations',
    assetIcon: '🪵',
    currentVersion: '1.9.2',
    latestVersion: '1.10.0',
    releaseDate: '2026-06-08',
    severity: 'CAUTION',
    isBreaking: false,
    changelog: '新增 12 种生物的动画重制，包括狼、猫、马。Pack Format 升级至 18，需要 MC 1.21+。',
    sourcePlatform: 'MODRINTH',
    affectedInstances: ['inst-001'],
    versionGap: 0,
  },
  {
    id: 'upd-004',
    assetType: 'shader',
    assetName: 'BSL Shaders',
    assetIcon: '☄',
    currentVersion: '8.2.07',
    latestVersion: '8.2.09',
    releaseDate: '2026-06-07',
    severity: 'SAFE',
    isBreaking: false,
    changelog: '改进了水面反射的色温计算。修复了 Iris 1.7.2 下的兼容性问题。',
    sourcePlatform: 'CURSEFORGE',
    affectedInstances: ['inst-001'],
    versionGap: 0,
  },
  {
    id: 'upd-005',
    assetType: 'mod',
    assetName: 'Cobblemon',
    assetIcon: '🧩',
    currentVersion: '1.5.2',
    latestVersion: '1.6.0',
    releaseDate: '2026-06-12',
    severity: 'DANGER',
    isBreaking: true,
    changelog: '新增第 9 代宝可梦。战斗系统重写，旧的 NPC 训练家数据格式已变更，需要手动迁移。与 Biomes O\' Plenty 18.0.0 存在已知冲突，请等待 Biomes O\' Plenty 18.1.0。',
    sourcePlatform: 'MODRINTH',
    affectedInstances: ['inst-002'],
    versionGap: 3,
  },
  {
    id: 'upd-006',
    assetType: 'mod',
    assetName: 'Iris',
    assetIcon: '🧩',
    currentVersion: '1.7.2',
    latestVersion: '1.7.3',
    releaseDate: '2026-06-06',
    severity: 'SAFE',
    isBreaking: false,
    changelog: '修复了特定 AMD 显卡下的着色器编译错误。优化了光影包切换时的资源释放。',
    sourcePlatform: 'MODRINTH',
    affectedInstances: ['inst-001'],
    versionGap: 0,
  },
  {
    id: 'upd-007',
    assetType: 'mod',
    assetName: 'Fabric API',
    assetIcon: '🧩',
    currentVersion: '0.92.2',
    latestVersion: '0.100.8',
    releaseDate: '2026-05-25',
    severity: 'CAUTION',
    isBreaking: true,
    changelog: '多个 API 模块进行了弃用标记，包括 Rendering API v1 的部分方法。建议所有依赖模组升级后再更新 Fabric API。',
    sourcePlatform: 'MODRINTH',
    affectedInstances: ['inst-002'],
    versionGap: 5,
  },
  {
    id: 'upd-008',
    assetType: 'modpack',
    assetName: '原版+ 轻量包',
    assetIcon: '📦',
    currentVersion: '3.0.0',
    latestVersion: '3.0.1',
    releaseDate: '2026-06-11',
    severity: 'SAFE',
    isBreaking: false,
    changelog: '修复若干兼容性问题，优化资源包加载顺序，补充客户端提示文案。新增 AppleSkin 模组。',
    sourcePlatform: 'CURSEFORGE',
    affectedInstances: ['inst-001'],
    versionGap: 0,
  },
];

// ============================================================
// MC 大事件
// ============================================================
export const MC_EVENTS = [
  {
    id: 'evt-001',
    title: 'Minecraft 1.21.2 正式版发布',
    category: 'VERSION_RELEASE',
    severity: 'INFO',
    publishTime: '2026-06-14',
    content: 'Mojang 发布了 Minecraft Java Edition 1.21.2 "Bundles of Bravery" 正式版。主要改动包括：收纳袋正式实装、新的试炼密室变体、24 种新增方块。Forge 与 Fabric 加载器预计在 1-2 周内完成适配。',
    affectedVersions: ['1.21.2'],
    relatedUrl: 'https://www.minecraft.net',
    icon: '🎮',
  },
  {
    id: 'evt-002',
    title: 'Forge 51.0.0 开发版发布 — API 破坏性变更',
    category: 'LOADER_UPDATE',
    severity: 'WARNING',
    publishTime: '2026-06-12',
    content: 'Forge 51.0.0 开发版已发布，针对 MC 1.21.2 进行了适配。本次更新包含渲染管线的重大重构，旧版 CoreMod 可能无法正常工作。建议模组开发者在正式版发布前检查兼容性。',
    affectedVersions: ['1.21.2'],
    relatedUrl: 'https://files.minecraftforge.net',
    icon: '🔧',
  },
  {
    id: 'evt-003',
    title: 'CurseForge API 策略变更 — 频率限制收紧',
    category: 'PLATFORM_POLICY',
    severity: 'WARNING',
    publishTime: '2026-06-08',
    content: 'CurseForge 宣布将于 2026 年 7 月起对第三方 API 请求实施更严格的频率限制：未认证请求从 500/小时降至 100/小时，已认证请求从 5000/小时降至 2000/小时。Block Snap 的爬虫服务已适配新限制。',
    affectedVersions: [],
    relatedUrl: 'https://support.curseforge.com',
    icon: '📢',
  },
  {
    id: 'evt-004',
    title: '关键安全漏洞 CVE-2026-1234 — 影响 MC 1.19-1.21 所有版本',
    category: 'SECURITY',
    severity: 'CRITICAL',
    publishTime: '2026-06-05',
    content: '在 Minecraft 的网络协议层发现一个远程代码执行漏洞 (RCE)，CVSS 评分 9.8。影响 1.19 至 1.21 的所有原版与模组客户端。强烈建议立即安装安全补丁模组 "NetShield" v1.0+，或等待 Mojang 官方热修复。',
    affectedVersions: ['1.19', '1.20', '1.20.1', '1.20.4', '1.21', '1.21.1'],
    relatedUrl: 'https://nvd.nist.gov',
    icon: '🛡️',
  },
  {
    id: 'evt-005',
    title: 'Sodium 0.6.0 里程碑版本发布 — 渲染架构重构',
    category: 'MOD_MILESTONE',
    severity: 'INFO',
    publishTime: '2026-06-03',
    content: 'Sodium 0.6.0 正式版发布，引入了全新的区块渲染架构，在大型整合包中可减少 40% 的显存占用。此版本要求 Fabric API 0.100.8+ 和 MC 1.21+。与部分老版本光影包的兼容性需要验证。',
    affectedVersions: ['1.21', '1.21.1'],
    relatedUrl: 'https://modrinth.com/mod/sodium',
    icon: '⚡',
  },
  {
    id: 'evt-006',
    title: 'Create 0.6.0 发布 — 传动系统重写，蒸汽时代来临',
    category: 'MOD_MILESTONE',
    severity: 'INFO',
    publishTime: '2026-06-10',
    content: 'Create 0.6.0 "Steam & Steel" 正式发布。核心改动：传动系统 API 完全重写（旧版附属模组需更新）、新增蒸汽引擎与锅炉系统、新增电力分配网络。此为破坏性更新，升级前请确认所有 Create 附属模组已发布兼容版本。',
    affectedVersions: ['1.20.1', '1.21', '1.21.1'],
    relatedUrl: 'https://www.curseforge.com/minecraft/mc-mods/create',
    icon: '⚙',
  },
];

// ============================================================
// 工具函数
// ============================================================

export function formatMs(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

export function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  if (min > 0) return `${min}分${s}秒`;
  return `${sec}.${String(Math.floor((ms % 1000) / 100)).padEnd(1, '0')}秒`;
}

export function pct(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

export function getInstance(id) {
  return INSTANCES.find((i) => i.id === id);
}

export function getModpack(id) {
  return MODPACKS[id] || null;
}

export function getLatestSnapshot(instance) {
  return instance.snapshots[0];
}

/**
 * 计算两个快照之间的资产 Diff
 * 返回按资产类别分组的变更事件列表
 */
export function computeSnapshotDiff(older, newer) {
  const diff = {};

  for (const category of ['mods', 'resourcePacks', 'shaderPacks', 'configs']) {
    const oldAssets = older?.assets?.[category] || [];
    const newAssets = newer?.assets?.[category] || [];

    const oldMap = new Map();
    const newMap = new Map();

    const idKey = category === 'configs' ? 'relativePath' : 'id';
    oldAssets.forEach((a) => oldMap.set(a[idKey], a));
    newAssets.forEach((a) => newMap.set(a[idKey], a));

    const changes = [];

    // Check for ADD and UPDATE
    for (const [key, newAsset] of newMap) {
      const oldAsset = oldMap.get(key);
      if (!oldAsset) {
        changes.push({ type: 'ADD', asset: newAsset, category });
      } else if (category === 'configs') {
        if (oldAsset.fileHash !== newAsset.fileHash) {
          changes.push({ type: 'UPDATE', asset: newAsset, oldAsset, category, oldHash: oldAsset.fileHash, newHash: newAsset.fileHash });
        }
      } else {
        if (oldAsset.version !== newAsset.version || oldAsset.fileHash !== newAsset.fileHash) {
          changes.push({
            type: 'UPDATE', asset: newAsset, oldAsset, category,
            oldVersion: oldAsset.version, newVersion: newAsset.version,
          });
        }
      }
    }

    // Check for REMOVE
    for (const [key, oldAsset] of oldMap) {
      if (!newMap.has(key)) {
        changes.push({ type: 'REMOVE', asset: oldAsset, category });
      }
    }

    if (changes.length > 0) diff[category] = changes;
  }

  return diff;
}

/** 切换实例收藏状态 */
export function toggleInstanceFavorite(instanceId) {
  const inst = getInstance(instanceId);
  if (!inst) return false;
  inst.favorited = !inst.favorited;
  return inst.favorited;
}

/** 更新实例备注 */
export function setInstanceNote(instanceId, note) {
  const inst = getInstance(instanceId);
  if (!inst) return;
  inst.note = (note || '').trim();
}

/** 更新资产备注（最新快照） */
export function setAssetNote(instanceId, category, assetKey, note) {
  const inst = getInstance(instanceId);
  if (!inst) return;
  const latest = getLatestSnapshot(inst);
  if (!latest?.assets?.[category]) return;
  const asset = latest.assets[category].find((a) => (a.id || a.relativePath) === assetKey);
  if (asset) asset.note = (note || '').trim();
}

/** 实例列表：收藏优先 */
export function getSortedInstances() {
  return [...INSTANCES].sort((a, b) => {
    if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

/**
 * 获取实例资产概览统计
 */
export function getInstanceAssetSummary(instance) {
  const latest = getLatestSnapshot(instance);
  if (!latest) return null;
  return {
    modCount: latest.assets.mods.filter((m) => !m.isDeleted).length,
    rpCount: latest.assets.resourcePacks.filter((r) => !r.isDeleted).length,
    spCount: latest.assets.shaderPacks.filter((s) => !s.isDeleted).length,
    configCount: latest.assets.configs.length,
    deletedCount: latest.assets.mods.filter((m) => m.isDeleted).length,
    lastLaunch: latest.timestamp,
    totalMs: latest.totalMs,
  };
}

/**
 * 获取实例中落后版本的模组数量
 */
export function getPendingUpdateCount(instanceId) {
  return PLATFORM_UPDATES.filter((u) => u.affectedInstances.includes(instanceId)).length;
}

/**
 * 获取影响特定实例的事件列表
 */
export function getEventsForInstance(instance) {
  return MC_EVENTS.filter((evt) => {
    if (evt.affectedVersions.length === 0) return true; // 全局事件
    return evt.affectedVersions.includes(instance.minecraftVersion);
  });
}

/**
 * 获取严重事件数量
 */
export function getCriticalEventCount(instance) {
  return getEventsForInstance(instance).filter((e) => e.severity === 'CRITICAL').length;
}

export function getSeverityClass(severity) {
  return { INFO: 'sev-info', WARNING: 'sev-warn', CRITICAL: 'sev-critical' }[severity] || '';
}

export function getRiskClass(risk) {
  return { SAFE: 'risk-safe', CAUTION: 'risk-caution', DANGER: 'risk-danger' }[risk] || '';
}
