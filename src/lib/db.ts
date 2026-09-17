import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
    datasourceUrl: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.includes('?')
        ? `${process.env.DATABASE_URL}&connection_limit=5&pool_timeout=5`
        : `${process.env.DATABASE_URL}?connection_limit=5&pool_timeout=5`
      : undefined,
  })

globalForPrisma.prisma = prisma
