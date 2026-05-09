import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client')

  if (tursoUrl) {
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
