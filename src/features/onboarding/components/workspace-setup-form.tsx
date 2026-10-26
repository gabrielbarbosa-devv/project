"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, BriefcaseBusiness, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createWorkspace } from "@/features/onboarding/actions/onboarding";
import { workspaceSchema, type OnboardingActionResult } from "@/features/onboarding/schemas/onboarding";

type WorkspaceValues = { name: string; persona: "creator" | "agency" | "brand" | undefined };
const personas = [
  { value: "creator", title: "Criador(a)", detail: "Produzo conteúdo para minha marca pessoal.", icon: UserRound },
  { value: "agency", title: "Agência", detail: "Planejo conteúdo para vários clientes.", icon: BriefcaseBusiness },
  { value: "brand", title: "Marca", detail: "Organizo o conteúdo da minha empresa.", icon: Building2 },
] as const;

export function WorkspaceSetupForm() {
  const [result, setResult] = useState<OnboardingActionResult>({});
  const [pending, startTransition] = useTransition();
  const form = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema) as Resolver<WorkspaceValues>,
    defaultValues: { name: "", persona: undefined },
  });

  function submit(values: WorkspaceValues) {
    setResult({});
    startTransition(async () => setResult(await createWorkspace(values)));
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <Field className="field-group">
        <FieldLabel htmlFor="workspace-name">Como se chama seu espaço?</FieldLabel>
        <Input id="workspace-name" className="setup-input" placeholder="Ex.: Estúdio Amora" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
        {form.formState.errors.name && <p className="field-error">{form.formState.errors.name.message}</p>}
      </Field>
      <Field className="field-group persona-field">
        <FieldLabel>Qual opção descreve melhor seu trabalho?</FieldLabel>
        <Controller name="persona" control={form.control} render={({ field }) => (
          <RadioGroup className="persona-options" value={field.value} onValueChange={field.onChange} aria-invalid={!!form.formState.errors.persona}>
            {personas.map(({ value, title, detail, icon: Icon }) => (
              <RadioGroupItem className="persona-option" id={`persona-${value}`} value={value} key={value}>
                <Icon size={19} aria-hidden="true" />
                <strong>{title}</strong>
                <small>{detail}</small>
              </RadioGroupItem>
            ))}
          </RadioGroup>
        )} />
        {form.formState.errors.persona && <p className="field-error">{form.formState.errors.persona.message}</p>}
      </Field>
      {result.error && <Alert variant="destructive" className="form-alert"><AlertDescription>{result.error}</AlertDescription></Alert>}
      <div className="setup-actions"><span /><Button className="primary-button" type="submit" disabled={pending}>{pending ? "Criando espaço..." : "Continuar"}<ArrowRight size={17} /></Button></div>
    </form>
  );
}
