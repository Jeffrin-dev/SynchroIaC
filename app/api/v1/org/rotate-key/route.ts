import { ok, serverError } from '../../../../../lib/api-response'
import { randomBytes } from 'crypto'
import { withAuth } from '../../../../../lib/auth'
import { supabase } from '../../../../../lib/supabase'

export async function POST(req: Request) {
  return withAuth(req, async (_req, org) => {
  const apiKey = `sia_${randomBytes(16).toString('hex')}`

  const { error } = await supabase
    .from('organizations')
    .update({ api_key: apiKey })
    .eq('id', org.id)

  if (error) {
    return serverError('Failed to rotate API key')
  }

    return ok({
      api_key: apiKey,
      warning: 'Save this key now. It will not be shown again.'
    })
  })
}
