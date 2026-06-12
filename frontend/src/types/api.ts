/** API response shapes */

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface User {
  id: string
  email: string
  username: string
}

export interface LoginRequest {
  identifier: string  // email or username
  password: string
}

/** Backend /auth/login returns only tokens */
export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterRequest {
  username: string
  email: string
  full_name?: string
  password: string
}

export interface RegisterResponse {
  id: string
  username: string
  email: string
}

export interface ApiError {
  detail: string
}
