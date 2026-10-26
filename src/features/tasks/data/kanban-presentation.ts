import type { KanbanColumn } from "@/features/tasks/data/presentation";
import type { Task } from "@/features/tasks/data/queries";

export type TaskLoadIssue = "connection" | "authorization";

export function getKanbanEmptyState(taskCount: number, hasFilters: boolean) {
  if (taskCount > 0) return null;
  return hasFilters ? "filtered" as const : "workspace" as const;
}

/** Keeps real records visible if a future/invalid status is not assigned to a Kanban column yet. */
export function getUnmappedKanbanTasks(tasks: Task[], columns: KanbanColumn[]) {
  const displayedTaskIds = new Set(columns.flatMap((column) => column.tasks.map((task) => task.id)));
  return tasks.filter((task) => !displayedTaskIds.has(task.id));
}

export function summarizeKanbanLabels<T>(labels: T[], visibleLimit = 2) {
  const safeLimit = Math.max(0, Math.floor(visibleLimit));
  return {
    visible: labels.slice(0, safeLimit),
    hiddenCount: Math.max(0, labels.length - safeLimit),
  };
}

export function classifyTaskLoadIssue(error: { code?: unknown; status?: unknown } | null | undefined): TaskLoadIssue {
  const code = typeof error?.code === "string" ? error.code.toUpperCase() : "";
  const status = typeof error?.status === "number" ? error.status : Number(error?.status);
  return status === 401 || status === 403 || ["401", "403", "42501", "PGRST301", "PGRST302"].includes(code)
    ? "authorization"
    : "connection";
}
