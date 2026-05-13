import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

function buildLocalUrl(): string {
  const abs = path.resolve(process.cwd(), 'prisma/dev.db').replace(/\\/g, '/')
  return `file:///${abs}`
}

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()

  if (tursoUrl) {
    const adapter = new PrismaLibSql({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
    return new PrismaClient({ adapter })
  }

  const adapter = new PrismaLibSql({ url: buildLocalUrl() })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
