import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Mail, User, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuthStore } from '../stores/authStore'
import { registerUser, loginUser, verifyUser } from '../api/auth'

/** Zod schema for register form validation */
const registerSchema = z
  .object({
    fullName: z.string().optional(),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, hyphens, and underscores'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

/** Compute password strength: 0-4 segments */
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++

  const levels = [
    { label: 'Weak', color: 'bg-destructive' },
    { label: 'Fair', color: 'bg-warning' },
    { label: 'Good', color: 'bg-primary' },
    { label: 'Strong', color: 'bg-success' },
  ]

  const level = levels[Math.min(score, 4) - 1] || levels[0]
  return { score, ...level }
}

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const watchedPassword = watch('password')
  const strength = getPasswordStrength(watchedPassword)

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null)

    try {
      // 1) Register the new account
      await registerUser({
        username: data.username,
        email: data.email,
        full_name: data.fullName || undefined,
        password: data.password,
      })

      // 2) Auto-login with the new credentials
      const loginRes = await loginUser({
        identifier: data.email,
        password: data.password,
      })

      // 3) Set token temporarily for verify
      useAuthStore.getState().setAuth(
        loginRes.access_token,
        loginRes.refresh_token,
        { id: '', email: '', username: '' },
      )

      // 4) Get full user profile
      const user = await verifyUser()

      // 5) Store complete auth state
      useAuthStore.getState().setAuth(
        loginRes.access_token,
        loginRes.refresh_token,
        user,
      )

      navigate('/')
    } catch (err: unknown) {
      useAuthStore.getState().logout()

      let message = 'Registration failed. Please try again.'
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
              Create an account
            </h1>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Server error banner */}
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              icon={<User className="h-4 w-4" />}
              {...register('fullName')}
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="johndoe"
              autoComplete="username"
              icon={<User className="h-4 w-4" />}
              error={!!errors.username}
              {...register('username')}
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 8 characters"
              autoComplete="new-password"
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
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
            {/* Strength indicator */}
            {watchedPassword && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors',
                        i <= strength.score ? strength.color : 'bg-border',
                      )}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              error={!!errors.confirmPassword}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
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
                Create Account
                <UserPlus className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a
            href="#/auth/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
