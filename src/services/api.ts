export const API_BASE = "http://127.0.0.1:3000";

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