import { apiClient } from './client'
import type { LoginRequest, LoginResponse, User } from '../types/api'

/** Authenticate user with email/username and password */
export async function loginUser(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload)
  return data
}

/** Verify current token and get user profile */
export async function verifyUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/verify')
  return data
}
