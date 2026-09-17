'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { useAuth } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const ROLES = ['CANDIDATE', 'RECRUITER', 'HIRING_MANAGER', 'ADMIN']

export default function AdminUsers() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string>('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['adminUsers', q, role],
    queryFn: () => api.adminUsers({ q: q || undefined, role: role || undefined }),
  })
  const setStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api.setUserStatus(id, isActive),
    onSuccess: (u) => {
      toast.success(`${u.email} ${u.isActive ? 'activated' : 'suspended'}`)
      qc.invalidateQueries({ queryKey: ['adminUsers'] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="mt-4 flex gap-3">
        <Input
          placeholder="Search name or email…" className="max-w-xs"
          onChange={(e) => {
            const v = e.target.value
            clearTimeout((AdminUsers as { t?: number }).t)
            ;(AdminUsers as { t?: number }).t = window.setTimeout(() => setQ(v), 300)
          }}
        />
        <Select value={role} onValueChange={(v) => setRole(!v || v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="m-4 h-64" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.fullName}{u.isSuperadmin ? ' ★' : ''}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                    <TableCell className="text-sm">{u.company?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'default' : 'destructive'}>
                        {u.isActive ? 'active' : 'suspended'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {u.id !== me?.id && !u.isSuperadmin && (
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setStatus.mutate({ id: u.id, isActive: !u.isActive })}
                        >
                          {u.isActive ? 'Suspend' : 'Activate'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
