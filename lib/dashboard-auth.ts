import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from './supabase-server'
import { supabase as serviceSupabase } from './supabase'

export async function getDashboardOrgContext(): Promise<{
  userId: string
  userEmail: string
  orgId: string
  orgName: string
  orgPlan: string
  apiKey: string
}> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Same lookup logic as GET /api/v1/auth/me
  const { data: member } = await serviceSupabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    redirect('/login')
  }

  const { data: org } = await serviceSupabase
    .from('organizations')
    .select('id, name, plan, api_key')
    .eq('id', member.org_id)
    .single()

  if (!org) {
    redirect('/login')
  }

  return {
    userId: user.id,
    userEmail: user.email!,
    orgId: org.id,
    orgName: org.name,
    orgPlan: org.plan,
    apiKey: org.api_key
  }
}
