// Shown only when NEXT_PUBLIC_DEMO_MODE=true — set it on the public demo
// deployment, never in real environments.
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null
  return (
    <div className="border-b bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-700 dark:text-amber-400">
      Live demo — data resets periodically. Try{' '}
      <code className="font-mono">rita@acme.com</code> (recruiter) or{' '}
      <code className="font-mono">carol@example.com</code> (candidate) · password{' '}
      <code className="font-mono">password123</code>
    </div>
  )
}
