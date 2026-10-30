"use client";

import { CalendarDays, Flag, Folder, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TaskRowActions, type TaskAction, type TaskActionResult } from "@/features/tasks/components/task-row-actions";
import { TaskChecklistProgress } from "@/features/tasks/components/task-checklist-progress";
import { TaskLabelBadges } from "@/features/tasks/components/task-label-badges";
import { formatTaskDate, getTaskPriorityPresentation } from "@/features/tasks/data/presentation";
import { addDays } from "@/features/tasks/data/task-filtering";
import type { Project, Task, TaskLabel, TaskStatus } from "@/features/tasks/data/queries";

type Props = {
  task: Task;
  projectName: string | null;
  labels: TaskLabel[];
  checklistTotal: number;
  checklistCompleted: number;
  today: string;
  archived: boolean;
  selected: boolean;
  projects: Project[];
  pending?: boolean;
  dragging?: boolean;
  onOpen: (task: Task, opener?: HTMLElement | null) => void;
  onAction: (action: TaskAction, task: Task, projectId?: string, requestId?: string) => Promise<TaskActionResult>;
  onMoveStatus?: (task: Task, status: TaskStatus) => Promise<void>;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
};

/** Detailed Kanban card. All task, project, label and checklist data comes from the workspace query. */
export function KanbanTaskCard({ task, projectName, labels, checklistTotal, checklistCompleted, today, archived, selected, projects, pending = false, dragging = false, onOpen, onAction, onMoveStatus, onDragStart, onDragEnd }: Props) {
  const completed = task.status === "completed";
  const priority = getTaskPriorityPresentation(task.priority);
  // The deadline is the most relevant compact date; planned date remains in the existing details sheet.
  const date = task.due_on ?? task.planned_for;
  const dateLabel = date === today ? "Hoje" : date === addDays(today, 1) ? "Amanhã" : date ? formatTaskDate(date) : "Sem prazo";
  const overdue = task.status !== "completed" && Boolean(task.due_on && task.due_on < today);
  const dateTitle = task.due_on
    ? overdue ? `Prazo final vencido: ${dateLabel}` : `Prazo final: ${dateLabel}`
    : task.planned_for ? `Planejada para: ${dateLabel}` : "Sem prazo";
  const descriptionId = `kanban-task-description-${task.id}`;

  return (
    <Card
      role="group"
      aria-label={`Tarefa: ${task.title}`}
      aria-roledescription={!archived ? "cartão arrastável" : undefined}
      draggable={!archived && !pending}
      data-selected={selected || undefined}
      onDragStart={(event) => {
        if (archived || pending) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart?.(task.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={(event) => {
        const opener = event.currentTarget.querySelector<HTMLButtonElement>(".amora-kanban-card-open");
        opener?.focus({ preventScroll: true });
        onOpen(task, opener);
      }}
      className={`amora-kanban-card group relative block gap-0 overflow-visible rounded-[11px] border border-border-soft bg-card p-3 shadow-[0_1px_3px_rgba(24,28,45,0.035)] ring-0 transition-[border-color,box-shadow,background-color,opacity] duration-150 ease-out hover:border-primary/35 hover:bg-hover hover:shadow-[0_3px_12px_rgba(0,0,0,0.05)] active:bg-hover motion-reduce:transition-none ${!archived && !pending ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${selected ? "border-primary/75" : ""} ${dragging ? "opacity-45" : ""}`}
    >
      <div className="flex min-w-0 items-start gap-1">
        <button
          type="button"
          data-task-title-id={task.id}
          data-task-view="kanban"
          onClick={(event) => { event.stopPropagation(); onOpen(task, event.currentTarget); }}
          title={task.title}
          aria-label={`Abrir tarefa: ${task.title}`}
          aria-describedby={task.description?.trim() ? descriptionId : undefined}
          className={`amora-kanban-card-open line-clamp-2 min-w-0 flex-1 rounded-sm text-left text-[13px] font-semibold leading-[18px] tracking-[-0.1px] text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${completed ? "text-text-soft line-through" : ""}`}
        >
          {task.title}
        </button>
        <div className="-mr-1 -mt-1 shrink-0" onClick={(event) => event.stopPropagation()}>
          <TaskRowActions task={task} projects={projects} archived={archived} onOpen={onOpen} onAction={onAction} onMoveStatus={onMoveStatus ? (status) => onMoveStatus(task, status) : undefined} statusChangePending={pending} />
        </div>
      </div>

      {task.description?.trim() && (
        <>
          <span id={descriptionId} className="sr-only">Descrição: {task.description}</span>
          <p aria-hidden="true" className="mt-1.5 line-clamp-2 text-[12px] leading-[17px] text-text-gray">
            {task.description}
          </p>
        </>
      )}

      <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="Projeto e etiquetas">
        <Badge variant="secondary" title={projectName ?? "Sem projeto"} aria-label={`Projeto: ${projectName ?? "Sem projeto"}`} className="h-5 min-w-0 max-w-[42%] shrink gap-1 rounded-md border-0 bg-surface-soft px-1.5 text-[10px] font-medium text-text-secondary">
          <Folder aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{projectName ?? "Sem projeto"}</span>
        </Badge>
        <TaskLabelBadges labels={labels} />
      </div>

      <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[11px] leading-4">
        <span className={`inline-flex min-w-0 items-center gap-1 truncate ${overdue ? "text-destructive" : "text-text-faint"}`} title={dateTitle}>
          <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{dateLabel}</span>
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1 ${priority.color}`}>
          <Flag aria-hidden="true" className="size-3.5" fill="currentColor" strokeWidth={1.5} /> {priority.label}
        </span>
      </div>

      {checklistTotal > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-border-soft pt-2">
          <TaskChecklistProgress totalCount={checklistTotal} completedCount={checklistCompleted} />
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-text-faint">
            <ListChecks aria-hidden="true" className="size-3.5" />
            Checklist
          </span>
        </div>
      )}
    </Card>
  );
}
