import { getAccessToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function getAuthHeaders() {
  const token = getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  return response.json();
}

export function fetchMil10kImages() {
  return request('/mil10k/images');
}

export function fetchMil10kImageData(folder, filename) {
  return request(`/mil10k/image-data/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`);
}

export function fetchMil10kLabel(folder, filename) {
  return request(`/mil10k/labels/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`);
}

export function fetchMil10kStats() {
  return request('/mil10k/labels-stats');
}

export function saveMil10kLabel(payload) {
  return request('/mil10k/labels', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
