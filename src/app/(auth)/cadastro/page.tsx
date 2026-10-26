import { AuthScreen } from "@/components/auth/auth-screen";
import { redirectIfAuthenticated } from "@/features/auth/data/session";

export default async function SignUpPage() {
  await redirectIfAuthenticated();
  return <AuthScreen mode="signup" />;
}
