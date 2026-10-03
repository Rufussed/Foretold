import { API_BASE } from "./api";

export interface Friend {
  playerId: number;
  username: string;
  displayName: string;
}

export interface PlayerSearchResult {
  id: number;
  username: string;
  displayName: string;
}

export interface FriendRequest {
  id: number;
  senderId: number;
  receiverId: number;
  senderUsername: string;
  senderDisplayName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export type FriendRelationshipStatus = "friend" | "pending" | "none";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    throw new Error("Not logged in");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Friend request failed");
  }

  return data;
}

export function sendFriendRequest(userId: number): Promise<{ success: true }> {
  return request(`/users/friends/request/${userId}`, { method: "POST" });
}

export function getFriends(): Promise<Friend[]> {
  return request<Friend[]>("/users/friends");
}

export function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const params = new URLSearchParams({ query });
  return request<PlayerSearchResult[]>(`/users/search?${params.toString()}`);
}

export function getFriendRequests(): Promise<FriendRequest[]> {
  return request<FriendRequest[]>("/users/friends/requests");
}

export function acceptFriendRequest(
  requestId: number,
): Promise<{ success: true }> {
  return request(`/users/friends/requests/${requestId}/accept`, {
    method: "POST",
  });
}

export function rejectFriendRequest(
  requestId: number,
): Promise<{ success: true }> {
  return request(`/users/friends/requests/${requestId}/reject`, {
    method: "POST",
  });
}

export function removeFriend(userId: number): Promise<{ success: true }> {
  return request(`/users/friends/${userId}`, { method: "DELETE" });
}

export function getFriendStatus(
  userId: number,
): Promise<FriendRelationshipStatus> {
  return request<FriendRelationshipStatus>(`/users/friends/status/${userId}`);
}
