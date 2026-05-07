export function getAdminToken() {
  return localStorage.getItem('admin_token');
}

export function clearAdminSession() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

export function isJwtExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function hasValidAdminToken() {
  const token = getAdminToken();
  if (!token) return false;
  return !isJwtExpired(token);
}
