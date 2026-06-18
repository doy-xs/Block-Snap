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
};

export const SCENES = {
  REGISTER: 'register',
  BIND_ACCOUNT: 'bind-account',
  VERIFY_ACCOUNT: 'verify-account',
  FORGOT_PASSWORD: 'forgot-password',
};

export function isSuccess(result) {
  return result && result.code === 200;
}

export function getMessage(result) {
  return result?.message || '请求失败';
}
