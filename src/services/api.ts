// In development Vite serves the page and the backend runs on this port of the
// same machine, so the frontend works from this computer, another device on your
// Wi-Fi, or over Tailscale (see scripts/play.mjs). In a production build the
// backend serves the page itself, so API calls go to the page's own origin.
export const BACKEND_PORT = 3000;
export const BACKEND_HOST = import.meta.env.DEV
  ? `${window.location.hostname}:${BACKEND_PORT}`
  : window.location.host;
export const API_BASE = `${window.location.protocol}//${BACKEND_HOST}`;

// Kept separate from the UI so the health check can be reused without making
// pages know how the backend is addressed.
interface BackendHealth {
  status: string;
  message: string;
}

export async function checkBackend(): Promise<BackendHealth> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return response.json() as Promise<BackendHealth>;
}