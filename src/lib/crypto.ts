import "server-only";
import crypto from "node:crypto";

/**
 * 用户 AI Key 的加密/解密（AES-256-GCM）
 * -------------------------------------------------
 * 为什么存加密而不是明文？
 * 数据库一旦泄露，明文 Key 直接可被滥用。AES-256-GCM 提供机密性 +
 * 完整性（auth tag 防篡改），Key 的明文只存在于服务端内存中的那一次调用。
 *
 * 主密钥 ENCRYPTION_KEY：
 * - 64 位 hex（32 字节），从环境变量读取
 * - 每个环境（本地/线上）独立生成，线上绝不使用本地同一把
 * - 泄露 ENCRYPTION_KEY ≈ 泄露所有用户的 Key，务必妥善保管
 *
 * 存储格式：iv:authTag:ciphertext（均为 hex）
 * 每次加密生成随机 IV，因此同一明文两次加密结果不同（语义安全）。
 */

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("加密主密钥未配置：请设置 ENCRYPTION_KEY（64 位 hex）");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("加密数据格式非法");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
