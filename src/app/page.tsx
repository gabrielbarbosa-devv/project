import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="route-loading" aria-label="Carregando" />}>
      <SessionRedirect />
    </Suspense>
  );
}

async function SessionRedirect(): Promise<ReactNode> {
  await connection();
  const auth = await requireUser();
  if (!auth) redirect("/login");
  const { supabase, user } = auth;
  const { data: profile } = await supabase.from("profiles").select("onboarding_state").eq("id", user.id).maybeSingle();
  if (profile?.onboarding_state === "complete") redirect("/hoje");
  redirect("/onboarding");
  return null;
}
