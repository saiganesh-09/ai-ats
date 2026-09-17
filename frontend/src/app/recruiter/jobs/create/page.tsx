'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { JobForm, toJobPayload } from '@/components/JobForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function CreateJob() {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: api.myCompany })
  const hiringManagers = company?.users?.filter((u) => u.role === 'HIRING_MANAGER') ?? []

  const create = useMutation({
    mutationFn: (data: Parameters<typeof toJobPayload>[0]) => api.createJob(toJobPayload(data)),
    onSuccess: () => {
      toast.success('Job created as draft — publish it when ready')
      qc.invalidateQueries({ queryKey: ['manageJobs'] })
      router.push('/recruiter/jobs')
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/recruiter/jobs" className="text-sm text-primary">← Jobs</Link>
      <Card className="mt-3">
        <CardHeader><CardTitle>New job posting</CardTitle></CardHeader>
        <CardContent>
          <JobForm
            hiringManagers={hiringManagers}
            pending={create.isPending}
            onSubmit={(d) => create.mutate(d)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
