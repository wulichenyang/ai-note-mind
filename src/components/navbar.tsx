import { auth } from "@/auth";
import NavbarClient from "@/components/navbar-client";

// 服务端组件：读取登录态后传给客户端导航条
// （登录态属于服务端数据，必须在这里取，不能发到客户端后才判断）
export default async function Navbar() {
  const session = await auth();
  const user = session?.user
    ? { name: session.user.name, email: session.user.email }
    : null;

  return <NavbarClient user={user} />;
}
