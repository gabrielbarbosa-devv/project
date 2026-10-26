import { z } from "zod";

const supabaseEnvSchema = z.object({
  url: z.url(),
  key: z.string().min(1),
});

const supabaseEnv = supabaseEnvSchema.safeParse({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export function getSupabaseEnv() {
  return supabaseEnv.success ? supabaseEnv.data : null;
}
