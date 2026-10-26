"use client";

import { AlertTriangle, Plus, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanTaskCard } from "@/features/tasks/components/kanban-task-card";
import { KanbanEmptyColumn } from "@/features/tasks/components/kanban-empty-column";
import type { TaskAction, TaskActionResult } from "@/features/tasks/components/task-row-actions";
import { groupKanbanTasks } from "@/features/tasks/data/presentation";
import { getKanbanEmptyState, getUnmappedKanbanTasks } from "@/features/tasks/data/kanban-presentation";
import type { Project, Task, TaskKanbanMetadata, TaskLabel } from "@/features/tasks/data/queries";

const columnTone = {
  pending: "amora-kanban-status-pending",
  in_progress: "amora-kanban-status-progress",
  completed: "amora-kanban-status-completed",
  paused: "amora-kanban-status-paused",
} as const;

type Props = {
  tasks: Task[];
  projects: Project[];
  labels: TaskLabel[];
  metadata: Record<string, TaskKanbanMetadata>;
  today: string;
  archived: boolean;
  filtered: boolean;
  selectedTaskId: string | null;
  onOpen: (task: Task, opener?: HTMLElement | null) => void;
  onAction: (action: TaskAction, task: Task, projectId?: string, requestId?: string) => Promise<TaskActionResult>;
  onCreate: () => void;
  onClearFilters: () => void;
};

