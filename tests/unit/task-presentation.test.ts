import { describe, expect, it } from "vitest";
import { getUnmappedKanbanTasks } from "../../src/features/tasks/data/kanban-presentation";
import { groupKanbanTasks, groupTasks } from "../../src/features/tasks/data/presentation";
import type { Task } from "../../src/features/tasks/data/queries";

function task(overrides: Partial<Task> & Pick<Task, "id">): Task {
  return {
    workspace_id: "workspace-1",
    created_by: "user-1",
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
    created_at: "2026-10-24T12:00:00.000Z",
    updated_at: "2026-10-24T12:00:00.000Z",
    ...overrides,
  };
}

describe("agrupamento de tarefas por data local", () => {
  it("classifica hoje e atrasos somente pelo prazo, sem duplicar tarefas", () => {
    const items = [
      task({ id: "today-planned", planned_for: "2026-10-24" }),
      task({ id: "today-due", due_on: "2026-10-24" }),
      task({ id: "late", planned_for: "2026-10-20", due_on: "2026-10-23" }),
      task({ id: "past-plan-no-due", planned_for: "2026-10-20" }),
    ];

    const groups = groupTasks(items, "2026-10-24", false);
    expect(groups.map(({ key }) => key)).toEqual(["today", "overdue", "other"]);
    expect(groups.flatMap(({ tasks }) => tasks.map(({ id }) => id))).toHaveLength(items.length);
    expect(groups.find(({ key }) => key === "today")?.tasks.map(({ id }) => id)).toEqual(["today-planned", "today-due"]);
    expect(groups.find(({ key }) => key === "overdue")?.tasks[0]?.id).toBe("late");
  });

  it("preserva tarefas futuras, sem data, concluídas e arquivadas nas visualizações correspondentes", () => {
    const items = [
      task({ id: "future", planned_for: "2026-10-25" }),
      task({ id: "unscheduled" }),
      task({ id: "completed", status: "completed", completed_at: "2026-10-24T12:00:00.000Z" }),
      task({ id: "archived", archived_at: "2026-10-24T12:00:00.000Z" }),
    ];

    const groups = groupTasks(items.slice(0, 3), "2026-10-24", false);
    expect(groups.map(({ key }) => key)).toEqual(["upcoming", "unscheduled", "completed"]);
    expect(groupTasks([items[3]!], "2026-10-24", true).map(({ key }) => key)).toEqual(["archived"]);
  });

  it("mantém tarefas pendentes acima das concluídas", () => {
    const groups = groupTasks([
      task({ id: "completed", status: "completed", completed_at: "2026-10-24T12:00:00.000Z" }),
      task({ id: "pending", planned_for: "2026-10-24" }),
    ], "2026-10-24", false);

    expect(groups.map(({ key }) => key)).toEqual(["today", "completed"]);
  });
});

describe("colunas Kanban", () => {
  it("mantém as quatro colunas e só associa tarefas aos status existentes", () => {
    const items = [
      task({ id: "pending-one", status: "pending" }),
      task({ id: "pending-two", status: "pending" }),
      task({ id: "completed", status: "completed", completed_at: "2026-10-24T12:00:00.000Z" }),
    ];
    const columns = groupKanbanTasks(items);

    expect(columns.map(({ key, label, tasks: columnTasks }) => [key, label, columnTasks.length])).toEqual([
      ["pending", "A fazer", 2],
      ["in_progress", "Em andamento", 0],
      ["completed", "Concluídas", 1],
      ["paused", "Pausadas", 0],
    ]);
    expect(columns.flatMap(({ tasks: columnTasks }) => columnTasks.map(({ id }) => id)).sort()).toEqual(
      items.map(({ id }) => id).sort(),
    );
  });

  it("preserva a ordem recebida da consulta dentro de cada coluna", () => {
    const items = [
      task({ id: "second", status: "pending", sort_order: 2 }),
      task({ id: "first", status: "pending", sort_order: 1 }),
    ];

    expect(groupKanbanTasks(items)[0]?.tasks.map(({ id }) => id)).toEqual(["second", "first"]);
  });

  it("identifica registros reais cujo status ainda não está mapeado para uma coluna", () => {
    const unsupported = task({ id: "unsupported", status: "in_progress" as unknown as Task["status"] });
    const tasks = [unsupported];
    const unmapped = getUnmappedKanbanTasks(tasks, groupKanbanTasks(tasks));

    expect(unmapped).toEqual([unsupported]);
  });
});
