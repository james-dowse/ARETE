import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

function createPrismaClient() {
  const url = process.env.TURSO_DATABASE_URL
    ? process.env.TURSO_DATABASE_URL
    : `file:${path.resolve(process.cwd(), 'prisma/dev.db')}`

  const authToken = process.env.TURSO_AUTH_TOKEN || undefined

  const adapter = new PrismaLibSql({ url, authToken })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
