import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client', 'libsql', '@prisma/adapter-libsql'],
};

export default nextConfig;
