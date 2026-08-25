import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendReminderEmail } from '@/lib/email'

// Relance hebdo douce — déclenchée par le cron Vercel défini dans vercel.json
// (une fois par semaine). Vercel signe l'appel avec `Authorization: Bearer
// $CRON_SECRET` quand cette variable d'env est définie ; sans elle, on refuse
// tout appel pour ne pas exposer un endpoint public d'envoi de masse.
const INACTIVITY_DAYS = 7

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000)

  const [users, lastSessions] = await Promise.all([
    prisma.invitedUser.findMany({
      where: { status: 'accepted' },
      select: { id: true, email: true, firstName: true, acceptedAt: true },
    }),
    prisma.workoutSession.groupBy({ by: ['userId'], _max: { doneAt: true } }),
  ])
  const lastByUser = new Map(lastSessions.map(s => [s.userId, s._max.doneAt]))

  const toRemind = users
    .map(u => {
      const lastActivity = lastByUser.get(u.id) ?? u.acceptedAt
      return { u, lastActivity }
    })
    .filter((x): x is { u: typeof users[number]; lastActivity: Date } => !!x.lastActivity && x.lastActivity < cutoff)

  const results = await Promise.allSettled(
    toRemind.map(({ u, lastActivity }) => {
      const daysInactive = Math.floor((Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
      return sendReminderEmail(u.email, u.firstName, daysInactive)
    })
  )
  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.length - sent

  return NextResponse.json({ eligible: toRemind.length, sent, failed })
}
