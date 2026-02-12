const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'phil@hfexteriors.com')
  .split(',')
  .map(email => email.trim().toLowerCase())

export function isAdmin(email) {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}
