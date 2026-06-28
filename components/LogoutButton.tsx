'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase-browser'

export function LogoutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
    >
      Sign out
    </button>
  )
}
