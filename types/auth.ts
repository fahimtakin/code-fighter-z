export interface User {
  username: string;
  password: string;
  wins: number;
  losses: number;
}

export interface AuthRequest {
  action: 'signup' | 'login';
  username: string;
  password: string;
}

export interface AuthResponse {
  token?: string;
  error?: string;
}