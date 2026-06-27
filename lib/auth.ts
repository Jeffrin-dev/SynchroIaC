import { supabase } from './supabase'

export interface OrgContext {
  id: string
  name: string
  plan: string
}

export async function requireAuth(req: Request): Promise<OrgContext> {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    throw new Response(JSON.stringify({ error: 'Missing x-api-key header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, plan')
    .eq('api_key', apiKey)
    .single()

  if (error || !org) {
    throw new Response(JSON.stringify({ error: 'Invalid API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return org as OrgContext
}
