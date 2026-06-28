import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogoutButton } from '../../components/LogoutButton'
import { createSupabaseServerClient } from '../../lib/supabase-server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getSession()

  if (!data.session) {
    redirect('/login')
  }

  const navLinks = [
    { href: '/dashboard/projects', label: 'Projects' },
    { href: '/dashboard/drifts', label: 'Drifts' },
    { href: '/dashboard/settings', label: 'Settings' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-5">
          <Link href="/dashboard/projects" className="text-xl font-bold text-gray-900">SynchroIaC</Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="ml-64 min-h-screen p-8">{children}</main>
    </div>
  )
}
