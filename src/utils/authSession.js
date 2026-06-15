import { jwtDecode } from 'jwt-decode';

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    if (!decoded?.exp) return true;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return decoded.exp <= nowInSeconds;
  } catch {
    return true;
  }
}

export function hasRecoverableSession(accessToken, refreshToken) {
  if (accessToken && !isTokenExpired(accessToken)) return true;
  if (refreshToken && !isTokenExpired(refreshToken)) return true;
  return false;
}

export function isPublicAuthRoute(route) {
  if (!route) return false;
  if (route.meta?.public) return true;
  const path = route.path || '';
  return (
    path === '/login'
    || path.startsWith('/recuperar-senha')
    || path.startsWith('/reset-password/')
    || path.startsWith('/check-in/')
    || path.startsWith('/public/')
  );
}
