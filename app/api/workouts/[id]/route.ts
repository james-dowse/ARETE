import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkoutOwner } from '@/lib/authz'
import { sendNewWorkoutEmail, sendWorkoutRemovedEmail, sendWorkoutUpdatedEmail } from '@/lib/email'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: 'asc' } },
      movements: {
        include: { movement: true },
        orderBy: { order: 'asc' },
      },
      template: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
      _count: { select: { savedBy: true } },
    },
  })
  if (!workout) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(workout)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}
  if ('description' in body) data.description = body.description || null
  if ('name' in body && typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if ('notes' in body) data.notes = body.notes || null
  if ('tags' in body) data.tags = body.tags || null
  if ('public' in body) data.public = !!body.public
  if ('difficultyOverride' in body) data.difficultyOverride = body.difficultyOverride || null
  if ('imagePosition' in body) data.imagePosition = body.imagePosition || null
  if ('imageUrl' in body) {
    const raw = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
    if (raw) {
      let valid = false
      try { valid = ['http:', 'https:'].includes(new URL(raw).protocol) } catch { /* URL invalide */ }
      if (!valid) return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
      data.imageUrl = raw
    } else {
      data.imageUrl = null
      data.imagePosition = null
    }
  }
  // Détecte le passage privé -> public pour notifier les abonnés du créateur —
  // comparé à l'état avant update, pour ne jamais re-notifier sur une simple
  // re-publication (dépublié puis republié).
  let notifyFollowers = false
  if (data.public === true) {
    const before = await prisma.workout.findUnique({ where: { id }, select: { public: true } })
    notifyFollowers = before?.public === false
  }

  // Modification substantielle (nom et/ou description) : notifie les
  // utilisateurs qui ont sauvegardé ce workout précis (SavedWorkout — pas les
  // abonnés du profil, qui ne sont notifiés qu'à la publication d'un nouveau
  // workout). Le corps de la requête n'inclut ces clés que si le champ est
  // réellement modifié (isDirtyName/isDirtyDescription côté client), donc
  // leur présence ici suffit à qualifier le changement.
  const notifySavers = 'name' in data || 'description' in data

  const updated = await prisma.workout.update({ where: { id }, data })

  if (notifySavers) {
    const savers = await prisma.savedWorkout.findMany({
      where: { workoutId: id, NOT: { userId: authz.userId } },
      select: { user: { select: { email: true } } },
    })
    if (savers.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3040'
      const workoutUrl = `${appUrl}/workouts/${id}`
      await Promise.all(
        savers.map(s => sendWorkoutUpdatedEmail(s.user.email, updated.name, workoutUrl).catch(err => {
          console.error('[workout updated email]', err)
        }))
      )
    }
  }

  if (notifyFollowers && updated.userId) {
    const [creator, followers] = await Promise.all([
      prisma.invitedUser.findUnique({ where: { id: updated.userId }, select: { firstName: true, lastName: true, email: true } }),
      prisma.follow.findMany({
        where: { followedId: updated.userId, notifyByEmail: true },
        select: { follower: { select: { email: true } } },
      }),
    ])
    if (creator && followers.length > 0) {
      const followedName = [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim() || creator.email.split('@')[0]
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3040'
      const workoutUrl = `${appUrl}/workouts/${id}`
      await Promise.all(
        followers.map(f => sendNewWorkoutEmail(f.follower.email, followedName, updated.name, workoutUrl).catch(err => {
          console.error('[new workout email]', err)
        }))
      )
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await requireWorkoutOwner(id)
  if (!authz.ok) return authz.response

  const [workout, savers] = await Promise.all([
    prisma.workout.findUnique({ where: { id }, select: { name: true } }),
    prisma.savedWorkout.findMany({
      where: { workoutId: id, NOT: { userId: authz.userId } },
      select: { user: { select: { email: true } } },
    }),
  ])

  await prisma.workout.delete({ where: { id } })

  if (workout && savers.length > 0) {
    await Promise.all(
      savers.map(s => sendWorkoutRemovedEmail(s.user.email, workout.name).catch(err => {
        console.error('[workout removed email]', err)
      }))
    )
  }

  return NextResponse.json({ ok: true })
}
