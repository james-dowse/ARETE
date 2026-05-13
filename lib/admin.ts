const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'jimmy.dowse@gmail.com').toLowerCase()

export function isAdmin(email?: string | null): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL
}
