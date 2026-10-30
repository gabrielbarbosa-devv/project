import { describe, expect, it } from "vitest";
import {
  addDays,
  buildTaskSearchFilter,
  canReorderTasks,
  hasActiveTaskFilters,
  matchesTaskFilters,
  parseTaskFilters,
  sortTasks,
} from "@/features/tasks/data/task-filtering";
import type { Task, TaskFilters } from "@/features/tasks/data/queries";

const ids = {
  one: "71360d82-f90f-4625-b554-3c014a5da821",
  two: "e95e1c69-333e-4a5d-9955-22f66932751c",
  three: "c66186a2-617c-4954-a89e-6ea02985b380",
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: ids.one,
    workspace_id: "95b1d1fd-a93c-4fbf-a8c9-0a9f42f77fae",
    created_by: "8cbcdcb4-2fc2-4cbd-a116-97a880a1b1c6",
    project_id: null,
    title: "Preparar roteiro",
    description: null,
    planned_for: null,
    start_time: null,
    due_on: null,
    priority: "medium",
    status: "pending",
    completed_at: null,
    archived_at: null,
    sort_order: null,
    created_at: "2026-10-20T09:00:00.000Z",
    updated_at: "2026-10-20T09:00:00.000Z",
    ...overrides,
  };
}

const defaultFilters = (): TaskFilters => ({
  q: "",
  project: "",
  priorities: [],
  statuses: [],
  archived: false,
  due: "",
  labelIds: [],
  sort: "due_soon",
});

describe("buildTaskSearchFilter", () => {
  it("keeps PostgREST expression delimiters inside quoted search patterns", () => {
    expect(buildTaskSearchFilter("roteiro,planejamento")).toBe(
      'title.ilike."%roteiro,planejamento%",description.ilike."%roteiro,planejamento%"',
    );
  });

  it("treats LIKE wildcards, quotes, and backslashes as literal text", () => {
    const filter = buildTaskSearchFilter(String.raw`100%_ " \ tarefa`);

    expect(filter).toContain(String.raw`\%`);
    expect(filter).toContain(String.raw`\_`);
    expect(filter).toContain(String.raw`\"`);
    expect(filter).toContain(String.raw`\\`);
  });
});

describe("task filter URL state", () => {
  it("parses repeated multi-select filters and keeps their values unique", () => {
    const filters = parseTaskFilters({
      q: "  roteiro ",
      project: ids.one,
      priority: ["high", "low", "high", "invalid"],
      status: ["pending", "in_progress", "completed", "paused", "pending"],
      label: [ids.two, ids.three, ids.two, "invalid"],
      due: "next7",
      sort: "title_desc",
    });

    expect(filters).toEqual({
      q: "roteiro",
      project: ids.one,
      priorities: ["high", "low"],
      statuses: ["pending", "in_progress", "completed", "paused"],
      archived: false,
      due: "next7",
      labelIds: [ids.two, ids.three],
      sort: "title_desc",
    });
  });

  it("falls back safely for unsupported parameters and keeps legacy links working", () => {
    expect(parseTaskFilters({ project: "not-a-uuid", priority: "critical", status: "unknown", due: "tomorrow", sort: "unknown" })).toEqual(defaultFilters());
    expect(parseTaskFilters({ state: "archived", sort: "priority" })).toMatchObject({ archived: true, sort: "priority_high" });
    expect(parseTaskFilters({ state: "completed", sort: "due" })).toMatchObject({ statuses: ["completed"], sort: "due_soon" });
  });

  it("keeps project roadmaps in manual order unless a sort is explicitly selected", () => {
    expect(parseTaskFilters({ project: ids.one })).toMatchObject({ project: ids.one, sort: "manual" });
    expect(parseTaskFilters({ project: ids.one, sort: "title_asc" })).toMatchObject({ sort: "title_asc" });
  });

  it("treats only non-sort facets as restrictive filters", () => {
    expect(hasActiveTaskFilters(defaultFilters())).toBe(false);
    expect(hasActiveTaskFilters({ ...defaultFilters(), sort: "title_asc" })).toBe(false);
    expect(hasActiveTaskFilters({ ...defaultFilters(), project: "none" })).toBe(true);
  });

  it("allows manual order only when the complete group is visible", () => {
    expect(canReorderTasks({ ...defaultFilters(), sort: "manual" })).toBe(true);
    expect(canReorderTasks({ ...defaultFilters(), sort: "title_asc" })).toBe(false);
    expect(canReorderTasks({ ...defaultFilters(), sort: "manual", q: "roteiro" })).toBe(false);
    expect(canReorderTasks({ ...defaultFilters(), sort: "manual", statuses: ["pending"] })).toBe(false);
  });
});

