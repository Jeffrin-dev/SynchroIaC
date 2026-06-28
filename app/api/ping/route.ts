import { supabase } from '../../../lib/supabase'

export async function GET() {
  const { error } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, timestamp: new Date().toISOString() })
}
