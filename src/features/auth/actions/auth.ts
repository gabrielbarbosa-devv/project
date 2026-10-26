"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { getEmailConfirmationRedirectUrl, getPasswordRecoveryRedirectUrl } from "@/lib/auth/redirect-urls";
import {
  recoverySchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
  type AuthActionResult,
} from "@/features/auth/schemas/auth";

export async function createAccount(input: unknown): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  if (!supabase) return { error: "Configure o Supabase antes de criar uma conta." };

  let signupResponse: Awaited<ReturnType<typeof supabase.auth.signUp>>;
  try {
    signupResponse = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.name },
        emailRedirectTo: getEmailConfirmationRedirectUrl(siteUrl),
      },
    });
  } catch {
    return { error: "Não foi possível criar sua conta agora. Tente novamente." };
  }

  const { data, error } = signupResponse;
  if (error) return { error: "Não foi possível criar sua conta com esses dados." };
  if (data.session) redirect("/onboarding");
  return { success: "Confira seu e-mail para ver os próximos passos de confirmação." };
}

export async function authenticate(input: unknown): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  if (!supabase) return { error: "Configure o Supabase antes de entrar." };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos. Tente novamente." };
  redirect("/");
}

export async function startGoogleSignIn(): Promise<AuthActionResult> {
  const supabase = await createClient();
  if (!supabase) return { error: "Configure o Supabase antes de entrar." };

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("/auth/callback?next=/", siteUrl).toString() },
  });

  if (error || !data.url) return { error: "O acesso com Google ainda não está configurado." };
  redirect(data.url);
}

export async function requestPasswordRecovery(input: unknown): Promise<AuthActionResult> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  if (!supabase) return { error: "Não foi possível solicitar a recuperação agora. Tente novamente." };

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: getPasswordRecoveryRedirectUrl(siteUrl),
    });

    if (error) {
      const authError = error as typeof error & { status?: number; code?: string };
      if (authError.status === 429 || authError.code?.includes("rate_limit")) {
        return { error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente." };
      }
      return { error: "Não foi possível solicitar a recuperação agora. Tente novamente mais tarde." };
    }
  } catch {
    return { error: "Não foi possível solicitar a recuperação agora. Verifique sua conexão e tente novamente." };
  }

  // Return the same confirmation whether or not the address belongs to an account.
  return { success: "Se o endereço estiver cadastrado, você receberá as instruções por e-mail." };
}

export async function updatePassword(input: unknown): Promise<AuthActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  if (!supabase) return { error: "Não foi possível atualizar a senha agora. Tente novamente." };
  try {
    const cookieStore = await cookies();
    if (cookieStore.get("amora_password_recovery")?.value !== "verified") {
      return { error: "Este link não está mais válido. Solicite um novo link de recuperação.", recoveryExpired: true };
    }
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return { error: "Este link expirou. Solicite um novo link de recuperação.", recoveryExpired: true };

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { error: "Este link expirou ou não pode mais ser usado. Solicite um novo link de recuperação.", recoveryExpired: true };

    await supabase.auth.signOut({ scope: "local" });
    cookieStore.delete("amora_password_recovery");
    return { success: "Senha atualizada. Entre com sua nova senha." };
  } catch {
    return { error: "Não foi possível atualizar a senha agora. Tente novamente." };
  }
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  (await cookies()).delete("amora_password_recovery");
  redirect("/login");
}
