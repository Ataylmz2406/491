export function friendlyApiMessage(message, fallback = 'Something went wrong. Please try again.') {
  if (!message) return fallback;

  const normalized = String(message).toLowerCase();

  if (
    normalized === 'failed to fetch' ||
    normalized === 'load failed' ||
    normalized === 'failed to process request' ||
    normalized.includes('networkerror') ||
    normalized.includes('unable to connect')
  ) {
    return 'We could not reach the server. Please check your connection and try again.';
  }

  if (
    normalized === 'server_unavailable' ||
    normalized.includes('request failed with status 500') ||
    normalized.includes('request failed with status 502') ||
    normalized.includes('request failed with status 503') ||
    normalized.includes('request failed with status 504')
  ) {
    return 'The service is temporarily unavailable. Please try again in a moment.';
  }

  if (normalized === 'auth_required') {
    return 'Please sign in to continue.';
  }

  return message;
}
