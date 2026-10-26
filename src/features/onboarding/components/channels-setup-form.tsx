"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Camera as Instagram, Plus, Play as Youtube } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addChannel, finishOnboarding } from "@/features/onboarding/actions/onboarding";
import { channelSchema, type OnboardingActionResult } from "@/features/onboarding/schemas/onboarding";
import { SystemStaging } from "@/features/onboarding/components/system-staging";

type ChannelValues = { platform: "youtube" | "instagram" | "tiktok" | "linkedin" | "facebook" | "podcast" | "other"; name: string; handle?: string; url?: string };
type ExistingChannel = { id: string; name: string; platform: string; handle: string | null };
const platforms = [
  ["instagram", "Instagram"], ["youtube", "YouTube"], ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"], ["facebook", "Facebook"], ["podcast", "Podcast"], ["other", "Outro"],
] as const;

export function ChannelsSetupForm({ initialChannels }: { initialChannels: ExistingChannel[] }) {
  const [channels, setChannels] = useState(initialChannels);
  const [result, setResult] = useState<OnboardingActionResult>({});
  const [finishing, setFinishing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<ChannelValues>({
    resolver: zodResolver(channelSchema) as Resolver<ChannelValues>,
    defaultValues: { platform: "instagram", name: "", handle: "", url: "" },
  });

  function add(values: ChannelValues) {
    setResult({});
    startTransition(async () => {
      const response = await addChannel(values);
      setResult(response);
      if (response.success && response.channel) {
        setChannels((current) => [...current, response.channel!]);
        form.reset({ platform: "instagram", name: "", handle: "", url: "" });
      }
    });
  }

  function finish() {
    if (finishing || pending) return;
    setResult({});
    setFinishing(true);
    startTransition(async () => {
      try {
        const response = await finishOnboarding();
        if (response.success) {
          router.replace("/hoje");
          router.refresh();
          return;
        }
        setResult(response);
      } catch {
        setResult({ error: "Não foi possível concluir agora. Verifique sua conexão e tente novamente." });
      } finally {
        setFinishing(false);
      }
    });
  }

  if (finishing) return <SystemStaging />;

  return (
    <div>
      <form className="channel-form" onSubmit={form.handleSubmit(add)} noValidate>
        <div className="channel-row">
          <Field className="field-group">
            <FieldLabel htmlFor="platform">Plataforma</FieldLabel>
            <Controller name="platform" control={form.control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="platform" className="setup-select"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{platforms.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field className="field-group">
            <FieldLabel htmlFor="channel-name">Nome do canal</FieldLabel>
            <Input id="channel-name" className="setup-input" placeholder="Ex.: Amora no Instagram" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
          </Field>
        </div>
        {form.formState.errors.name && <p className="field-error">{form.formState.errors.name.message}</p>}
        <div className="channel-row channel-row-secondary">
          <Field className="field-group">
            <FieldLabel htmlFor="channel-handle">Usuário <span>(opcional)</span></FieldLabel>
            <Input id="channel-handle" className="setup-input" placeholder="@seucanal" {...form.register("handle")} />
          </Field>
          <Field className="field-group">
            <FieldLabel htmlFor="channel-url">Link <span>(opcional)</span></FieldLabel>
            <Input id="channel-url" type="url" className="setup-input" placeholder="https://..." aria-invalid={!!form.formState.errors.url} {...form.register("url")} />
          </Field>
        </div>
        {form.formState.errors.url && <p className="field-error">{form.formState.errors.url.message}</p>}
        <Button className="add-channel-button" type="submit" variant="outline" disabled={pending}><Plus size={16} />{pending ? "Adicionando..." : "Adicionar canal"}</Button>
      </form>

      {channels.length > 0 && <div className="channel-list" aria-label="Canais adicionados">{channels.map((channel) => {
        const Icon = channel.platform === "youtube" ? Youtube : Instagram;
        return <div className="channel-list-item" key={channel.id}><span className="channel-chip"><Icon size={16} />{channel.name}</span><small>{channel.handle}</small></div>;
      })}</div>}
      {result.error && <Alert variant="destructive" className="form-alert"><AlertDescription>{result.error}</AlertDescription></Alert>}
      {result.success && <p className="channel-success" role="status">{result.success}</p>}
      <div className="setup-actions setup-actions-channel">
        <Button className="secondary-button" type="button" variant="outline" onClick={finish} disabled={pending}>Pular por agora</Button>
        <Button className="primary-button" type="button" onClick={finish} disabled={pending}>{pending ? "Concluindo..." : "Concluir configuração"}<ArrowRight size={17} /></Button>
      </div>
    </div>
  );
}
