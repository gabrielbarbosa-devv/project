"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CircleCheck, Circle, LoaderCircle, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldSeparator } from "@/components/ui/field";
import { FormField, FormPasswordInput } from "@/components/auth/form-field";
import { Input } from "@/components/ui/input";
import { authenticate, createAccount, requestPasswordRecovery, startGoogleSignIn, updatePassword } from "@/features/auth/actions/auth";
import { recoverySchema, signInSchema, signUpSchema, updatePasswordSchema, type AuthActionResult } from "@/features/auth/schemas/auth";
import type { AuthMode } from "@/components/auth/auth-screen";

type FormValues = { name?: string; email?: string; password?: string; confirmPassword?: string };
const schemaByMode = { login: signInSchema, signup: signUpSchema, recover: recoverySchema, reset: updatePasswordSchema };
const submitLabel: Record<AuthMode, string> = { login: "Entrar", signup: "Criar conta", recover: "Enviar link de recuperação", reset: "Salvar nova senha" };

export function AuthForm({ mode, googleEnabled, resetLinkValid = true }: { mode: AuthMode; googleEnabled: boolean; resetLinkValid?: boolean }) {
  const [result, setResult] = useState<AuthActionResult>({});
  const [resendFeedback, setResendFeedback] = useState<string | undefined>();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schemaByMode[mode]) as Resolver<FormValues>,
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const errors = form.formState.errors;
  const passwordValue = useWatch({ control: form.control, name: "password" }) ?? "";

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  function submit(values: FormValues) {
    setResult({});
    startTransition(async () => {
      const response = mode === "signup"
        ? await createAccount(values)
        : mode === "login"
          ? await authenticate(values)
          : mode === "recover"
            ? await requestPasswordRecovery(values)
            : await updatePassword(values);
      setResult(response);
      if (mode === "recover" && response.success) setResendCooldown(30);
    });
  }

  function resendRecoveryEmail() {
    const email = form.getValues("email");
    if (!email || pending || resendCooldown > 0) return;
    setResendFeedback(undefined);
    startTransition(async () => {
      const response = await requestPasswordRecovery({ email });
      setResendFeedback(response.error ?? "Se o endereço estiver cadastrado, você receberá as instruções por e-mail.");
      if (response.success) setResendCooldown(30);
    });
  }

  function loginWithGoogle() {
    setResult({});
    startTransition(async () => setResult(await startGoogleSignIn()));
  }

  if (mode === "signup" && result.success) {
    return (
      <section className="signup-confirmation" role="status" aria-live="polite">
        <div className="signup-confirmation-icon"><Mail size={22} aria-hidden="true" /></div>
        <h2>Confira seu e-mail</h2>
        <p>Se o endereço puder receber uma confirmação, enviaremos uma mensagem com os próximos passos.</p>
        <Link className="primary-button signup-confirmation-link" href="/login">Voltar ao login</Link>
      </section>
    );
  }

  if (mode === "recover" && result.success) {
    return (
      <section className="recovery-confirmation" aria-live="polite">
        <div className="recovery-confirmation-icon"><CircleCheck size={24} aria-hidden="true" /></div>
        <h2>Verifique sua caixa de entrada</h2>
        <p>Se o endereço estiver cadastrado, você receberá as instruções para redefinir sua senha. Confira também a pasta de spam.</p>
        <Link className="primary-button recovery-confirmation-link" href="/login">Voltar ao login</Link>
        <div className="recovery-resend">
          <Button type="button" variant="link" disabled={pending || resendCooldown > 0} onClick={resendRecoveryEmail}>
            {pending ? <><LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> Enviando...</> : resendCooldown > 0 ? `Reenviar instruções em ${resendCooldown}s` : "Reenviar instruções"}
          </Button>
          {resendFeedback && <p role="status">{resendFeedback}</p>}
        </div>
      </section>
    );
  }

  if (mode === "reset" && !resetLinkValid) {
    return <div className="recovery-expired"><Link className="primary-button recovery-confirmation-link" href="/recuperar-senha">Solicitar novo link</Link></div>;
  }

  if (mode === "reset" && result.success) {
    return (
      <section className="recovery-confirmation" aria-live="polite">
        <div className="recovery-confirmation-icon"><CircleCheck size={24} aria-hidden="true" /></div>
        <h2>Senha atualizada</h2>
        <p>Sua senha foi alterada. Entre novamente com sua nova senha.</p>
        <Link className="primary-button recovery-confirmation-link" href="/login">Ir para o login</Link>
      </section>
    );
  }

  return (
    <form className={`auth-form${mode === "signup" ? " signup-form" : ""}${mode === "recover" ? " recovery-form" : ""}${mode === "reset" ? " reset-form" : ""}`} onSubmit={form.handleSubmit(submit)} noValidate>
      {mode === "signup" && <FormField id="name" label="Nome completo" error={errors.name?.message} icon={<UserRound aria-hidden="true" size={18} />}>
        <Input id="name" autoComplete="name" maxLength={80} placeholder="Seu nome" aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} {...form.register("name")} />
      </FormField>}

      {(mode === "login" || mode === "signup" || mode === "recover") && <FormField id="email" label="E-mail" error={errors.email?.message} icon={<Mail aria-hidden="true" size={18} />}>
        <Input id="email" type="email" autoComplete="email" placeholder="voce@empresa.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...form.register("email")} />
      </FormField>}

      {(mode === "login" || mode === "signup" || mode === "reset") && <FormPasswordInput
        id="password"
        label={mode === "reset" ? "Nova senha" : "Senha"}
        error={errors.password?.message}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        placeholder={mode === "login" ? "Digite sua senha" : "Mínimo de 8 caracteres"}
        registration={form.register("password")}
        describedBy={mode === "signup" ? "signup-password-hint" : mode === "reset" ? "reset-password-hint" : undefined}
        helper={(mode === "signup" || mode === "reset") && <span className="password-hint" aria-live="polite">
          {passwordValue.length >= 8 ? <CircleCheck size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
          {passwordValue.length >= 8 ? "Mínimo de 8 caracteres atendido." : "Use pelo menos 8 caracteres."}
        </span>}
        helperId={mode === "signup" ? "signup-password-hint" : mode === "reset" ? "reset-password-hint" : undefined}
        action={mode === "login" && <Link href="/recuperar-senha" className="text-link">Esqueceu a senha?</Link>}
      />}

      {mode === "reset" && <FormPasswordInput
        id="confirmPassword"
        label="Confirmar nova senha"
        error={errors.confirmPassword?.message}
        autoComplete="new-password"
        placeholder="Digite a senha novamente"
        registration={form.register("confirmPassword")}
      />}

      {result.error && <Alert variant="destructive" className="form-alert"><AlertDescription>{result.error}{result.recoveryExpired && <> <Link href="/recuperar-senha">Solicitar novo link</Link></>}</AlertDescription></Alert>}
      {result.success && <Alert className="form-alert success-alert" role="status"><AlertDescription>{result.success}</AlertDescription></Alert>}

      <Button className="primary-button" type="submit" disabled={pending || form.formState.isSubmitting} aria-busy={pending || form.formState.isSubmitting}>
        {pending || form.formState.isSubmitting ? (mode === "recover" ? "Enviando..." : "Salvando...") : submitLabel[mode]} {!(pending || form.formState.isSubmitting) && <ArrowRight className="primary-button-arrow" size={18} aria-hidden="true" />}
      </Button>

      {mode === "recover" && <p className="recovery-note"><ShieldCheck size={19} aria-hidden="true" />Se o endereço estiver cadastrado, você receberá as instruções por e-mail.</p>}

      {(mode === "login" || mode === "signup") && <>
        <FieldSeparator className="google-separator">ou continue com</FieldSeparator>
        <Button type="button" variant="outline" className="google-button" disabled={pending || !googleEnabled} onClick={loginWithGoogle} aria-label={googleEnabled ? "Continuar com Google" : "Continuar com Google, indisponível até configurar o provedor"}>
          <GoogleMark /> Continuar com Google
        </Button>
      </>}
    </form>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5.1h6.5c3.8-3.5 6.1-8.6 6.1-14.8Z"/><path fill="#34A853" d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.5-5.1c-1.8 1.2-4 2-6.7 2-5.1 0-9.5-3.5-11.1-8.2H6.2v5.3C9.5 39.7 16.2 44 24 44Z"/><path fill="#FBBC05" d="M12.9 27.9a12 12 0 0 1 0-7.8v-5.3H6.2a20 20 0 0 0 0 18.4l6.7-5.3Z"/><path fill="#EA4335" d="M24 11.9c2.9 0 5.5 1 7.6 3l5.7-5.7C33.9 6 29.4 4 24 4 16.2 4 9.5 8.3 6.2 14.8l6.7 5.3c1.6-4.7 6-8.2 11.1-8.2Z"/></svg>;
}