export function TaskKanbanView({ tasks, projects, labels, metadata, today, archived, filtered, selectedTaskId, onOpen, onAction, onCreate, onClearFilters }: Props) {
  const columns = groupKanbanTasks(tasks);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const labelNames = new Map(labels.map((label) => [label.id, label]));
  const emptyState = getKanbanEmptyState(tasks.length, filtered);
  const workspaceEmpty = emptyState === "workspace";
  const unmappedTasks = getUnmappedKanbanTasks(tasks, columns);

  if (emptyState === "filtered") {
    return (
      <div role="status" className="grid min-h-[420px] place-items-center rounded-[13px] border border-border-soft bg-muted/45 px-5 py-10 text-center">
        <Card className="w-full max-w-[440px] items-center gap-0 rounded-xl border border-border-soft bg-card p-7 shadow-none sm:p-9">
          <span className="grid size-11 place-items-center rounded-xl border border-border-soft bg-muted text-text-secondary">
            <SearchX aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold tracking-[-0.2px] text-foreground">
            Nenhuma tarefa encontrada
          </h2>
          <p className="mt-1.5 max-w-sm text-sm leading-5 text-text-gray">
            Experimente alterar os filtros ou o termo pesquisado.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onClearFilters}
            className="mt-5 h-10 rounded-lg px-4"
          >
            Limpar filtros
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {unmappedTasks.length > 0 && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-state-overdue/25 bg-state-overdue-surface px-3 py-2.5 text-sm text-foreground">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-state-overdue" />
          <div className="min-w-0">
            <p className="font-medium">Algumas tarefas estão com um status não reconhecido pelo Kanban.</p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {unmappedTasks.map((task) => (
                <li key={task.id}>
                  <button type="button" onClick={(event) => onOpen(task, event.currentTarget)} className="rounded-sm underline decoration-text-faint underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">
                    Abrir detalhes: {task.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div
        role="region"
        tabIndex={0}
        aria-label="Quadro Kanban de tarefas. Role horizontalmente para navegar entre as colunas."
        className="grid min-w-0 auto-cols-[minmax(276px,1fr)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {columns.map((column) => (
          <section
            key={column.key}
            aria-labelledby={`kanban-column-${column.key}`}
            className="flex h-[min(640px,calc(100dvh-300px))] min-h-[420px] min-w-0 flex-col overflow-hidden rounded-[13px] border border-border-soft bg-muted"
          >
            <header className="flex h-12 shrink-0 items-center gap-2 px-3">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${columnTone[column.key]}`} />
              <h2 id={`kanban-column-${column.key}`} className="min-w-0 truncate text-[13px] font-semibold text-foreground">{column.label}</h2>
              <Badge variant="secondary" className="amora-kanban-count h-5 min-w-5 justify-center rounded-md border-0 bg-card px-1.5 text-[11px] font-semibold tabular-nums text-text-secondary">
                {column.tasks.length}
              </Badge>
              {column.key === "pending" && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Adicionar tarefa a fazer" onClick={onCreate} className="ml-auto size-7 text-text-faint hover:text-foreground">
                  <Plus aria-hidden="true" className="size-4" />
                </Button>
              )}
            </header>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-3" aria-live={column.tasks.length > 0 ? "polite" : undefined}>
              {column.tasks.length ? column.tasks.map((task) => (
                <KanbanTaskCard
                  key={task.id}
                  task={task}
                  projectName={task.project_id ? projectNames.get(task.project_id) ?? "Projeto indisponível" : null}
                  labels={(metadata[task.id]?.labelIds ?? []).map((id) => labelNames.get(id)).filter((label): label is TaskLabel => Boolean(label))}
                  checklistTotal={metadata[task.id]?.checklistTotal ?? 0}
                  checklistCompleted={metadata[task.id]?.checklistCompleted ?? 0}
                  today={today}
                  archived={archived}
                  selected={selectedTaskId === task.id}
                  projects={projects}
                  onOpen={onOpen}
                  onAction={onAction}
                />
              )) : (
                <KanbanEmptyColumn
                  column={column}
                  filtersActive={filtered}
                  welcome={workspaceEmpty && column.key === "pending"}
                  announce={!workspaceEmpty || column.key === "pending"}
                />
              )}
            </div>

            {column.key === "pending" && (
              <div className="shrink-0 px-3 pb-3">
                <Button type="button" variant="ghost" onClick={onCreate} className="h-9 w-full justify-center gap-2 rounded-lg border border-dashed border-border-soft text-[12px] font-normal text-text-faint hover:border-primary/30 hover:bg-selection-soft hover:text-primary">
                  <Plus aria-hidden="true" className="size-3.5" /> Adicionar tarefa
                </Button>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function TaskKanbanSkeleton() {
  return (
    <main className="amora-kanban-page min-w-0 flex-1 bg-card" aria-busy="true">
      <section className="mx-auto w-full max-w-[1600px] px-5 pb-8 pt-5 sm:px-7 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4" aria-hidden="true">
          <div className="grid min-w-0 gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-64 max-w-[80vw]" />
            <Skeleton className="h-4 w-80 max-w-[85vw]" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-4" aria-hidden="true">
          <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-[190px] rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>
        </div>
        <div role="region" aria-label="Carregando quadro Kanban" className="grid min-w-0 auto-cols-[minmax(276px,1fr)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-2">
          {Array.from({ length: 4 }, (_, column) => (
            <div key={column} className="flex h-[min(640px,calc(100dvh-300px))] min-h-[420px] min-w-0 flex-col overflow-hidden rounded-[13px] border border-border-soft bg-muted p-3">
              <div className="flex h-12 shrink-0 items-center gap-2" aria-hidden="true">
                <Skeleton className="size-2 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-6 rounded-md" />
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden pb-3" aria-hidden="true">
                {Array.from({ length: 3 }, (_, card) => (
                  <Card key={card} className="gap-2 rounded-[11px] border border-border-soft bg-card p-3 shadow-none">
                    <Skeleton className={`h-4 ${card === 1 ? "w-3/4" : "w-full"}`} />
                    {card !== 1 && <div className="grid gap-1"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-2/3" /></div>}
                    <div className="mt-1 flex gap-1.5"><Skeleton className="h-[22px] w-20 rounded-md" /><Skeleton className="h-[22px] w-14 rounded-md" /></div>
                    <div className="mt-1 flex items-center justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-12" /></div>
                    {card === 0 && <div className="mt-1 flex items-center gap-2 border-t border-dashed border-border-soft pt-2"><Skeleton className="size-4 rounded-full" /><Skeleton className="h-3 w-24" /></div>}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only" role="status">Carregando tarefas do workspace.</span>
      </section>
    </main>
  );
}
