import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types/api'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean

  /** Store tokens and user after successful login */
  setAuth: (accessToken: string, refreshToken: string, user: User) => void
  /** Clear all auth state */
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (accessToken, refreshToken, user) =>
        set({
          token: accessToken,
          refreshToken,
          user,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          token: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'quillvault-auth',
    },
  ),
)
