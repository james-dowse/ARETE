import { defineConfig } from 'prisma/config'

// prisma.config.ts is read by both the Prisma CLI and the runtime WASM engine.
// datasource.url is used by the WASM engine for initialization/metadata.
// Actual database connections go through the adapter passed to PrismaClient().
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.TURSO_DATABASE_URL ?? 'file:./prisma/dev.db',
  },
})
