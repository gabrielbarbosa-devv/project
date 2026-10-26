import { z } from "zod";

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome com pelo menos 2 caracteres.").max(80, "Use até 80 caracteres."),
  persona: z.enum(["creator", "agency", "brand"], { error: "Escolha o tipo de operação." }),
});

export const channelSchema = z.object({
  platform: z.enum(["youtube", "instagram", "tiktok", "linkedin", "facebook", "podcast", "other"]),
  name: z.string().trim().min(2, "Informe um nome para o canal.").max(80),
  handle: z.string().trim().max(80).optional(),
  url: z.union([z.literal(""), z.url("Informe um link válido.")]).optional(),
});

export type OnboardingActionResult = {
  error?: string;
  success?: string;
  channel?: { id: string; name: string; platform: string; handle: string | null };
};
