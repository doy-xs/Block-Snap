export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function saveToken(token) {
  localStorage.setItem('token', token);
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

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('verifyToken');
  localStorage.removeItem('username');
}

export function clearVerifyToken() {
  localStorage.removeItem('verifyToken');
}
