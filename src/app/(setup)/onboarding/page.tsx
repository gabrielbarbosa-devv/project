import { redirect } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { WorkspaceSetupForm } from "@/features/onboarding/components/workspace-setup-form";
import { SetupHeader } from "@/features/onboarding/components/setup-header";
import { getCurrentProfile } from "@/features/workspaces/data/profile";

export default async function WorkspaceSetupPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.onboarding_state === "complete") redirect("/hoje");
  if (profile.onboarding_state === "channels") redirect("/onboarding/canais");

  return <main className="setup-stage"><SetupHeader /><section className="setup-main">
    <div className="setup-progress"><span>Etapa 1 de 2</span><Progress value={50} className="progress-track" /><span>50%</span></div>
    <div className="setup-card">
      <span className="form-kicker">SEU ESPAÇO COMEÇA AQUI</span>
      <h1>Vamos organizar seu trabalho</h1>
      <p>Conte um pouco sobre sua operação e dê um nome ao seu espaço de trabalho.</p>
      <WorkspaceSetupForm />
    </div>
  </section></main>;
}
