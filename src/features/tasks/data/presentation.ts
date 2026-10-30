import type { Task } from "@/features/tasks/data/queries";

export type TaskGroupKey = "today" | "overdue" | "completed" | "upcoming" | "unscheduled" | "other" | "archived";
export type TaskGroup = { key: TaskGroupKey; label: string; tasks: Task[] };
export type KanbanColumnKey = "pending" | "in_progress" | "completed" | "paused";
export type KanbanColumn = { key: KanbanColumnKey; label: string; tasks: Task[] };

const taskPriorities: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "text-priority-high" },
  medium: { label: "Média", color: "text-priority-medium" },
  low: { label: "Baixa", color: "text-priority-low" },
};

export function getTaskPriorityPresentation(priority: string) {
  return taskPriorities[priority] ?? taskPriorities.medium;
}

const kanbanColumns: Array<[KanbanColumnKey, string, (task: Task) => boolean]> = [
  ["pending", "A fazer", (task) => task.status === "pending"],
  ["in_progress", "Em andamento", (task) => task.status === "in_progress"],
  ["completed", "Concluídas", (task) => task.status === "completed"],
  ["paused", "Pausadas", (task) => task.status === "paused"],
];

export function groupKanbanTasks(tasks: Task[]): KanbanColumn[] {
  return kanbanColumns.map(([key, label, matches]) => ({
    key,
    label,
    tasks: tasks.filter(matches),
  }));
}

export function formatTaskDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date).replace(".", "");
}

export function groupTasks(tasks: Task[], today: string, archivedView: boolean): TaskGroup[] {
  const order: Array<[TaskGroupKey, string]> = archivedView
    ? [["archived", "Arquivadas"]]
    : [
        ["today", "Hoje"],
        ["overdue", "Atrasadas"],
        ["upcoming", "Próximas"],
        ["unscheduled", "Sem data"],
        ["other", "Planejadas"],
        ["completed", "Concluídas"],
      ];
  const grouped = new Map<TaskGroupKey, Task[]>();
  for (const task of tasks) {
    let key: TaskGroupKey;
    if (archivedView) key = "archived";
    else if (task.status === "completed") key = "completed";
    else if (task.due_on && task.due_on < today) key = "overdue";
    else if (task.planned_for === today || task.due_on === today) key = "today";
    else if ((task.planned_for && task.planned_for > today) || (task.due_on && task.due_on > today)) key = "upcoming";
    else if (!task.planned_for && !task.due_on) key = "unscheduled";
    else key = "other";
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }
  return order.flatMap(([key, label]) => {
    const rows = grouped.get(key) ?? [];
    return rows.length ? [{ key, label, tasks: rows }] : [];
  });
}
