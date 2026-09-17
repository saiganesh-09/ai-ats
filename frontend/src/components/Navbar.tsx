'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Bell, Briefcase, LogOut } from 'lucide-react'
import { api } from '@/lib/endpoints'
import { homeFor, useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_LINKS: Record<string, { href: string; label: string }[]> = {
  CANDIDATE: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/applications', label: 'Applications' },
    { href: '/dashboard/resumes', label: 'Resumes' },
    { href: '/dashboard/profile', label: 'Profile' },
    { href: '/dashboard/saved', label: 'Saved' },
  ],
  RECRUITER: [
    { href: '/recruiter', label: 'Dashboard' },
    { href: '/recruiter/jobs', label: 'Jobs' },
    { href: '/recruiter/company', label: 'Company' },
  ],
  HIRING_MANAGER: [{ href: '/hiring', label: 'My Jobs' }],
  ADMIN: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/companies', label: 'Companies' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/activity', label: 'Activity' },
  ],
}

export function Navbar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const { data: unread } = useQuery({
    queryKey: ['unread'],
    queryFn: api.unreadCount,
    enabled: !!user,
    refetchInterval: 30_000, // poll for new notifications
  })

  const links = user
    ? (user.isSuperadmin ? NAV_LINKS.ADMIN : (NAV_LINKS[user.role] ?? []))
    : []

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          <Briefcase className="h-5 w-5" /> AI ATS
        </Link>
        <nav className="flex flex-1 items-center gap-1 text-sm">
          <Link
            href="/jobs"
            className={`rounded-md px-3 py-1.5 hover:bg-accent ${pathname.startsWith('/jobs') ? 'bg-accent font-medium' : ''}`}
          >
            Jobs
          </Link>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 hover:bg-accent ${pathname === l.href ? 'bg-accent font-medium' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/dashboard/notifications" className="relative rounded-md p-2 hover:bg-accent">
                <Bell className="h-4 w-4" />
                {!!unread?.count && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unread.count}
                  </span>
                )}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm">{user.fullName}</Button>} />
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {user.email}
                    <Badge variant="secondary" className="ml-2">{user.role}</Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { window.location.href = homeFor(user) }}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>Log in</Button>
              <Button size="sm" render={<Link href="/register" />}>Sign up</Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
