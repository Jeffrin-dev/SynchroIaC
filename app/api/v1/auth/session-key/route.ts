import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../../lib/supabase-server'
import { supabase as serviceSupabase } from '../../../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: member, error: memberError } = await serviceSupabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'No organization linked' }, { status: 404 })
    }

    const { data: org, error: orgError } = await serviceSupabase
      .from('organizations')
      .select('api_key')
      .eq('id', member.org_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({ api_key: org.api_key }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
