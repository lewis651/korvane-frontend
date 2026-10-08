const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not reach the logistics server. Check that the backend is running and try again.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The logistics server returned an invalid response (${response.status}).`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error(`The logistics server returned an unexpected response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status}).`);
  }
  return payload;
}
