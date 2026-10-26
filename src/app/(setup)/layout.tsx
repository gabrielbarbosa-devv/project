import type { ReactNode } from "react";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/features/workspaces/data/profile";

export default function SetupLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="route-loading" aria-label="Carregando configuração" />}><AuthenticatedSetup>{children}</AuthenticatedSetup></Suspense>;
}

async function AuthenticatedSetup({ children }: { children: ReactNode }) {
  await connection();
  if (!await getCurrentProfile()) redirect("/login");
  return children;
}
