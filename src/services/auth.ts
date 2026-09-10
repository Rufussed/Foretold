import { API_BASE } from "./api";
import type {
  LoginResponse,
  RegistrationResponse,
  User,
} from "../types/auth";

const TOKEN_KEY = "wizardToken";

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
  };

  if (!response.ok || !data.token) {
    throw new Error(data.error ?? "Login failed");
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
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Registration failed");
  }

  return data;
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

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}
