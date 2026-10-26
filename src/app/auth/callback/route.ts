import { redirect } from "next/navigation";
import { getSafeAuthDestination } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/";
  const next = getSafeAuthDestination(requestedNext);
  const supabase = await createClient();

  if (!supabase || !code) redirect("/login?auth=error");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) redirect("/login?auth=error");
  redirect(next);
}
