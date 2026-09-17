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
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
})
type Form = z.infer<typeof schema>

export default function Login() {
  const { login } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    setBusy(true)
    try {
      const user = await login(data.email, data.password)
      router.push(homeFor(user))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card>
        <CardHeader><CardTitle>Log in</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              {busy ? 'Logging in…' : 'Log in'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              No account? <Link href="/register" className="text-primary">Sign up</Link>
            </p>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <strong>Demo logins</strong> (password123): rita@acme.com (recruiter),
              henry@acme.com (hiring mgr), admin@acme.com (company admin),
              super@ats.dev (platform), carol@example.com (candidate)
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
