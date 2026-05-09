import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()

  // Use the full @libsql/client for both production and local.
  // Vercel builds on Linux so npm install fetches the correct linux-arm64-gnu binary.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client')

  if (tursoUrl) {
    // Production: Turso remote DB (libsql:// is the correct scheme)
    const client = createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
    const adapter = new PrismaLibSql(client)
    return new PrismaClient({ adapter })
  }

  // Local development: SQLite file
  const url = `file:${path.resolve(process.cwd(), 'prisma/dev.db')}`
  const client = createClient({ url })
  const adapter = new PrismaLibSql(client)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
