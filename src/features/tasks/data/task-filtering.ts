import type { Task, TaskDueFilter, TaskFilters, TaskPriority, TaskSort, TaskStatus } from "@/features/tasks/data/queries";

/**
 * PostgREST's `or` filter is a small expression language. Quote each pattern
 * and escape SQL LIKE wildcards so user input stays a literal search term.
 */
export function buildTaskSearchFilter(value: string) {
  const escaped = value.replace(/[\\%_"]/g, "\\$&");
  const pattern = `"%${escaped}%"`;
  return `title.ilike.${pattern},description.ilike.${pattern}`;
}

export function hasActiveTaskFilters(filters: TaskFilters) {
  return Boolean(
    filters.q || filters.project || filters.priorities.length || filters.statuses.length
    || filters.archived || filters.due || filters.labelIds.length,
  );
}

export function canReorderTasks(filters: TaskFilters) {
  return filters.sort === "manual" && !hasActiveTaskFilters(filters);
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function matchesTaskFilters(task: Task, filters: TaskFilters, today: string, labelIds: string[] = []) {
  if (filters.archived !== Boolean(task.archived_at)) return false;
  if (filters.statuses.length && !filters.statuses.includes(task.status as TaskStatus)) return false;
  if (filters.priorities.length && !filters.priorities.includes(task.priority as TaskPriority)) return false;
  if (filters.project === "none" && task.project_id !== null) return false;
  if (filters.project && filters.project !== "none" && task.project_id !== filters.project) return false;
  const query = filters.q.toLocaleLowerCase("pt-BR");
  if (query && !`${task.title} ${task.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(query)) return false;
  if (filters.due === "overdue" && (task.status !== "pending" || !task.due_on || task.due_on >= today)) return false;
  if (filters.due === "today" && task.due_on !== today) return false;
  if (filters.due === "next7" && (!task.due_on || task.due_on < today || task.due_on > addDays(today, 7))) return false;
  if (filters.due === "none" && task.due_on !== null) return false;
  if (filters.labelIds.length && !filters.labelIds.some((id) => labelIds.includes(id))) return false;
  return true;
}

export function sortTasks(tasks: Task[], sort: TaskSort) {
  const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    let compare = 0;
    if (sort === "manual") {
      compare = compareNullable(a.sort_order, b.sort_order, true);
      if (compare === 0) compare = b.created_at.localeCompare(a.created_at);
    } else if (sort === "priority_high") compare = priorityRank[a.priority as TaskPriority] - priorityRank[b.priority as TaskPriority];
    else if (sort === "priority_low") compare = priorityRank[b.priority as TaskPriority] - priorityRank[a.priority as TaskPriority];
    else if (sort === "due_soon") compare = compareNullable(a.due_on, b.due_on, true);
    else if (sort === "due_far") compare = compareNullable(a.due_on, b.due_on, false);
    else if (sort === "planned_recent") compare = compareNullable(a.planned_for, b.planned_for, false);
    else if (sort === "planned_oldest") compare = compareNullable(a.planned_for, b.planned_for, true);
    else if (sort === "created_recent") compare = b.created_at.localeCompare(a.created_at);
    else if (sort === "created_oldest") compare = a.created_at.localeCompare(b.created_at);
    else if (sort === "title_asc") compare = a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
    else if (sort === "title_desc") compare = b.title.localeCompare(a.title, "pt-BR", { sensitivity: "base" });
    return compare || a.id.localeCompare(b.id);
  });
}

function compareNullable(a: string | number | null, b: string | number | null, ascending: boolean) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const compare = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return ascending ? compare : -compare;
}

export function todayInWorkspaceTimezone() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseTaskFilters(params: Record<string, string | string[] | undefined>): TaskFilters {
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const values = (key: string) => Array.isArray(params[key]) ? params[key] as string[] : typeof params[key] === "string" ? [params[key] as string] : [];
  const isUuid = (input: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
  const legacyState = value("state");
  const legacySort: Record<string, TaskSort> = { due: "due_soon", planned: "planned_oldest", priority: "priority_high", created: "created_recent" };
  const allowedSorts: TaskSort[] = ["manual", "priority_high", "priority_low", "due_soon", "due_far", "planned_recent", "planned_oldest", "created_recent", "created_oldest", "title_asc", "title_desc"];
  const rawSort = value("sort");
  const priorities = [...new Set(values("priority").filter((item): item is TaskPriority => ["low", "medium", "high"].includes(item)))];
  const rawStatuses = values("status");
  if (rawStatuses.length === 0 && ["pending", "completed"].includes(legacyState)) rawStatuses.push(legacyState);
  const statuses = [...new Set(rawStatuses.filter((item): item is TaskStatus => ["pending", "completed"].includes(item)))];
  const labelIds = [...new Set(values("label").filter(isUuid))].slice(0, 20);
  const due = value("due");
  const project = value("project");
  const safeProject = project === "none" || isUuid(project) ? project : "";
  const sort = legacySort[rawSort] ?? (allowedSorts.includes(rawSort as TaskSort) ? rawSort as TaskSort : "due_soon");
  return {
    q: value("q").trim().slice(0, 120),
    project: safeProject,
    priorities,
    statuses,
    archived: legacyState === "archived" || value("archived") === "true",
    due: ["overdue", "today", "next7", "none"].includes(due) ? due as TaskDueFilter : "",
    labelIds,
    sort,
  };
}
