import { API_BASE } from "./api";
import type {
  LoginResponse,
  PlayerOpponent,
  PlayerStats,
  RegistrationResponse,
  User,
} from "../types/auth";
import { serverError } from "../i18n/server-error";

const TOKEN_KEY = "wizardToken";
const GUEST_TOKEN_KEY = "wizardGuestToken";
const GUEST_USERNAME_KEY = "wizardGuestUsername";
// A guest invited to a guest room keeps their login in the browser, not the
// tab: a phone reloads or drops a tab at any moment, and the seat must still
// be theirs when they open the link again. It lasts as long as the server's
// (routes /invites), and goes when they leave.
const INVITED_GUEST_KEY = "wizardInvitedGuest";
const INVITED_GUEST_MS = 4 * 60 * 60 * 1000;

interface InvitedGuest {
  token: string;
  username: string;
  roomId: number;
  expiresAt: number;
}

export interface InviteInfo {
  roomId: number;
  roomName: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  status: "waiting" | "playing";
}

interface ServerErrorBody {
  error?: string;
  code?: string;
  values?: Record<string, string>;
}

export interface GuestGameResponse {
  token: string;
  roomId: number;
  username: string;
}

// Authentication owns network calls and token persistence; pages only submit
// user input and react to success or failure.
export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const data = (await response.json()) as LoginResponse & {
    error?: string;
    code?: string;
    values?: Record<string, string>;
  };

  if (!response.ok || !data.token) {
    throw new Error(serverError(data, "login.failed"));
  }

  localStorage.setItem(TOKEN_KEY, data.token);

  return data;
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<RegistrationResponse> {
  const response = await fetch(`${API_BASE}/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      email,
      password,
    }),
  });

  const data = (await response.json()) as RegistrationResponse & {
    error?: string;
    code?: string;
    values?: Record<string, string>;
  };

  if (!response.ok || !data.token) {
    throw new Error(serverError(data, "signup.failed"));
  }

  // A new account is signed straight in.
  localStorage.setItem(TOKEN_KEY, data.token);

  return data;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// The invited guest this browser holds, or null; an expired one is forgotten.
// Storage can refuse (a private window), which simply means none.
function getInvitedGuest(): InvitedGuest | null {
  try {
    const saved = localStorage.getItem(INVITED_GUEST_KEY);
    const guest = saved ? (JSON.parse(saved) as InvitedGuest) : null;

    if (guest && guest.expiresAt > Date.now()) {
      return guest;
    }

    localStorage.removeItem(INVITED_GUEST_KEY);
  } catch {
    // Nothing kept.
  }

  return null;
}

// A guest of either kind: playing alone from Home (this tab only), or invited
// to a guest room (this browser).
export function getGuestToken(): string | null {
  return sessionStorage.getItem(GUEST_TOKEN_KEY) ?? getInvitedGuest()?.token ?? null;
}

export function getGuestUsername(): string | null {
  if (getToken()) {
    return null;
  }

  return sessionStorage.getItem(GUEST_USERNAME_KEY) ?? getInvitedGuest()?.username ?? null;
}

// The room an invited guest has a seat in; null for anyone else, the guest
// playing alone from Home included.
export function getInvitedGuestRoomId(): number | null {
  if (getToken() || sessionStorage.getItem(GUEST_TOKEN_KEY)) {
    return null;
  }

  return getInvitedGuest()?.roomId ?? null;
}

export function getActiveGameToken(): string | null {
  return getToken() ?? getGuestToken();
}

export async function createGuestGame(): Promise<GuestGameResponse> {
  const response = await fetch(`${API_BASE}/wizard/guest-games`, {
    method: "POST",
  });

  const data = (await response.json()) as GuestGameResponse & {
    error?: string;
    code?: string;
    values?: Record<string, string>;
  };

  if (!response.ok || !data.token || !data.roomId || !data.username) {
    throw new Error(serverError(data, "home.guestGameFailed"));
  }

  sessionStorage.setItem(GUEST_TOKEN_KEY, data.token);
  sessionStorage.setItem(GUEST_USERNAME_KEY, data.username);

  return data;
}

// What an invite link leads to: the room, its host and its seats.
export async function getInvite(code: string): Promise<InviteInfo> {
  const response = await fetch(`${API_BASE}/wizard/invites/${encodeURIComponent(code)}`);
  const data = (await response.json()) as InviteInfo & ServerErrorBody;

  if (!response.ok) {
    throw new Error(serverError(data, "join.invalid"));
  }

  return data;
}

// Takes a seat by invite link under the name the guest chose, and keeps the
// login so the seat survives a reload. Any earlier guest visit ends first.
export async function joinAsGuest(code: string, name: string): Promise<number> {
  endGuestSession();

  const response = await fetch(
    `${API_BASE}/wizard/invites/${encodeURIComponent(code)}/guest`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  const data = (await response.json()) as GuestGameResponse & ServerErrorBody;

  if (!response.ok || !data.token) {
    throw new Error(serverError(data, "join.failed"));
  }

  try {
    localStorage.setItem(
      INVITED_GUEST_KEY,
      JSON.stringify({
        token: data.token,
        username: data.username,
        roomId: data.roomId,
        expiresAt: Date.now() + INVITED_GUEST_MS,
      } satisfies InvitedGuest),
    );
  } catch {
    // A browser that keeps nothing still plays, as long as the tab lives.
    sessionStorage.setItem(GUEST_TOKEN_KEY, data.token);
    sessionStorage.setItem(GUEST_USERNAME_KEY, data.username);
  }

  return data.roomId;
}

// A signed-up wizard following an invite link joins as themselves.
export async function joinByInvite(code: string): Promise<number> {
  const response = await fetch(
    `${API_BASE}/wizard/invites/${encodeURIComponent(code)}/join`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    },
  );
  const data = (await response.json()) as { roomId: number } & ServerErrorBody;

  if (!response.ok) {
    throw new Error(serverError(data, "join.failed"));
  }

  return data.roomId;
}

// A guest is only ever at their one table. Leaving it ends the guest: the
// server removes the table, its game and the account (an invited guest's game
// goes on, their seat played by the server), and the browser forgets the
// guest. keepalive lets the request finish even as the page moves on.
export function endGuestSession(): void {
  const token = getGuestToken();

  sessionStorage.removeItem(GUEST_TOKEN_KEY);
  sessionStorage.removeItem(GUEST_USERNAME_KEY);

  try {
    localStorage.removeItem(INVITED_GUEST_KEY);
  } catch {
    // Nothing was kept.
  }

  if (!token) {
    return;
  }

  fetch(`${API_BASE}/wizard/guest-games`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => {
    // The server's own cleanup removes the guest if this never arrives.
  });
}

export async function getCurrentUser(): Promise<User> {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Not logged in");
  }

  // An invalid token is removed immediately so protected routes cannot keep
  // treating the browser as authenticated.
  const response = await fetch(`${API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    logout();
    throw new Error("Session expired or invalid");
  }

  return response.json() as Promise<User>;
}

export async function getCurrentUserStats(): Promise<PlayerStats> {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Not logged in");
  }

  const response = await fetch(`${API_BASE}/users/me/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      logout();
      throw new Error("Session expired or invalid");
    }

    throw new Error("Could not load player stats");
  }

  return response.json() as Promise<PlayerStats>;
}

export async function getCurrentUserOpponents(): Promise<PlayerOpponent[]> {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Not logged in");
  }

  const response = await fetch(`${API_BASE}/users/me/opponents`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      logout();
      throw new Error("Session expired or invalid");
    }

    throw new Error("Could not load opponents");
  }

  return response.json() as Promise<PlayerOpponent[]>;
}

export async function getPlayerProfile(userId: number): Promise<{
  id: number;
  username: string;
  displayName: string;
  stats: PlayerStats;
  opponents: PlayerOpponent[];
}> {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error("Not logged in");
  }

  const response = await fetch(
    `${API_BASE}/users/player/${userId}/profile`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      logout();
      throw new Error("Session expired or invalid");
    }

    if (response.status === 404) {
      throw new Error("Player not found");
    }

    throw new Error("Could not load player profile");
  }

  return response.json();
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}
