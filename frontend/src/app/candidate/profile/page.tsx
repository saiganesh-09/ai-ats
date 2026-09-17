'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import type { Profile } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

type Exp = { title: string; company: string; years: number; description: string }
type Edu = { degree: string; institution: string; year: number }
type Cert = { name: string; issuer: string; year: number }

export default function ProfilePage() {
  const qc = useQueryClient()
  const { data: profile, isLoading } = useQuery({ queryKey: ['profile'], queryFn: api.myProfile })
  // Edits overlay the fetched profile — no sync-effect needed; untouched
  // fields read straight from the query cache.
  const [edited, setEdited] = useState<Profile | null>(null)
  const draft = edited ?? profile ?? null
  const setDraft = setEdited
  const [newSkill, setNewSkill] = useState('')

  const save = useMutation({
    mutationFn: () => api.updateProfile(draft!),
    onSuccess: () => {
      toast.success('Profile saved')
      qc.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading || !draft) return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-96" /></div>

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft({ ...draft, [k]: v })
  const addSkill = () => {
    const s = newSkill.trim().toLowerCase()
    if (s && !draft.skills.includes(s)) set('skills', [...draft.skills, s])
    setNewSkill('')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My profile</h1>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Recruiters see this when reviewing your applications. Resume uploads auto-fill skills.
      </p>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Headline</CardTitle></CardHeader>
        <CardContent>
          <Input
            value={draft.headline ?? ''}
            onChange={(e) => set('headline', e.target.value)}
            placeholder="e.g. Backend engineer · TypeScript · 5 yrs"
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Skills</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {draft.skills.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button onClick={() => set('skills', draft.skills.filter((x) => x !== s))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={newSkill} onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              placeholder="Add a skill…" className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={addSkill}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <ListCard<Exp>
        title="Experience"
        items={draft.experience as Exp[]}
        onAdd={() => set('experience', [...(draft.experience as Exp[]), { title: '', company: '', years: 0, description: '' }])}
        onRemove={(i) => set('experience', (draft.experience as Exp[]).filter((_, j) => j !== i))}
        render={(item, i) => (
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Title" value={item.title}
              onChange={(e) => patchExp(draft, setDraft, i, { title: e.target.value })} />
            <Input placeholder="Company" value={item.company}
              onChange={(e) => patchExp(draft, setDraft, i, { company: e.target.value })} />
            <Input placeholder="Years" type="number" value={item.years || ''}
              onChange={(e) => patchExp(draft, setDraft, i, { years: Number(e.target.value) })} />
          </div>
        )}
      />

      <ListCard<Edu>
        title="Education"
        items={draft.education as Edu[]}
        onAdd={() => set('education', [...(draft.education as Edu[]), { degree: '', institution: '', year: new Date().getFullYear() }])}
        onRemove={(i) => set('education', (draft.education as Edu[]).filter((_, j) => j !== i))}
        render={(item, i) => (
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Degree" value={item.degree}
              onChange={(e) => patchEdu(draft, setDraft, i, { degree: e.target.value })} />
            <Input placeholder="Institution" value={item.institution}
              onChange={(e) => patchEdu(draft, setDraft, i, { institution: e.target.value })} />
            <Input placeholder="Year" type="number" value={item.year || ''}
              onChange={(e) => patchEdu(draft, setDraft, i, { year: Number(e.target.value) })} />
          </div>
        )}
      />

      <ListCard<Cert>
        title="Certifications"
        items={draft.certifications as Cert[]}
        onAdd={() => set('certifications', [...(draft.certifications as Cert[]), { name: '', issuer: '', year: new Date().getFullYear() }])}
        onRemove={(i) => set('certifications', (draft.certifications as Cert[]).filter((_, j) => j !== i))}
        render={(item, i) => (
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Name" value={item.name}
              onChange={(e) => patchCert(draft, setDraft, i, { name: e.target.value })} />
            <Input placeholder="Issuer" value={item.issuer}
              onChange={(e) => patchCert(draft, setDraft, i, { issuer: e.target.value })} />
            <Input placeholder="Year" type="number" value={item.year || ''}
              onChange={(e) => patchCert(draft, setDraft, i, { year: Number(e.target.value) })} />
          </div>
        )}
      />
    </div>
  )
}

function patchExp(d: Profile, set: (p: Profile) => void, i: number, patch: Partial<Exp>) {
  const arr = [...(d.experience as Exp[])]; arr[i] = { ...arr[i], ...patch }
  set({ ...d, experience: arr })
}
function patchEdu(d: Profile, set: (p: Profile) => void, i: number, patch: Partial<Edu>) {
  const arr = [...(d.education as Edu[])]; arr[i] = { ...arr[i], ...patch }
  set({ ...d, education: arr })
}
function patchCert(d: Profile, set: (p: Profile) => void, i: number, patch: Partial<Cert>) {
  const arr = [...(d.certifications as Cert[])]; arr[i] = { ...arr[i], ...patch }
  set({ ...d, certifications: arr })
}

function ListCard<T>({ title, items, onAdd, onRemove, render }: {
  title: string
  items: T[]
  onAdd: () => void
  onRemove: (i: number) => void
  render: (item: T, i: number) => React.ReactNode
}) {
  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">{render(item, i)}</div>
            <Button variant="ghost" size="sm" onClick={() => onRemove(i)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">None added yet.</p>}
      </CardContent>
    </Card>
  )
}
