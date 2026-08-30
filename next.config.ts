import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma', '@libsql/client', 'libsql', '@prisma/adapter-libsql'],
  // Le typecheck de `next build` tourne dans un worker séparé dont le stack
  // V8 ne peut pas être agrandi (Node rejette --stack-size aussi bien via
  // NODE_OPTIONS que via execArgv hérité d'un worker_thread) : sur ce schéma
  // Prisma volumineux, un premier passage à froid (cache `.next/cache` vide)
  // fait systématiquement "Maximum call stack size exceeded", indépendamment
  // du nombre d'erreurs réelles. `npm run deploy` fait déjà tourner
  // `npx tsc --noEmit` en amont (scripts/deploy.mjs) comme unique gate de
  // typage fiable — celui-ci supporte l'agrandissement du stack et est donc
  // le vrai filet de sécurité. Désactiver la vérification redondante ici
  // évite de bloquer le build sur un problème d'outillage, pas de code.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
