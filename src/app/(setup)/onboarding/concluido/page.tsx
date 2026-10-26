import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/features/workspaces/data/profile";

export default async function SetupCompletePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.onboarding_state !== "complete") redirect(profile.onboarding_state === "channels" ? "/onboarding/canais" : "/onboarding");
  redirect("/hoje");
}
