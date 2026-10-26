import { LoaderCircle, Sparkles } from "lucide-react";

export function SystemStaging() {
  return (
    <section className="mx-auto flex min-h-[320px] w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
      <div className="mb-6 grid size-16 place-items-center rounded-2xl bg-selected text-primary">
        <Sparkles aria-hidden="true" className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Estamos configurando o sistema</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-text-staging">
        Aguarde enquanto concluímos a configuração do seu espaço.
      </p>
      <div className="mt-7 flex items-center gap-2 text-sm font-medium text-primary" role="status" aria-live="polite">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        Salvando sua configuração…
      </div>
    </section>
  );
}
