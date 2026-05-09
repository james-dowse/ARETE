import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  // Expose enough info to diagnose without leaking full credentials
  const info = {
    tursoUrlDefined: tursoUrl !== undefined,
    tursoUrlEmpty: tursoUrl === '',
    tursoUrlLength: tursoUrl?.length ?? 0,
    tursoUrlStart: tursoUrl?.substring(0, 30) ?? '(undefined)',
    tursoTokenDefined: tursoToken !== undefined,
    nodeEnv: process.env.NODE_ENV,
  }

  if (!tursoUrl || tursoUrl.trim() === '') {
    return NextResponse.json({ ...info, error: 'TURSO_DATABASE_URL is missing or empty' }, { status: 500 })
  }

  // Test 1: raw libsql HTTP client
  let rawOk = false
  let rawError = ''
  let rawCount = 0
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client/http')
    const url = tursoUrl.startsWith('libsql://') ? tursoUrl.replace('libsql://', 'https://') : tursoUrl
    const client = createClient({ url, authToken: tursoToken })
    const result = await client.execute('SELECT count(*) as c FROM Movement')
    rawCount = result.rows[0]?.c
    rawOk = true
  } catch (err: unknown) {
    rawError = String(err)
  }

  // Test 2: Prisma client
  let prismaOk = false
  let prismaError = ''
  let prismaCount = 0
  try {
    prismaCount = await prisma.movement.count()
    prismaOk = true
  } catch (err: unknown) {
    prismaError = String(err)
  }

  return NextResponse.json({
    ...info,
    raw: { ok: rawOk, count: rawCount, error: rawError },
    prisma: { ok: prismaOk, count: prismaCount, error: prismaError },
  }, { status: rawOk && prismaOk ? 200 : 500 })
}