describe("task filter matching", () => {
  it("combines filter groups with AND and selected values within a group with OR", () => {
    const matching = task({ id: ids.one, title: "ROTEIRO semanal", priority: "high", project_id: ids.three, due_on: "2026-10-27" });
    const nonmatching = task({ id: ids.two, title: "ROTEIRO semanal", priority: "low", project_id: ids.three, due_on: "2026-10-27" });
    const filters: TaskFilters = {
      ...defaultFilters(),
      q: "roteiro",
      project: ids.three,
      priorities: ["high", "medium"],
      due: "next7",
      labelIds: [ids.one, ids.two],
    };

    expect(matchesTaskFilters(matching, filters, "2026-10-25", [ids.two])).toBe(true);
    expect(matchesTaskFilters(nonmatching, filters, "2026-10-25", [ids.one])).toBe(false);
    expect(matchesTaskFilters(matching, { ...filters, labelIds: [ids.one] }, "2026-10-25", [ids.two])).toBe(false);
  });

  it("distinguishes due dates from planned dates and includes tasks without a due date", () => {
    const plannedTodayNoDue = task({ planned_for: "2026-10-25", due_on: null });
    expect(matchesTaskFilters(plannedTodayNoDue, { ...defaultFilters(), due: "none" }, "2026-10-25")).toBe(true);
    expect(matchesTaskFilters(plannedTodayNoDue, { ...defaultFilters(), due: "today" }, "2026-10-25")).toBe(false);
    expect(matchesTaskFilters(task({ due_on: "2026-10-24" }), { ...defaultFilters(), due: "overdue" }, "2026-10-25")).toBe(true);
  });

  it("filters archived tasks, status choices, and the no-project option", () => {
    const completed = task({ status: "completed", project_id: null });
    const archived = task({ archived_at: "2026-10-24T12:00:00.000Z" });
    expect(matchesTaskFilters(completed, { ...defaultFilters(), statuses: ["completed"] }, "2026-10-25")).toBe(true);
    expect(matchesTaskFilters(completed, { ...defaultFilters(), statuses: ["pending"] }, "2026-10-25")).toBe(false);
    expect(matchesTaskFilters(completed, { ...defaultFilters(), project: "none" }, "2026-10-25")).toBe(true);
    expect(matchesTaskFilters(task({ project_id: ids.three }), { ...defaultFilters(), project: "none" }, "2026-10-25")).toBe(false);
    expect(matchesTaskFilters(archived, { ...defaultFilters(), archived: true }, "2026-10-25")).toBe(true);
    expect(matchesTaskFilters(archived, defaultFilters(), "2026-10-25")).toBe(false);
  });
});

describe("task ordering", () => {
  const tasks = [
    task({ id: ids.one, title: "Roteiro", priority: "medium", due_on: null, sort_order: 2 }),
    task({ id: ids.two, title: "análise", priority: "high", due_on: "2026-10-30", sort_order: 1, created_at: "2026-10-22T09:00:00.000Z" }),
    task({ id: ids.three, title: "Briefing", priority: "high", due_on: "2026-10-26", sort_order: null }),
  ];

  it("sorts all supported criteria and places null dates last", () => {
    expect(sortTasks(tasks, "priority_high").map(({ id }) => id)).toEqual([ids.three, ids.two, ids.one]);
    expect(sortTasks(tasks, "priority_low").map(({ id }) => id)).toEqual([ids.one, ids.three, ids.two]);
    expect(sortTasks(tasks, "due_soon").map(({ id }) => id)).toEqual([ids.three, ids.two, ids.one]);
    expect(sortTasks(tasks, "due_far").map(({ id }) => id)).toEqual([ids.two, ids.three, ids.one]);
    expect(sortTasks(tasks, "title_asc").map(({ title }) => title)).toEqual(["análise", "Briefing", "Roteiro"]);
    expect(sortTasks(tasks, "title_desc").map(({ title }) => title)).toEqual(["Roteiro", "Briefing", "análise"]);
  });

  it("respects manual sort_order and uses stable fallbacks for unset positions", () => {
    expect(sortTasks(tasks, "manual").map(({ id }) => id)).toEqual([ids.two, ids.one, ids.three]);
    expect(sortTasks([tasks[1], tasks[0]], "created_recent").map(({ id }) => id)).toEqual([ids.two, ids.one]);
    expect(sortTasks([tasks[1], tasks[0]], "created_oldest").map(({ id }) => id)).toEqual([ids.one, ids.two]);
    const planned = [task({ id: ids.one, planned_for: "2026-10-24" }), task({ id: ids.two, planned_for: "2026-10-26" })];
    expect(sortTasks(planned, "planned_recent").map(({ id }) => id)).toEqual([ids.two, ids.one]);
    expect(sortTasks(planned, "planned_oldest").map(({ id }) => id)).toEqual([ids.one, ids.two]);
  });

  it("adds civil days without local timezone shifts", () => {
    expect(addDays("2026-10-25", 7)).toBe("2026-11-01");
  });
});
