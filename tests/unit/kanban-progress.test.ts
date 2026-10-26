import { describe, expect, it } from "vitest";
import { withKanbanChecklistProgress } from "@/features/tasks/data/kanban-progress";
import type { TaskKanbanMetadata } from "@/features/tasks/data/queries";

const metadata: Record<string, TaskKanbanMetadata> = {
  "task-1": { labelIds: ["label-1"], checklistTotal: 4, checklistCompleted: 1 },
};

describe("withKanbanChecklistProgress", () => {
  it("atualiza apenas as contagens e preserva as etiquetas", () => {
    const updated = withKanbanChecklistProgress(metadata, "task-1", { total: 5, completed: 3 });

    expect(updated["task-1"]).toEqual({ labelIds: ["label-1"], checklistTotal: 5, checklistCompleted: 3 });
    expect(metadata["task-1"].checklistTotal).toBe(4);
  });

  it("adiciona contagem ao task id recebido sem inventar etiquetas", () => {
    const updated = withKanbanChecklistProgress(metadata, "task-2", { total: 2, completed: 2 });

    expect(updated["task-2"]).toEqual({ labelIds: [], checklistTotal: 2, checklistCompleted: 2 });
  });

  it("normaliza contagens fora da faixa válida", () => {
    const updated = withKanbanChecklistProgress(metadata, "task-1", { total: 3.8, completed: 10 });

    expect(updated["task-1"].checklistTotal).toBe(3);
    expect(updated["task-1"].checklistCompleted).toBe(3);
  });

  it("normaliza progresso negativo para zero", () => {
    const updated = withKanbanChecklistProgress(metadata, "task-1", { total: 4, completed: -2 });

    expect(updated["task-1"].checklistTotal).toBe(4);
    expect(updated["task-1"].checklistCompleted).toBe(0);
  });
});
