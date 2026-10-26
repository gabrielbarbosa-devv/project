"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { channelSchema, workspaceSchema, type OnboardingActionResult } from "@/features/onboarding/schemas/onboarding";

export async function createWorkspace(input: unknown): Promise<OnboardingActionResult> {
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const auth = await requireUser(null);
  if (!auth) return { error: "Sua sessão expirou. Entre novamente." };
  const { supabase } = auth;

  const { error } = await supabase.rpc("create_workspace_for_current_user", {
    p_name: parsed.data.name,
    p_persona: parsed.data.persona,
  });
  if (error) return { error: "Não foi possível criar seu espaço. Confira o nome e tente novamente." };
  redirect("/onboarding/canais");
}

export async function addChannel(input: unknown): Promise<OnboardingActionResult> {
  const parsed = channelSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const auth = await requireUser(null);
  if (!auth) return { error: "Sua sessão expirou. Entre novamente." };
  const { supabase, user } = auth;

  const { data: profile } = await supabase
    .from("profiles")
    .select("primary_workspace_id, onboarding_state")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.primary_workspace_id || profile.onboarding_state !== "channels") {
    return { error: "Finalize primeiro a configuração do seu espaço." };
  }

  const { data: channel, error } = await supabase
    .from("channels")
    .insert({
      workspace_id: profile.primary_workspace_id,
      platform: parsed.data.platform,
      name: parsed.data.name,
      handle: parsed.data.handle || null,
      url: parsed.data.url || null,
      created_by: user.id,
    })
    .select("id, name, platform, handle")
    .single();
  if (error) return { error: "Não foi possível adicionar esse canal. Tente novamente." };
  return { success: "Canal adicionado ao seu espaço.", channel };
}

export async function finishOnboarding(): Promise<OnboardingActionResult> {
  const auth = await requireUser(null);
  if (!auth) return { error: "Sua sessão expirou. Entre novamente." };
  const { supabase } = auth;
  const { error } = await supabase.rpc("complete_my_onboarding");
  if (error) return { error: "Crie seu espaço de trabalho antes de concluir." };
  return { success: "Configuração concluída." };
}
