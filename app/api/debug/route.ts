import { NextResponse } from 'next/server'

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

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client/http')
    const url = tursoUrl.startsWith('libsql://') ? tursoUrl.replace('libsql://', 'https://') : tursoUrl
    const client = createClient({ url, authToken: tursoToken })
    const result = await client.execute('SELECT count(*) as c FROM Movement')
    return NextResponse.json({ ...info, ok: true, movementCount: result.rows[0]?.c })
  } catch (err: unknown) {
    return NextResponse.json({ ...info, ok: false, error: String(err) }, { status: 500 })
  }
}
