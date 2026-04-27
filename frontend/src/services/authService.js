const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const ACCESS_TOKEN_STORAGE_KEY = 'suderm_access_token';
let accessTokenMemory = '';

export function getAccessToken() {
  if (accessTokenMemory) return accessTokenMemory;
  return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || '';
}

export function setAccessToken(token) {
  if (!token) {
    accessTokenMemory = '';
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return;
  }
  accessTokenMemory = token;
  window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function clearAccessToken() {
  accessTokenMemory = '';
  window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw new Error('We could not reach the server. Please check your connection and try again.');
  }

  if (!response.ok) {
    let message = response.status >= 500
      ? 'The service is temporarily unavailable. Please try again in a moment.'
      : `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // keep default error
    }
    const err = new Error(message);
    err.status = response.status; // Expose HTTP status for caller-side error mapping
    throw err;
  }

  return response.json();
}

export async function authRefresh() {
  const data = await request('/auth/refresh', {
    method: 'POST',
  });
  setAccessToken(data.access_token);
  return data;
}

export async function authFetch(path, options = {}, retryOnExpiredToken = true) {
  let token = getAccessToken();
  if (!token && retryOnExpiredToken) {
    try {
      const refreshed = await authRefresh();
      token = refreshed.access_token;
    } catch {
      throw new Error('AUTH_REQUIRED');
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new Error('We could not reach the server. Please check your connection and try again.');
  }

  if (response.status === 401 && retryOnExpiredToken) {
    try {
      const refreshed = await authRefresh();
      return authFetch(
        path,
        {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${refreshed.access_token}`,
          },
        },
        false
      );
    } catch {
      clearAccessToken();
    }
  }

  return response;
}

async function authJsonRequest(path, options = {}) {
  const response = await authFetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = response.status >= 500
      ? 'The service is temporarily unavailable. Please try again in a moment.'
      : `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // keep default error
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export async function authLogin(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function authRegister(payload) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function authMe() {
  return authJsonRequest('/auth/me', {
    method: 'GET',
  });
}

export async function authLogout() {
  const token = getAccessToken();

  try {
    return await request('/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } finally {
    clearAccessToken();
  }
}
