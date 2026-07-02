import { clearAuth, getToken, getVerifyToken } from './auth.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/** 网关白名单：无需 Authorization */
const PUBLIC_PATHS = new Set([
  '/sys-user/login',
  '/sys-user/register',
  '/sys-user/send-verification-code',
  '/sys-user/forgot-password',
]);

async function request(path, options = {}) {
  const { auth = false, verify = false, body, ...rest } = options;

  const headers = { 'Content-Type': 'application/json', ...(rest.headers || {}) };

  if (auth) {
    const token = getToken();
    if (!token) {
      return { code: 401, message: '请先登录' };
    }
    headers.Authorization = token;
  }
  if (verify) {
    const verifyToken = getVerifyToken();
    if (!verifyToken) {
      return { code: 500, message: '缺少二次验证凭证，请先完成安全验证' };
    }
    headers['Verify-Token'] = verifyToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearAuth();
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

  /**
   * GET /sys-user/getAccount
   * @param {{ verify?: boolean }} options verify=true 时携带 Verify-Token，返回完整手机/邮箱
   */
  getAccount: (options = {}) =>
    request('/sys-user/getAccount', {
      method: 'GET',
      auth: true,
      verify: !!options.verify,
    }),

  /** 更改昵称 POST /sys-user/update-nickname */
  updateNickname: (nickname) =>
    request('/sys-user/update-nickname', {
      method: 'POST',
      auth: true,
      body: { nickname },
    }),

  /** 更改用户名 POST /sys-user/update-username */
  updateUsername: (username) =>
    request('/sys-user/update-username', {
      method: 'POST',
      auth: true,
      verify: true,
      body: { username },
    }),

  /** 登录后：当前用户的实例列表 GET /svc-instance/list */
  listInstances: () =>
    request('/svc-instance/list', { method: 'GET', auth: true }),

  /**
   * 指定实例最新快照下的模组列表 GET /svc-mod/list?instanceId=
   * @param {number} instanceId 实例 id（instance.id）
   * @returns {Promise<{code:number,message?:string,data?:Array<{
   *   id:number, name:string, version:string,
   *   isNewVersion:number, isDeleted:number, loadTime:number,
   *   favorite:number, note:string,
   *   addedTime:string, updateTime:string
   * }>}>}
   * ModVo.id = mod_snapshot.id；收藏/备注接口的 modId 即此 id。
   */
  listMods: (instanceId) =>
    request(`/svc-mod/list?instanceId=${instanceId}`, { method: 'GET', auth: true }),

  /**
   * 实例收藏 PUT /svc-instance/favorite
   * @param {number} instanceId instance.id
   * @param {0|1} favorite
   */
  updateInstanceFavorite: (instanceId, favorite) =>
    request('/svc-instance/favorite', {
      method: 'PUT',
      auth: true,
      body: { instanceId, favorite },
    }),

  /**
   * 实例备注 PUT /svc-instance/note
   * @param {number} instanceId instance.id
   * @param {string} note
   */
  updateInstanceNote: (instanceId, note) =>
    request('/svc-instance/note', {
      method: 'PUT',
      auth: true,
      body: { instanceId, note },
    }),

  /**
   * 模组收藏 PUT /svc-mod/favorite
   * @param {number} modId mod_snapshot.id（来自 listMods 返回的 ModVo.id）
   * @param {0|1} favorite
   */
  updateModFavorite: (modId, favorite) =>
    request('/svc-mod/favorite', {
      method: 'PUT',
      auth: true,
      body: { modId, favorite },
    }),

  /**
   * 模组备注 PUT /svc-mod/note
   * @param {number} modId mod_snapshot.id（来自 listMods 返回的 ModVo.id）
   * @param {string} note
   */
  updateModNote: (modId, note) =>
    request('/svc-mod/note', {
      method: 'PUT',
      auth: true,
      body: { modId, note },
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

export function isPublicPath(path) {
  return PUBLIC_PATHS.has(path);
}
