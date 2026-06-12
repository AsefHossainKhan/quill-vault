import { cn } from '../../lib/utils'

interface LogoProps {
  className?: string
  size?: number
}

/**
 * QuillVault logo — a stylised quill/shield SVG.
 * Uses currentColor so it inherits text colour from parent.
 */
export function Logo({ className, size = 48 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-label="QuillVault logo"
    >
      {/* Shield shape */}
      <path
        d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Quill / pen nib */}
      <path
        d="M38 14c-4 6-10 12-16 18 2 4 4 8 6 10 2-3 4-7 5-11 1 4 2 7 3 10 1-3 2-6 3-9 1.5 3 2.5 5.5 3.5 8 1-2.5 1.5-5 1.5-7.5 0-3-.5-5.5-1.5-7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Small ink drop */}
      <circle cx="24" cy="44" r="2" fill="currentColor" fillOpacity="0.6" />
    </svg>
  )
}
