'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { useAuth } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

export default function Company() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [invite, setInvite] = useState('')
  const { data: company, isLoading } = useQuery({ queryKey: ['company'], queryFn: api.myCompany })

  const create = useMutation({
    mutationFn: () => api.createCompany(name),
    onSuccess: () => { toast.success('Company created — you are now its admin'); qc.invalidateQueries({ queryKey: ['company'] }) },
    onError: (e) => toast.error(e.message),
  })
  const join = useMutation({
    mutationFn: () => api.joinCompany(invite),
    onSuccess: () => { toast.success('Joined company'); qc.invalidateQueries({ queryKey: ['company'] }) },
    onError: (e) => toast.error(e.message),
  })
  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) => api.setMemberRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company'] }),
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-64" /></div>

  if (!company) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader><CardTitle>Set up your company</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Create a new company</Label>
              <div className="flex gap-2">
                <Input placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} />
                <Button disabled={name.length < 2 || create.isPending} onClick={() => create.mutate()}>Create</Button>
              </div>
              <p className="text-xs text-muted-foreground">You become the company admin and get an invite code for teammates.</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Or join with an invite code</Label>
              <div className="flex gap-2">
                <Input placeholder="Invite code" value={invite} onChange={(e) => setInvite(e.target.value)} />
                <Button variant="outline" disabled={!invite || join.isPending} onClick={() => join.mutate()}>Join</Button>
              </div>
              <p className="text-xs text-muted-foreground">Demo code: <code>acme-join-2026</code></p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canManage = user?.role === 'ADMIN' || user?.isSuperadmin

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{company.name}</h1>
      <Card className="mt-4">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">Invite code</p>
            <p className="text-xs text-muted-foreground">Share with recruiters & hiring managers to join your company</p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => { navigator.clipboard.writeText(company.inviteCode); toast.success('Copied') }}
          >
            <Copy className="mr-2 h-4 w-4" />{company.inviteCode}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Team members ({company.users?.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {company.users?.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{m.fullName}{m.id === user?.id ? ' (you)' : ''}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              {canManage && m.id !== user?.id ? (
                <Select value={m.role} onValueChange={(role) => role && setRole.mutate({ userId: m.id, role })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECRUITER">Recruiter</SelectItem>
                    <SelectItem value="HIRING_MANAGER">Hiring manager</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{m.role}</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
