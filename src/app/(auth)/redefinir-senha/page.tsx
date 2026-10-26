import { AuthScreen } from "@/components/auth/auth-screen";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export default async function ResetPasswordPage() {
  await connection();
  const [auth, cookieStore] = await Promise.all([requireUser(null), cookies()]);
  const recoveryCookie = cookieStore.get("amora_password_recovery")?.value === "verified";
  return <AuthScreen mode="reset" resetLinkValid={Boolean(auth?.user && recoveryCookie)} />;
}
