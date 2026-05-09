import { defineConfig } from 'prisma/config'

// prisma.config.ts is used by Prisma CLI only.
// Runtime connections go through the adapter in lib/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
})
