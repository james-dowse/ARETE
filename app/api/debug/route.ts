import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL ?? '(not set)'
  const token = process.env.TURSO_AUTH_TOKEN ? '(set)' : '(not set)'
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client/http')
    const rawUrl = url
    const httpUrl = rawUrl.startsWith('libsql://') ? rawUrl.replace('libsql://', 'https://') : rawUrl
    const client = createClient({ url: httpUrl, authToken: process.env.TURSO_AUTH_TOKEN })
    const result = await client.execute('SELECT 1 as ok')
    return NextResponse.json({ ok: true, url: url.substring(0, 30) + '...', token, rows: result.rows })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, url: url.substring(0, 40), token, error: String(err) }, { status: 500 })
  }
}
