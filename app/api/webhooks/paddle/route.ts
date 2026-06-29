import { ok, badRequest } from '../../../../lib/api-response'
import { extractPaddleSubscriptionData, verifyPaddleWebhook } from '../../../../lib/paddle'
import { supabase } from '../../../../lib/supabase'

const HANDLED_EVENT_TYPES = new Set([
  'subscription.activated',
  'subscription.updated',
  'subscription.canceled'
])

async function findOrganizationId(subscriptionId: string, customOrgId?: unknown): Promise<string | null> {
  if (typeof customOrgId === 'string' && customOrgId.trim() !== '') {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', customOrgId)
      .maybeSingle()

    if (error) {
      console.error('Failed to find organization by Paddle custom_data.org_id', error)
    }

    if (data?.id) {
      return data.id
    }
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('paddle_subscription_id', subscriptionId)
    .maybeSingle()

  if (error) {
    console.error('Failed to find organization by Paddle subscription ID', error)
    return null
  }

  return data?.id ?? null
}

export async function POST(req: Request) {
  let event: any

  try {
    event = await verifyPaddleWebhook(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Paddle webhook'
    return badRequest(message)
  }

  const eventType = event.event_type
  if (!HANDLED_EVENT_TYPES.has(eventType)) {
    return ok({ received: true })
  }

  const subscription = extractPaddleSubscriptionData(event)
  const orgId = await findOrganizationId(subscription.subscriptionId, event.data?.custom_data?.org_id)

  if (!orgId) {
    console.warn('Paddle webhook organization not found', {
      eventType,
      subscriptionId: subscription.subscriptionId,
      customOrgId: event.data?.custom_data?.org_id
    })
    return ok({ received: true })
  }

  if (eventType === 'subscription.canceled') {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          plan: 'free',
          paddle_subscription_id: null
        })
        .eq('id', orgId)

      if (error) {
        console.error('Failed to clear canceled Paddle subscription', error)
      }
    } catch (error) {
      console.error('Unexpected error clearing canceled Paddle subscription', error)
    }

    return ok({ received: true })
  }

  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        plan: subscription.plan,
        paddle_subscription_id: subscription.subscriptionId
      })
      .eq('id', orgId)

    if (error) {
      console.error('Failed to update Paddle subscription', error)
    }
  } catch (error) {
    console.error('Unexpected error updating Paddle subscription', error)
  }

  return ok({ received: true })
}
