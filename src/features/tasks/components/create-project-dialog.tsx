"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FolderPlus, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createProject } from "@/features/tasks/actions/tasks";
import { createProjectSchema } from "@/features/tasks/schemas/task.schema";

export function CreateProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createProjectSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe um nome para o projeto.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await createProject(parsed.data);
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      setOpen(false);
      onCreated();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-11 gap-2 rounded-[10px] border-border bg-card px-3 text-[13px] text-text-secondary hover:bg-muted">
        <FolderPlus aria-hidden="true" className="size-4" /> <span className="hidden sm:inline">Novo projeto</span>
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>Organize tarefas relacionadas em um projeto deste workspace.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-5" onSubmit={submit} noValidate>
            <Field>
              <FieldLabel htmlFor="project-name">Nome do projeto</FieldLabel>
              <Input id="project-name" autoFocus maxLength={80} value={name} aria-invalid={!!error} aria-describedby={error ? "project-name-error" : undefined} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="Ex.: Lançamento do canal" className="h-11" />
              {error && <FieldError id="project-name-error">{error}</FieldError>}
            </Field>
            <div className="flex justify-end gap-2 border-t border-border-soft pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
              <Button type="submit" disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary-dark">{pending ? <><LoaderCircle className="size-4 animate-spin" /> Criando...</> : "Criar projeto"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
