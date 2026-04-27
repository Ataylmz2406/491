import { authFetch } from './authService';

async function request(path, options = {}) {
  let response;
  try {
    response = await authFetch(path, {
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
      ? 'The labeling service is temporarily unavailable. Please try again in a moment.'
      : `Request failed with status ${response.status}`;
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
