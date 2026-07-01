import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'
import { supabase as serviceSupabase } from '../../../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Get the current session
    const supabase = createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // 2. If no user: return 401
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 3. Query org_members for this user_id using the service-role client
    const { data: member, error: memberError } = await serviceSupabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    // 4. If no org_members row found
    if (memberError || !member) {
      return NextResponse.json({ error: 'No organization linked to this account' }, { status: 404 })
    }

    // 5. Fetch the organization's api_key and basic org info
    const { data: org, error: orgError } = await serviceSupabase
      .from('organizations')
      .select('id, name, api_key, plan')
      .eq('id', member.org_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // 6. Return 200
    return NextResponse.json({
      user: { id: user.id, email: user.email },
      org: {
        id: org.id,
        name: org.name,
        plan: org.plan,
        api_key: org.api_key
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('Auth me route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
