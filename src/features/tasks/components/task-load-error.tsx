"use client";

import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { TaskLoadIssue } from "@/features/tasks/data/kanban-presentation";

export function TaskLoadErrorPanel({ issue, className = "" }: { issue: TaskLoadIssue; className?: string }) {
  const router = useRouter();
  const authorization = issue === "authorization";

  return (
    <Alert variant="destructive" role="alert" className={`flex flex-wrap items-center justify-between gap-3 border-destructive-border-soft bg-destructive-surface-soft ${className}`}>
      <div className="min-w-0 flex-1">
        <AlertTitle>{authorization ? "Não foi possível confirmar seu acesso às tarefas" : "Não foi possível carregar suas tarefas"}</AlertTitle>
        <AlertDescription>
          {authorization
            ? "Confira sua sessão e o workspace selecionado."
            : "Verifique sua conexão e tente novamente."}
        </AlertDescription>
      </div>
      <Button type="button" variant="outline" onClick={() => router.refresh()} className="h-9 shrink-0">
        Tentar novamente
      </Button>
    </Alert>
  );
}

export function TaskWorkspaceLoadError({ issue }: { issue: TaskLoadIssue }) {
  return (
    <main className="min-w-0 flex-1 bg-card">
      <section className="mx-auto w-full max-w-[1600px] px-5 pb-8 pt-5 sm:px-7 lg:px-8">
        <nav aria-label="Trilha de navegação" className="mb-4 text-[13px] text-text-faint">Tarefas</nav>
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.8px] text-foreground">Minhas tarefas</h1>
        <p className="mt-1.5 text-[14px] text-text-gray">Organize e acompanhe tudo o que precisa ser feito hoje.</p>
        <TaskLoadErrorPanel issue={issue} className="mt-6" />
      </section>
    </main>
  );
}
