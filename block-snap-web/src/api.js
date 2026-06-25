const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request(path, options = {}) {
  const { auth = false, verify = false, body, ...rest } = options;

  const headers = { 'Content-Type': 'application/json', ...(rest.headers || {}) };

  if (auth) {
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = token;
  }
  if (verify) {
    const verifyToken = localStorage.getItem('verifyToken');
    if (verifyToken) headers['Verify-Token'] = verifyToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('verifyToken');
    window.dispatchEvent(new Event('auth:logout'));
  }

  return json;
}

export const api = {
  login: (username, password) =>
    request('/sys-user/login', { method: 'POST', body: { username, password } }),

  register: (data) =>
    request('/sys-user/register', { method: 'POST', body: data }),

  logout: () =>
    request('/sys-user/logout', { method: 'POST', auth: true }),

  sendVerificationCode: (account, scene) =>
    request('/sys-user/send-verification-code', { method: 'POST', body: { account, scene } }),

  forgotPassword: (data) =>
    request('/sys-user/forgot-password', { method: 'POST', body: data }),

  verifyAccount: (account, verificationCode) =>
    request('/sys-user/verify-account', {
      method: 'POST',
      auth: true,
      body: { account, verificationCode },
    }),

  updatePassword: (data) =>
    request('/sys-user/update-password', { method: 'POST', auth: true, verify: true, body: data }),

  bindAccount: (account, verificationCode, needVerify) =>
    request('/sys-user/bind-account', {
      method: 'POST',
      auth: true,
      verify: needVerify,
      body: { account, verificationCode },
    }),

  /** 登录后：当前用户的实例列表 */
  listInstances: () =>
    request('/svc-instance/list', { method: 'GET', auth: true }),

  /** 实例收藏 PUT /svc-instance/favorite */
  updateInstanceFavorite: (instanceId, favorite) =>
    request('/svc-instance/favorite', {
      method: 'PUT',
      auth: true,
      body: { instanceId, favorite },
    }),

  /** 实例备注 PUT /svc-instance/note */
  updateInstanceNote: (instanceId, note) =>
    request('/svc-instance/note', {
      method: 'PUT',
      auth: true,
      body: { instanceId, note },
    }),

  /** 模组收藏（预留）PUT /svc-mod/favorite */
  updateModFavorite: (modSnapshotId, favorite) =>
    request('/svc-mod/favorite', {
      method: 'PUT',
      auth: true,
      body: { modSnapshotId, favorite },
    }),

  /** 模组备注（预留）PUT /svc-mod/note */
  updateModNote: (modSnapshotId, note) =>
    request('/svc-mod/note', {
      method: 'PUT',
      auth: true,
      body: { modSnapshotId, note },
    }),
};

export const SCENES = {
  REGISTER: 'register',
  BIND_ACCOUNT: 'bind-account',
  VERIFY_ACCOUNT: 'verify-account',
  FORGOT_PASSWORD: 'forgot-password',
};

/** sys_user_mark.target_type，与后端 MarkConst 一致 */
export const MARK_TARGET_TYPE = {
  INSTANCE: 1,
  MOD: 2,
  MODPACK: 3,
  RESOURCE: 4,
  SHADER: 5,
  CONFIG: 6,
};

/** 资产列表 category → targetType（模组/资源包等为 mod_snapshot.id） */
export const ASSET_CATEGORY_TARGET_TYPE = {
  mods: MARK_TARGET_TYPE.MOD,
  resourcePacks: MARK_TARGET_TYPE.RESOURCE,
  shaderPacks: MARK_TARGET_TYPE.SHADER,
  configs: MARK_TARGET_TYPE.CONFIG,
};

export function isSuccess(result) {
  return result && result.code === 200;
}

export function getMessage(result) {
  if (result?.message) return result.message;
  if (result?.error) return result.error;
  return '请求失败';
}
