import { API_BASE } from "./api";
import { getToken } from "./auth";

export interface AdminRoom {
  id: number;
  name: string;
  status: string;
  createdAt: string;
  creatorUsername: string;
  creatorIsGuest: boolean;
  playerCount: number;
  gameStatus: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  lastName: string;
  birthDate: string;
  email: string;
  createdAt: string;
  isGuest: boolean;
  roomsCreated: number;
}

// Calls the /admin routes as the signed-in account; the server decides
// whether that account is an admin.
async function adminRequest<T>(path: string, method = "GET"): Promise<T> {
  const response = await fetch(`${API_BASE}/admin${path}`, {
    method,
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });

  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  return data;
}

export function listAdminRooms(): Promise<AdminRoom[]> {
  return adminRequest("/rooms");
}

export function listAdminUsers(): Promise<AdminUser[]> {
  return adminRequest("/users");
}

export async function deleteAdminRoom(roomId: number): Promise<void> {
  await adminRequest(`/rooms/${roomId}`, "DELETE");
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await adminRequest(`/users/${userId}`, "DELETE");
}
