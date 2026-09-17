'use client'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/endpoints'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Resumes() {
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const { data: resumes, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: api.myResumes,
  })

  const upload = async (file: File) => {
    setUploading(true)
    try {
      await api.uploadResume(file)
      toast.success('Resume uploaded and parsed')
      qc.invalidateQueries({ queryKey: ['resumes'] })
      qc.invalidateQueries({ queryKey: ['profile'] }) // skills auto-merged
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const remove = useMutation({
    mutationFn: api.deleteResume,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resumes'] }),
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My resumes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a PDF, DOCX, or TXT — AI extracts your skills into your profile automatically.
          </p>
        </div>
        <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Parsing…' : 'Upload resume'}
        </Button>
        <input
          ref={fileInput} type="file" accept=".pdf,.docx,.txt" hidden
          onChange={(e) => {
            e.target.files?.[0] && upload(e.target.files[0])
            e.target.value = ''
          }}
        />
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        {resumes?.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {r.originalFilename}
                      <Badge
                        variant={r.parsedStatus === 'PARSED' ? 'secondary' : 'outline'}
                        className="ml-2 text-[10px]"
                      >
                        {r.parsedStatus === 'PARSED' ? 'AI parsed' : r.parsedStatus === 'FAILED' ? 'parse failed' : 'pending'}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                      {r.parsed?.email ? ` · ${r.parsed.email}` : ''}
                      {r.parsed?.phone ? ` · ${r.parsed.phone}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => remove.mutate(r.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {r.parsed?.summary && (
                <p className="mt-2 text-sm text-muted-foreground">{r.parsed.summary}</p>
              )}
              {!!r.parsed?.skills?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.parsed.skills.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {resumes?.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">No resumes yet — upload your first.</p>
        )}
      </div>
    </div>
  )
}
