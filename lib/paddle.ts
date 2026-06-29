import { env } from './env'
import * as crypto from 'crypto'

function parsePaddleSignature(header: string): { ts: string; h1: string } {
  const parts = header.split(';').map((part) => part.trim().split('='))
  const values = Object.fromEntries(parts) as Record<string, string>

  if (!values.ts || !values.h1) {
    throw new Error('Invalid Paddle webhook signature')
  }

  return { ts: values.ts, h1: values.h1 }
}

export async function verifyPaddleWebhook(req: Request): Promise<any> {
  const rawBody = await req.text()
  const signature = req.headers.get('paddle-signature')

  if (!signature) {
    throw new Error('Missing paddle-signature header')
  }

  const secret = env.PADDLE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('Missing PADDLE_WEBHOOK_SECRET')
  }

  const { ts, h1 } = parsePaddleSignature(signature)
  const computed = crypto.createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex')
  const computedBuffer = Buffer.from(computed, 'hex')
  const receivedBuffer = Buffer.from(h1, 'hex')

  if (computedBuffer.length !== receivedBuffer.length) {
    throw new Error('Invalid Paddle webhook signature')
  }

  if (!crypto.timingSafeEqual(computedBuffer, receivedBuffer)) {
    throw new Error('Invalid Paddle webhook signature')
  }

  return JSON.parse(rawBody)
}

export function extractPaddleSubscriptionData(event: any): {
  subscriptionId: string
  customerId: string
  status: string
  priceId: string
  plan: string
} {
  const data = event.data ?? {}
  const subscriptionId = data.id
  const customerId = data.customer_id
  const status = data.status
  const priceId = data.items?.[0]?.price?.id ?? ''
  let plan = 'free'

  if (env.PADDLE_PRICE_ID_PRO === priceId) {
    plan = 'pro'
  }

  if (env.PADDLE_PRICE_ID_TEAM === priceId) {
    plan = 'team'
  }

  return {
    subscriptionId,
    customerId,
    status,
    priceId,
    plan
  }
}
