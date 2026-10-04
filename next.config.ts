import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma', '@libsql/client', 'libsql', '@prisma/adapter-libsql'],
  // Le typecheck de `next build` tourne dans un worker séparé dont le stack
  // V8 ne peut pas être agrandi (Node rejette --stack-size aussi bien via
  // NODE_OPTIONS que via execArgv hérité d'un worker_thread) : sur ce schéma
  // Prisma volumineux, un premier passage à froid (cache `.next/cache` vide)
  // fait systématiquement "Maximum call stack size exceeded", indépendamment
  // du nombre d'erreurs réelles. `npm run deploy` fait tourner `npx tsc
  // --noEmit` en amont (scripts/deploy.mjs) : c'est le SEUL gate de typage du
  // projet, puisque la ligne ci-dessous désactive celui du build. Il tourne
  // hors du worker de `next build`, et c'est tout l'intérêt : là, la pile PEUT
  // être agrandie. scripts/deploy.mjs l'appelle donc en direct avec
  // `node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit`.
  // `npx tsc --noEmit` nu déborde, lui aussi : le lanceur npx ne transmet pas
  // le drapeau. Ne pas revenir à la forme courte en croyant simplifier.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
