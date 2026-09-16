// The backend runs on this port of whichever machine served the page, so the
// same frontend works from this computer, another device on your Wi-Fi, or over
// Tailscale (see scripts/play.mjs).
export const BACKEND_PORT = 3000;
export const API_BASE = `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;

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