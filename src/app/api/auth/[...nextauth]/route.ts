import { handlers } from "@/auth";

// Auth.js v5 要求：把 handlers 挂到 [...nextauth] 动态路由
// 所有认证相关的请求（登录、回调、登出）都走这里
export const { GET, POST } = handlers;
