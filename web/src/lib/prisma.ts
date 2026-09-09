import { PrismaClient } from "@prisma/client";

// 为什么用全局单例？
// Next.js 开发模式下每个模块可能被多次热重载，如果每次 import 都 new 一个
// PrismaClient，会不断创建新的数据库连接直到耗尽连接池。
// 用 globalThis 挂载单例，生产环境（NODE_ENV=production）直接 new 即可。
// 这是 Prisma 官方为 Next.js 推荐的写法。

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // 开发环境打印查询日志，方便学习 SQL 是怎么生成的
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
