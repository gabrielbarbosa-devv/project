import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export async function redirectIfAuthenticated() {
  await connection();
  const auth = await requireUser(null);
  if (auth) redirect("/");
}
