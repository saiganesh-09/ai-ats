'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Offset pagination control — prev/next + position, shared by all list pages. */
export function Pager({
  page, totalPages, total, onPage,
}: {
  page: number
  totalPages: number
  total: number
  onPage: (p: number) => void
}) {
  if (totalPages <= 1 && total === 0) return null
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {total} result{total === 1 ? '' : 's'} · page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
