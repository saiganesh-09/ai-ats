'use client'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const schema = z.object({
  title: z.string().min(2, 'Title required'),
  location: z.string().optional(),
  description: z.string().min(20, 'Min 20 characters'),
  requirements: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']),
  experienceLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD']),
  workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  educationRequirement: z.string().optional(),
  applicationDeadline: z.string().optional()
    .refine((v) => !v || new Date(v) > new Date(), 'Deadline must be a future date'),
  openings: z.string().optional(),
  requiredSkills: z.string().optional(),
  preferredSkills: z.string().optional(),
  hiringManagerId: z.string().optional(),
})
export type JobFormData = z.infer<typeof schema>

const csv = (s?: string) => s?.split(',').map((x) => x.trim()).filter(Boolean)

/** Convert form strings to the API payload. */
export function toJobPayload(data: JobFormData) {
  return {
    ...data,
    salaryMin: data.salaryMin ? Number(data.salaryMin) : undefined,
    salaryMax: data.salaryMax ? Number(data.salaryMax) : undefined,
    openings: data.openings ? Number(data.openings) : undefined,
    applicationDeadline: data.applicationDeadline || undefined,
    requiredSkills: csv(data.requiredSkills),
    preferredSkills: csv(data.preferredSkills),
    hiringManagerId: data.hiringManagerId ? Number(data.hiringManagerId) : undefined,
  }
}

/** Shared job-posting form — used by the quick-create dialog and /recruiter/jobs/create. */
export function JobForm({ hiringManagers, pending, onSubmit }: {
  hiringManagers: { id: number; fullName: string }[]
  pending: boolean
  onSubmit: (data: JobFormData) => void
}) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<JobFormData>({
    resolver: zodResolver(schema),
    defaultValues: { employmentType: 'FULL_TIME', experienceLevel: 'MID', workMode: 'ONSITE' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the highlighted fields'))} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input {...register('title')} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select defaultValue="FULL_TIME" onValueChange={(v) => v && setValue('employmentType', v as JobFormData['employmentType'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL_TIME">Full-time</SelectItem>
              <SelectItem value="PART_TIME">Part-time</SelectItem>
              <SelectItem value="CONTRACT">Contract</SelectItem>
              <SelectItem value="INTERNSHIP">Internship</SelectItem>
            </SelectContent>
          </Select>
          {errors.employmentType && <p className="text-xs text-destructive">{errors.employmentType.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Level</Label>
          <Select defaultValue="MID" onValueChange={(v) => v && setValue('experienceLevel', v as JobFormData['experienceLevel'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ENTRY">Entry</SelectItem>
              <SelectItem value="MID">Mid</SelectItem>
              <SelectItem value="SENIOR">Senior</SelectItem>
              <SelectItem value="LEAD">Lead</SelectItem>
            </SelectContent>
          </Select>
          {errors.experienceLevel && <p className="text-xs text-destructive">{errors.experienceLevel.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Work mode</Label>
          <Select defaultValue="ONSITE" onValueChange={(v) => v && setValue('workMode', v as JobFormData['workMode'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="REMOTE">Remote</SelectItem>
              <SelectItem value="HYBRID">Hybrid</SelectItem>
              <SelectItem value="ONSITE">On-site</SelectItem>
            </SelectContent>
          </Select>
          {errors.workMode && <p className="text-xs text-destructive">{errors.workMode.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Location</Label>
          <Input {...register('location')} placeholder="City / Remote" />
        </div>
        <div className="space-y-1.5">
          <Label>Openings</Label>
          <Input type="number" min={1} defaultValue="1" {...register('openings')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Salary min (annual)</Label>
          <Input type="number" min={0} placeholder="120000" {...register('salaryMin')} />
        </div>
        <div className="space-y-1.5">
          <Label>Salary max</Label>
          <Input type="number" min={0} placeholder="160000" {...register('salaryMax')} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={4} {...register('description')} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Requirements</Label>
        <Textarea rows={2} {...register('requirements')} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Required skills</Label>
          <Input placeholder="typescript, node, sql" {...register('requiredSkills')} />
        </div>
        <div className="space-y-1.5">
          <Label>Preferred (nice-to-have)</Label>
          <Input placeholder="aws, docker" {...register('preferredSkills')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Education requirement</Label>
          <Input placeholder="BS in CS or equivalent" {...register('educationRequirement')} />
        </div>
        <div className="space-y-1.5">
          <Label>Application deadline</Label>
          <Input type="date" {...register('applicationDeadline')} />
          {errors.applicationDeadline && <p className="text-xs text-destructive">{errors.applicationDeadline.message}</p>}
        </div>
      </div>
      {hiringManagers.length > 0 && (
        <div className="space-y-1.5">
          <Label>Hiring manager</Label>
          <Select onValueChange={(v) => v != null && setValue('hiringManagerId', String(v))}>
            <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
            <SelectContent>
              {hiringManagers.map((hm) => (
                <SelectItem key={hm.id} value={String(hm.id)}>{hm.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button className="w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create draft'}
      </Button>
    </form>
  )
}
