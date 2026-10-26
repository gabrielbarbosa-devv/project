import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/features/auth/components/auth-form";
import { googleAuthEnabled } from "@/lib/env";

export type AuthMode = "login" | "signup" | "recover" | "reset";

const copy: Record<AuthMode, { eyebrow?: string; title: string; description: string }> = {
  login: { title: "Entre na sua conta", description: "Organize sua operação de conteúdo em um só lugar." },
  signup: { title: "Crie sua conta", description: "Comece a organizar seus conteúdos em um só lugar." },
  recover: { title: "Recuperar sua senha", description: "Informe seu e-mail para receber um link de redefinição." },
  reset: { title: "Defina sua nova senha", description: "Escolha uma nova senha para voltar a acessar a Amora." },
};

export function AuthScreen({ mode, resetLinkValid = true }: { mode: AuthMode; resetLinkValid?: boolean }) {
  const message = copy[mode];
  const invalidReset = mode === "reset" && !resetLinkValid;

  return (
    <AuthShell>
      <div className={mode === "signup" ? "signup-screen" : mode === "recover" || mode === "reset" ? "recovery-screen" : undefined}>
        {(mode === "recover" || mode === "reset") && <Link className="auth-back-link" href="/login"><ArrowLeft size={18} aria-hidden="true" />Voltar ao login</Link>}
        <div className="form-heading">
          <h1>{invalidReset ? "Link inválido ou expirado" : message.title}</h1>
          <p>{invalidReset ? "Este link de recuperação não é mais válido. Solicite um novo link para continuar." : message.description}</p>
        </div>
        <AuthForm mode={mode} googleEnabled={googleAuthEnabled} resetLinkValid={resetLinkValid} />
        <div className="auth-switch">
          {mode === "login" && <>Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link></>}
          {mode === "signup" && <>Já tem uma conta? <Link href="/login">Entrar</Link></>}
          {mode === "recover" && <>Voltar ao login <Link href="/login">Entrar</Link></>}
          {mode === "reset" && resetLinkValid && <>Precisa de outro link? <Link href="/recuperar-senha">Recuperar senha</Link></>}
        </div>
      </div>
    </AuthShell>
  );
}
