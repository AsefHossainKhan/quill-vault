import { apiClient } from './client'
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, User } from '../types/api'

/** Authenticate user with email/username and password */
export async function loginUser(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload)
  return data
}

/** Register a new user account */
export async function registerUser(payload: RegisterRequest): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>('/auth/register', payload)
  return data
}

/** Verify current token and get user profile */
export async function verifyUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/verify')
  return data
}
