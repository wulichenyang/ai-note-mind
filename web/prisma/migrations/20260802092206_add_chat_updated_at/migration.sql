/*
  Warnings:

  - Added the required column `updatedAt` to the `chats` table without a default value. This is not possible if the table is not empty.

  ！已手动修改：
  1. 先用 createdAt 填充存量数据（保证非空）
  2. 再加 NOT NULL 约束（新数据由 Prisma @updatedAt 自动维护）
*/
-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- 存量数据：初始为创建时间（相当于"从未活跃过"）
UPDATE "chats" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- 加回非空约束
ALTER TABLE "chats" ALTER COLUMN "updatedAt" SET NOT NULL;
