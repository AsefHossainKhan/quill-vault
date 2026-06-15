import { Bot, User } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ChatMessage as ChatMessageType } from '../../types/api'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
              ? 'bg-muted text-muted-foreground'
              : 'bg-accent text-accent-foreground',
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
              ? 'bg-muted text-muted-foreground italic'
              : 'bg-muted text-foreground',
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
