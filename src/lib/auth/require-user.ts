import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(redirectTo: string | null = "/login") {
  const supabase = await createClient();
  if (!supabase) {
    if (redirectTo) redirect(redirectTo);
    return null;
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    if (redirectTo) redirect(redirectTo);
    return null;
  }

  return { supabase, user };
}
