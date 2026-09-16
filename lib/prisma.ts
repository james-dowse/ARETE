import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

function buildLocalUrl(): string {
  const abs = path.resolve(process.cwd(), 'prisma/dev.db').replace(/\\/g, '/')
  return `file:///${abs}`
}

function createPrismaClient() {
  // Échappatoire explicite pour `npm run dev:local` (scripts/dev-local.mjs) :
  // sans elle, `.env.local` définit TURSO_DATABASE_URL et le serveur de
  // développement écrit dans la base de PRODUCTION. Next recharge lui-même les
  // fichiers .env au démarrage, donc neutraliser la variable dans le processus
  // fils ne suffit pas — d'où ce drapeau, qui a la priorité.
  if (process.env.ARETE_LOCAL_DB === '1') {
    return new PrismaClient({ adapter: new PrismaLibSql({ url: buildLocalUrl() }) })
  }

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
