import { redirect } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { ChannelsSetupForm } from "@/features/onboarding/components/channels-setup-form";
import { SetupHeader } from "@/features/onboarding/components/setup-header";
import { getCurrentProfile } from "@/features/workspaces/data/profile";
import { createClient } from "@/lib/supabase/server";

export default async function ChannelSetupPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.onboarding_state === "workspace") redirect("/onboarding");
  if (profile.onboarding_state === "complete") redirect("/hoje");

  const supabase = await createClient();
  const { data: channels } = await supabase!.from("channels").select("id, name, platform, handle").eq("workspace_id", profile.primary_workspace_id!).order("created_at");

  return <main className="setup-stage"><SetupHeader /><section className="setup-main">
    <div className="setup-progress"><span>Etapa 2 de 2</span><Progress value={100} className="progress-track" /><span>100%</span></div>
    <div className="setup-card">
      <span className="form-kicker">CONECTE SUAS IDEIAS</span>
      <h1>Quais canais você usa?</h1>
      <p>Cadastre os canais que sua equipe organiza. Você também pode pular esta etapa e adicionar depois.</p>
      <ChannelsSetupForm initialChannels={channels ?? []} />
    </div>
  </section></main>;
}
