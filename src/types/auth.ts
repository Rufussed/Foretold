export interface User {
  username: string;
  displayName: string;
  email: string;
}

export interface LoginResponse {
  token: string;
}

export interface RegistrationResponse {
  id: number;
  username: string;
}