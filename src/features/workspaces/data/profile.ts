import { requireUser } from "@/lib/auth/require-user";
import type { UserProfile } from "@/features/workspaces/types";

export async function getCurrentProfile() {
  const auth = await requireUser(null);
  if (!auth) return null;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, persona, onboarding_state, primary_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserProfile;
}
