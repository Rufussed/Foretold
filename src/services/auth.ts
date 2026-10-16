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
  displayName: string,
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
      displayName,
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

export function getGuestToken(): string | null {
  return sessionStorage.getItem(GUEST_TOKEN_KEY);
}

export function getGuestUsername(): string | null {
  if (getToken()) {
    return null;
  }

  return sessionStorage.getItem(GUEST_USERNAME_KEY);
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

// A guest is only ever at their one table. Leaving it ends the guest: the
// server removes the table, its game and the account, and this tab forgets
// the guest. keepalive lets the request finish even as the page moves on.
export function endGuestSession(): void {
  const token = getGuestToken();

  sessionStorage.removeItem(GUEST_TOKEN_KEY);
  sessionStorage.removeItem(GUEST_USERNAME_KEY);

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
