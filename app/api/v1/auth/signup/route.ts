import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, org_name } = body

    // 1. Parse and validate body
    if (!email || !email.includes('@') || !email.split('@')[1].includes('.')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const trimmedOrgName = org_name?.trim()
    if (!trimmedOrgName || trimmedOrgName.length > 100) {
      return NextResponse.json({ error: 'Organization name is required and must be under 100 characters' }, { status: 400 })
    }

    // 2. Create the Supabase Auth user using the admin API
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const authUser = userData.user
    if (!authUser) {
      return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
    }

    try {
      // 3. Generate a new API key
      const newApiKey = `sia_${crypto.randomBytes(16).toString('hex')}`

      // 4. Insert the new organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: trimmedOrgName,
          api_key: newApiKey,
          plan: 'free',
          created_via: 'signup'
        })
        .select('id')
        .single()

      if (orgError) throw orgError

      // 5. Insert into org_members
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: org.id,
          user_id: authUser.id,
          role: 'owner'
        })

      if (memberError) throw memberError

      // 7. Return 201
      return NextResponse.json({
        user_id: authUser.id,
        org_id: org.id,
        org_name: trimmedOrgName,
        message: 'Account created. Please sign in.'
      }, { status: 201 })

    } catch (dbError: any) {
      // 6. Rollback handling
      await supabase.auth.admin.deleteUser(authUser.id)
      console.error('Signup DB error (rolled back auth user):', dbError)
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Signup route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
