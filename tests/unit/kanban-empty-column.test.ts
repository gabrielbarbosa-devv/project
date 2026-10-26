import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KanbanEmptyColumn } from "@/features/tasks/components/kanban-empty-column";
import type { KanbanColumn } from "@/features/tasks/data/presentation";
import type { Task } from "@/features/tasks/data/queries";

const emptyColumn: KanbanColumn = { key: "paused", label: "Pausadas", tasks: [] };
const task = {
  id: "task-fixture",
  workspace_id: "workspace-fixture",
  created_by: "user-fixture",
  project_id: null,
  title: "Tarefa de teste",
  description: null,
  planned_for: null,
  start_time: null,
  due_on: null,
  priority: "medium",
  status: "pending",
  completed_at: null,
  archived_at: null,
  sort_order: 0,
  created_at: "2026-10-25T12:00:00.000Z",
  updated_at: "2026-10-25T12:00:00.000Z",
} satisfies Task;

function render(column: KanbanColumn, filtersActive = false) {
  return renderToStaticMarkup(createElement(KanbanEmptyColumn, { column, filtersActive }));
}

describe("KanbanEmptyColumn", () => {
  it("mostra o estado vazio discreto para uma coluna carregada sem tarefas", () => {
    const markup = render(emptyColumn);

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Nenhuma tarefa nesta etapa");
    expect(markup).toContain("Não há tarefas nesta etapa.");
    expect(markup).toContain("size-11");
    expect(markup).not.toContain("mover tarefas para cá");
  });

  it("dá boas-vindas na primeira coluna sem repetir a mensagem para leitores de tela", () => {
    const welcome = renderToStaticMarkup(createElement(KanbanEmptyColumn, {
      column: { ...emptyColumn, key: "pending", label: "A fazer" },
      filtersActive: false,
      welcome: true,
      announce: true,
    }));
    const quiet = renderToStaticMarkup(createElement(KanbanEmptyColumn, {
      column: emptyColumn,
      filtersActive: false,
      welcome: false,
      announce: false,
    }));

    expect(welcome).toContain('role="status"');
    expect(welcome).toContain("Seu quadro começa aqui");
    expect(welcome).toContain("Crie sua primeira tarefa para começar.");
    expect(quiet).toContain('aria-hidden="true"');
    expect(quiet).toContain("Nenhuma tarefa nesta etapa");
    expect(quiet).not.toContain('role="status"');
  });

  it("explica quando a coluna não tem resultados por busca ou filtros", () => {
    const markup = render(emptyColumn, true);

    expect(markup).toContain("Nenhuma tarefa corresponde aos filtros.");
    expect(markup).toContain("Ajuste a busca ou os filtros");
    expect(markup).not.toContain("Não há tarefas nesta etapa.");
  });

  it("não substitui os cartões quando a coluna contém tarefas reais", () => {
    const markup = render({ ...emptyColumn, tasks: [task] });

    expect(markup).toBe("");
  });
});
