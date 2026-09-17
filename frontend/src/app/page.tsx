import Link from 'next/link'
import { ArrowRight, BarChart3, BrainCircuit, FileText, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'AI resume parsing',
    body: 'Upload a PDF and our LLM extracts skills, experience and education into structured profiles instantly.',
  },
  {
    icon: BarChart3,
    title: 'Match scoring & ranking',
    body: 'Every applicant gets an AI match score with matched and missing skills — pipelines sort themselves.',
  },
  {
    icon: Users,
    title: 'Full hiring pipeline',
    body: 'Recruiters, hiring managers and admins collaborate on one kanban from applied to hired.',
  },
  {
    icon: FileText,
    title: 'Interview toolkit',
    body: 'AI-generated candidate summaries and tailored interview questions for every application.',
  },
]

export default function Landing() {
  return (
    <main>
      <section className="border-b bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            AI-powered recruiting
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold tracking-tight">
            Hire smarter with an ATS that reads resumes for you
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Post jobs, let AI parse and score every applicant, and move the best
            candidates through your pipeline — all in one place.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" render={<Link href="/jobs" />}>
              Browse open roles <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/register" />}>
              For recruiters
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="h-6 w-6 text-primary" />
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{f.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
