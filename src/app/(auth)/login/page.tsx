import { AuthScreen } from "@/components/auth/auth-screen";
import { redirectIfAuthenticated } from "@/features/auth/data/session";

export default async function LoginPage() {
  await redirectIfAuthenticated();
  return <AuthScreen mode="login" />;
}
