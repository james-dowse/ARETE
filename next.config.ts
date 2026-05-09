import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma', '@libsql/client', 'libsql', '@prisma/adapter-libsql'],
};

export default nextConfig;
