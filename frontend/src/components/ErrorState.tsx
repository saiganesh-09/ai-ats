import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Standard fetch-failure state for pages — user-friendly message, no
 * internals leaked, retry re-runs the query.
 */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive/70" />
      <div>
        <p className="font-medium">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {message ?? "We couldn't load this. Please try again."}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  )
}
