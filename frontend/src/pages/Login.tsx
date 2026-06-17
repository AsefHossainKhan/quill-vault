import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, Mail, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuthStore } from '../stores/authStore'
import { loginUser, verifyUser } from '../api/auth'

/** Zod schema for login form validation */
const loginSchema = z.object({
  email: z
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)

    try {
      // 1) Authenticate — get tokens
      const loginRes = await loginUser({
        identifier: data.email,
        password: data.password,
      })

      // 2) Temporarily set token so the verify request includes it
      useAuthStore.getState().setAuth(
        loginRes.access_token,
        loginRes.refresh_token,
        { id: '', email: '', username: '' }, // placeholder
      )

      // 3) Verify token to get user profile
      const user = await verifyUser()

      // 4) Store the real user info
      useAuthStore.getState().setAuth(
        loginRes.access_token,
        loginRes.refresh_token,
        user,
      )

      // Navigate to dashboard after successful login
      navigate('/')
    } catch (err: unknown) {
      // Clean up any partial auth state on failure
      useAuthStore.getState().logout()

      // Extract meaningful error message from API response
      let message = 'Login failed. Please try again.'
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        if (axiosErr.response?.data?.detail) {
          message = axiosErr.response.data.detail
        }
      }
      setServerError(message)
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center bg-background px-4">
      {/* Theme toggle — top right, below titlebar */}
      <div className="fixed right-4 top-12 z-50">
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] animate-fade-in rounded-2xl border border-border bg-card p-8 shadow-lg">
        {/* Logo + Heading */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img
            src="/quillvault-logo.png"
            alt="QuillVault logo"
            className="h-16 w-16 object-contain"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
              Sign in to your account
            </h1>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Server error banner */}
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              icon={<Mail className="h-4 w-4" />}
              error={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a
                href="#forgot-password"
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              error={!!errors.password}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign In
                <LogIn className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <a
            href="#/auth/register"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
