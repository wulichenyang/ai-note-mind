import { auth } from "@/auth";
import NavbarClient from "@/components/navbar-client";

// 服务端组件：读取登录态后传给客户端导航条
// （登录态属于服务端数据，必须在这里取，不能发到客户端后才判断）
// APP_ENV：当前运行环境（dev/qa/staging/production），用于显示环境徽章。
// 导航栏因依赖 auth() 是动态渲染的，所以每次请求都能拿到当前环境变量。
const env = process.env.APP_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "dev");

export default async function Navbar() {
  const session = await auth();
  const user = session?.user
    ? { name: session.user.name, email: session.user.email }
    : null;

  return <NavbarClient user={user} env={env} />;
}
