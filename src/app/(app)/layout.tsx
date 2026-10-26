import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-card" role="status" aria-label="Carregando área de trabalho" />}>
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </Suspense>
  );
}

async function AuthenticatedApp({ children }: { children: ReactNode }) {
  await connection();
  const cookieStore = await cookies();
  const auth = await requireUser();
  if (!auth) return null;

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("full_name, persona, onboarding_state, primary_workspace_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile) redirect("/login");
  if (profile.onboarding_state !== "complete") {
    redirect(profile.onboarding_state === "channels" ? "/onboarding/canais" : "/onboarding");
  }

  const { data: workspace } = profile.primary_workspace_id
    ? await auth.supabase
        .from("workspaces")
        .select("id, name, slug")
        .eq("id", profile.primary_workspace_id)
        .maybeSingle()
    : { data: null };
  const { data: projects, error: projectsError } = workspace
    ? await auth.supabase.from("projects").select("id, name").eq("workspace_id", workspace.id).order("name")
    : { data: [] };

  return (
    <AppShell
      email={auth.user.email}
      name={profile.full_name}
      persona={profile.persona}
      workspace={workspace}
      projects={projects ?? []}
      projectsLoadError={Boolean(projectsError)}
      sidebarDefaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </AppShell>
  );
}
