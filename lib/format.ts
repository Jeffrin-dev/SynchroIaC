export function timeAgo(date: string | null): string {
  if (!date) return 'Never scanned'

  const timestamp = new Date(date).getTime()
  if (Number.isNaN(timestamp)) return 'Never scanned'

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'

  const units = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 }
  ]

  for (const unit of units) {
    const value = Math.floor(seconds / unit.seconds)
    if (value >= 1) {
      return `${value} ${unit.label}${value === 1 ? '' : 's'} ago`
    }
  }

  return 'just now'
}
