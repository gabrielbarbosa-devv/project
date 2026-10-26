import type { TaskKanbanMetadata } from "@/features/tasks/data/queries";

export function withKanbanChecklistProgress(
  metadata: Record<string, TaskKanbanMetadata>,
  taskId: string,
  progress: { total: number; completed: number },
) {
  const total = Number.isFinite(progress.total) ? Math.max(0, Math.floor(progress.total)) : 0;
  const completed = Number.isFinite(progress.completed)
    ? Math.min(total, Math.max(0, Math.floor(progress.completed)))
    : 0;
  const previous = metadata[taskId] ?? { labelIds: [], checklistTotal: 0, checklistCompleted: 0 };

  return {
    ...metadata,
    [taskId]: {
      ...previous,
      checklistTotal: total,
      checklistCompleted: completed,
    },
  };
}
