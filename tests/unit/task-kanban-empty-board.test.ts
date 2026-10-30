import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskKanbanView } from "@/features/tasks/components/task-kanban-view";
import type { Task } from "@/features/tasks/data/queries";

function task(overrides: Partial<Task> & Pick<Task, "id">): Task {
  return {
    workspace_id: "workspace-fixture",
    created_by: "user-fixture",
    project_id: null,
    title: `Tarefa ${overrides.id}`,
    description: null,
    planned_for: null,
    start_time: null,
    due_on: null,
    priority: "medium",
    status: "pending",
    completed_at: null,
    archived_at: null,
    sort_order: null,
    created_at: "2026-10-25T12:00:00.000Z",
    updated_at: "2026-10-25T12:00:00.000Z",
    ...overrides,
  };
}

function render(tasks: Task[], filtered = false) {
  return renderToStaticMarkup(createElement(TaskKanbanView, {
    tasks,
    projects: [],
    labels: [],
    metadata: {},
    today: "2026-10-25",
    archived: false,
    filtered,
    selectedTaskId: null,
    pendingTaskIds: new Set<string>(),
    onOpen: () => {},
    onAction: async () => ({}),
    onMoveStatus: async () => {},
    onCreate: () => {},
    onClearFilters: () => {},
  }));
}

describe("quadro Kanban completamente vazio", () => {
  it("mantém as quatro colunas e os contadores reais em zero", () => {
    const markup = render([]);

    expect(markup).toContain("A fazer");
    expect(markup).toContain("Em andamento");
    expect(markup).toContain("Concluídas");
    expect(markup).toContain("Pausadas");
    expect(markup.match(/>0<\/span>/g)).toHaveLength(4);
    expect(markup.match(/aria-labelledby="kanban-column-/g)).toHaveLength(4);
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain("Seu quadro começa aqui");
    expect(markup).toContain("Crie sua primeira tarefa para começar.");
  });

  it("preserva a busca sem resultados em vez de mostrar o onboarding", () => {
    const markup = render([], true);

    expect(markup).toContain("Nenhuma tarefa encontrada");
    expect(markup).toContain("Limpar filtros");
    expect(markup).not.toContain("Seu quadro começa aqui");
    expect(markup).not.toContain('aria-labelledby="kanban-column-');
  });

  it("expõe tarefas reais com status que o Kanban ainda não mapeia", () => {
    const unmatched = task({ id: "unmatched", title: "Revisar status legado", status: "legacy_status" as unknown as Task["status"] });
    const markup = render([unmatched]);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Revisar status legado");
    expect(markup).toContain("status não reconhecido pelo Kanban");
    expect(markup).not.toContain("Seu quadro começa aqui");
  });
});
