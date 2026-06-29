const PHONE_REGEX = /^1[3-9]\d{9}$/;
const EMAIL_REGEX = /^[A-Za-z0-9+_.-]+@(.+)$/;

export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function saveToken(token) {
  localStorage.setItem('token', token);
}

export function getToken() {
  return localStorage.getItem('token');
}

export function saveUsername(username) {
  localStorage.setItem('username', username);
}

export function getUsername() {
  return localStorage.getItem('username');
}

export function saveVerifyToken(token) {
  localStorage.setItem('verifyToken', token);
}

export function getVerifyToken() {
  return localStorage.getItem('verifyToken');
}

export function hasVerifyToken() {
  return !!getVerifyToken();
}

/** 从 JWT payload 解析 userId（网关据此注入 X-User-Id） */
export function parseTokenUserId(token) {
  try {
    const raw = (token || '').replace(/^Bearer\s+/i, '').trim();
    const payload = JSON.parse(atob(raw.split('.')[1]));
    const id = payload.userId;
    return id == null ? null : String(id);
  } catch {
    return null;
  }
}

export function getUserId() {
  return localStorage.getItem('userId');
}

function boundContactKey(userId = getUserId()) {
  return userId ? `hasBoundContact:${userId}` : null;
}

/** 标记当前用户已绑定过手机或邮箱（换绑时需二次验证） */
export function setHasBoundContact(value = true) {
  const key = boundContactKey();
  if (key) localStorage.setItem(key, value ? '1' : '0');
}

export function hasBoundContact() {
  const key = boundContactKey();
  return key ? localStorage.getItem(key) === '1' : false;
}

/** 登录成功后统一写入会话 */
export function saveSessionFromLogin(token, loginAccount) {
  saveToken(token);
  saveUsername(loginAccount);
  const userId = parseTokenUserId(token);
  if (userId) localStorage.setItem('userId', userId);
  applyPendingBoundContact();
}

/** 注册时带了手机/邮箱，登录成功后再标记（此时尚无 userId） */
export function markPendingBoundContact() {
  localStorage.setItem('pendingBoundContact', '1');
}

export function applyPendingBoundContact() {
  if (localStorage.getItem('pendingBoundContact') === '1') {
    setHasBoundContact(true);
    localStorage.removeItem('pendingBoundContact');
  }
}

/** 页面刷新后从已有 token 恢复 userId */
export function restoreSessionFromStorage() {
  if (!isLoggedIn()) return;
  const userId = parseTokenUserId(getToken());
  if (userId) localStorage.setItem('userId', userId);
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('verifyToken');
  localStorage.removeItem('username');
  localStorage.removeItem('userId');
  sessionStorage.removeItem('accountPhone');
  sessionStorage.removeItem('accountEmail');
}

export function clearVerifyToken() {
  localStorage.removeItem('verifyToken');
  sessionStorage.removeItem('accountPhone');
  sessionStorage.removeItem('accountEmail');
}

export function isPhone(value) {
  return PHONE_REGEX.test((value || '').trim());
}

export function isEmail(value) {
  return EMAIL_REGEX.test((value || '').trim());
}

export function isAccount(value) {
  const v = (value || '').trim();
  return isPhone(v) || isEmail(v);
}
