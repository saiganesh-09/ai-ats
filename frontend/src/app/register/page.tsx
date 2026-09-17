'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { homeFor, useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  fullName: z.string().min(1, 'Name required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Min 8 characters'),
  role: z.enum(['CANDIDATE', 'RECRUITER', 'HIRING_MANAGER']),
})
type Form = z.infer<typeof schema>

const ROLES = [
  { value: 'CANDIDATE', label: 'Job seeker', hint: 'Browse & apply' },
  { value: 'RECRUITER', label: 'Recruiter', hint: 'Post jobs, manage pipeline' },
  { value: 'HIRING_MANAGER', label: 'Hiring manager', hint: 'Review & decide' },
] as const

export default function Register() {
  const { register: signup } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'CANDIDATE' },
  })
  const role = watch('role')

  const onSubmit = async (data: Form) => {
    setBusy(true)
    try {
      const user = await signup(data)
      router.push(homeFor(user))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card>
        <CardHeader><CardTitle>Create account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value} type="button"
                  onClick={() => setValue('role', r.value)}
                  className={`rounded-md border p-2 text-left text-xs ${role === r.value ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
                >
                  <div className="font-medium">{r.label}</div>
                  <div className="text-muted-foreground">{r.hint}</div>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" {...register('fullName')} />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button className="w-full" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Have an account? <Link href="/login" className="text-primary">Log in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
