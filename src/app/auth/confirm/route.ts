import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/env";
import { getSafeAuthDestination } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = getSafeAuthDestination(url.searchParams.get("next"));
  const recoveryRequested = next === "/redefinir-senha";
  const cookieStore = await cookies();
  cookieStore.delete("amora_password_recovery");
  if (!code) {
    return redirectResponse(recoveryRequested ? "/redefinir-senha?erro=link-invalido" : "/login?auth=error");
  }

  const supabase = await createClient();

  if (!supabase) {
    return redirectResponse("/login?auth=error");
  }

  let confirmation;
  try {
    confirmation = await supabase.auth.exchangeCodeForSession(code);
  } catch {
    confirmation = null;
  }

  const validRecoveryCallback = Boolean(code) && recoveryRequested;

  if (!confirmation || confirmation.error || (recoveryRequested && !validRecoveryCallback)) {
    return redirectResponse(recoveryRequested
      ? "/redefinir-senha?erro=link-invalido"
      : "/login?auth=error");
  }

  if (validRecoveryCallback) {
    let userIsVerified = false;
    try {
      const { data, error } = await supabase.auth.getUser();
      userIsVerified = !error && Boolean(data.user);
    } catch {
      userIsVerified = false;
    }
    if (!userIsVerified) {
      return redirectResponse("/redefinir-senha?erro=link-invalido");
    }
    cookieStore.set("amora_password_recovery", "verified", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
  }

  return redirectResponse(validRecoveryCallback ? "/redefinir-senha" : "/onboarding");
}

function redirectResponse(destination: string) {
  const response = NextResponse.redirect(new URL(destination, siteUrl));
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
