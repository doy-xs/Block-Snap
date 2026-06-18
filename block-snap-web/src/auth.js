export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function saveToken(token) {
  localStorage.setItem('token', token);
}

export function saveVerifyToken(token) {
  localStorage.setItem('verifyToken', token);
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('verifyToken');
}

export function clearVerifyToken() {
  localStorage.removeItem('verifyToken');
}
