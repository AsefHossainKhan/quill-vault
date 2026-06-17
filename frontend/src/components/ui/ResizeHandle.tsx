import { useCallback, useRef, useEffect, useState } from 'react'
import { cn } from '../../lib/utils'

interface ResizeHandleProps {
  /** Direction of resize: 'left' means handle is on the left edge of the panel */
  side: 'left' | 'right'
  /** Current width in px */
  width: number
  /** Callback when width changes */
  onResize: (width: number) => void
  /** Minimum width in px */
  minWidth?: number
  /** Maximum width in px */
  maxWidth?: number
}

export function ResizeHandle({
  side,
  width,
  onResize,
  minWidth = 180,
  maxWidth = 500,
}: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setDragging(true)
      startXRef.current = e.clientX
      startWidthRef.current = width
    },
    [width],
  )

  useEffect(() => {
    if (!dragging) return

    function handleMouseMove(e: MouseEvent) {
      const delta = e.clientX - startXRef.current
      const newWidth =
        side === 'right'
          ? startWidthRef.current + delta
          : startWidthRef.current - delta

      const clamped = Math.min(maxWidth, Math.max(minWidth, newWidth))
      onResize(clamped)
    }

    function handleMouseUp() {
      setDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, side, minWidth, maxWidth, onResize])

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'absolute top-0 z-20 h-full w-1 cursor-col-resize transition-colors',
        'hover:bg-primary/30',
        dragging && 'bg-primary/40',
        side === 'right' ? 'right-0' : 'left-0',
      )}
    />
  )
}
