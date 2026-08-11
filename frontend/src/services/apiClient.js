const BASE_URL = 'http://localhost:8003/api';
export const TOKEN_KEY = 'oncall-app-token';
export const SESSION_EXPIRED_EVENT = 'oncall-app-session-expired';

// localStorage synchronizes removals to other tabs. The custom event covers the
// current tab, because browsers do not fire a storage event in the tab that made the change.
export function expireSession(expectedToken) {
  // Ignore a stale request/timer if another login has already replaced its token.
  if (expectedToken && localStorage.getItem(TOKEN_KEY) !== expectedToken) return;

  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

// Central HTTP wrapper ensuring all requests automatically attach Bearer JWT authentication,
// parse server JSON error payloads, and throw readable Error instances for component try/catch blocks.
export async function apiFetch(path, options = {}) {
  // Retrieve token from browser storage on every call to support dynamic session restoration and immediate logout clearing.
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach Bearer JWT header whenever a session exists so backend authMiddleware can populate req.user.
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let data;
  const contentType = response.headers.get('content-type');
  // Handle empty or 204 No Content responses safely without throwing JSON parse syntax errors.
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // Extracts server-defined error message ({ error: "..." }) to show actionable backend error messages in UI toasts/alerts.
  if (!response.ok) {
    // A rejected authenticated request means the stored session can no longer be used.
    // Clear it immediately instead of leaving the UI in a signed-in state.
    if (response.status === 401 && token) {
      expireSession(token);
    }

    const errorMessage =
      data && typeof data === 'object' && data.error
        ? data.error
        : typeof data === 'string' && data
        ? data
        : `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}
