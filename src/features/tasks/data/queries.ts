import { requireUser } from "@/lib/auth/require-user";
import type { Tables } from "@/types/database";
import { groupTasks } from "@/features/tasks/data/presentation";
import { addDays, buildTaskSearchFilter, sortTasks, todayInWorkspaceTimezone } from "@/features/tasks/data/task-filtering";
import { classifyTaskLoadIssue, type TaskLoadIssue } from "@/features/tasks/data/kanban-presentation";

export { addDays, buildTaskSearchFilter, canReorderTasks, hasActiveTaskFilters, matchesTaskFilters, parseTaskFilters, sortTasks, todayInWorkspaceTimezone } from "@/features/tasks/data/task-filtering";

export type Task = Tables<"tasks">;
export type Project = Pick<Tables<"projects">, "id" | "name">;
export type TaskLabel = Pick<Tables<"task_labels">, "id" | "name" | "name_key" | "color">;
export type TaskChecklistItem = Tables<"task_checklist_items">;
export type TaskActivity = Tables<"task_activity">;
export type TaskKanbanMetadata = {
  labelIds: string[];
  checklistTotal: number;
  checklistCompleted: number;
};
export type TodayWorkspaceData = {
  kind: "ready";
  workspace: { id: string; name: string };
  projects: Project[];
  labels: TaskLabel[];
  tasks: Task[];
  kanbanMetadata: Record<string, TaskKanbanMetadata>;
  groups: ReturnType<typeof groupTasks>;
  today: string;
  filters: TaskFilters;
  canCreateProjects: boolean;
  loadError: TaskLoadIssue | null;
} | {
  kind: "unavailable";
  issue: TaskLoadIssue;
};

export type { TaskGroup } from "@/features/tasks/data/presentation";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "completed";
export type TaskDueFilter = "" | "overdue" | "today" | "next7" | "none";
export type TaskSort =
  | "manual"
  | "priority_high"
  | "priority_low"
  | "due_soon"
  | "due_far"
  | "planned_recent"
  | "planned_oldest"
  | "created_recent"
  | "created_oldest"
  | "title_asc"
  | "title_desc";
export type TaskFilters = {
  q: string;
  project: string;
  priorities: TaskPriority[];
  statuses: TaskStatus[];
  archived: boolean;
  due: TaskDueFilter;
  labelIds: string[];
  sort: TaskSort;
};

const taskColumns = "id, workspace_id, created_by, project_id, title, description, planned_for, start_time, due_on, priority, status, completed_at, archived_at, sort_order, created_at, updated_at";

export async function getTodayWorkspaceData(filters: TaskFilters, { includeKanbanMetadata = false }: { includeKanbanMetadata?: boolean } = {}) {
  const auth = await requireUser(null);
  if (!auth) return null;

  const profileResponse = await auth.supabase
    .from("profiles")
    .select("onboarding_state, primary_workspace_id, workspace:workspaces!profiles_primary_workspace_id_fkey(id, name)")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileResponse.error) return { kind: "unavailable", issue: classifyTaskLoadIssue(profileResponse.error) } satisfies TodayWorkspaceData;
  const profile = profileResponse.data;
  if (profile?.onboarding_state !== "complete" || !profile.primary_workspace_id) return null;

  const membershipResponse = await auth.supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("workspace_id", profile.primary_workspace_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (membershipResponse.error) return { kind: "unavailable", issue: classifyTaskLoadIssue(membershipResponse.error) } satisfies TodayWorkspaceData;
  const membership = membershipResponse.data;
  if (!membership) return { kind: "unavailable", issue: "authorization" } satisfies TodayWorkspaceData;

  const taskSelect = filters.labelIds.length
    ? `${taskColumns}, task_label_assignments!task_label_assignments_task_workspace_fkey!inner(label_id)`
    : taskColumns;
  const today = todayInWorkspaceTimezone();
  let taskQuery = auth.supabase.from("tasks").select(taskSelect).eq("workspace_id", membership.workspace_id);
  taskQuery = filters.archived
    ? taskQuery.not("archived_at", "is", null)
    : taskQuery.is("archived_at", null);

  if (filters.statuses.length) taskQuery = taskQuery.in("status", filters.statuses);
  if (filters.project === "none") taskQuery = taskQuery.is("project_id", null);
  else if (filters.project) taskQuery = taskQuery.eq("project_id", filters.project);
  if (filters.priorities.length) taskQuery = taskQuery.in("priority", filters.priorities);
  if (filters.labelIds.length) taskQuery = taskQuery.in("task_label_assignments.label_id", filters.labelIds);
  if (filters.due === "overdue") taskQuery = taskQuery.eq("status", "pending").not("due_on", "is", null).lt("due_on", today);
  else if (filters.due === "today") taskQuery = taskQuery.eq("due_on", today);
  else if (filters.due === "next7") taskQuery = taskQuery.gte("due_on", today).lte("due_on", addDays(today, 7));
  else if (filters.due === "none") taskQuery = taskQuery.is("due_on", null);
  if (filters.q) taskQuery = taskQuery.or(buildTaskSearchFilter(filters.q));

  const [projectResponse, taskResponse, labelsResponse] = await Promise.all([
    auth.supabase.from("projects").select("id, name").eq("workspace_id", membership.workspace_id).order("name"),
    taskQuery.order("created_at", { ascending: false }),
    auth.supabase.from("task_labels").select("id, name, name_key, color").eq("workspace_id", membership.workspace_id).order("name"),
  ]);

  const workspace = profile.workspace;
  const projects = projectResponse.data;
  if (!workspace) return null;
  const taskRows = ((taskResponse.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
    const task = { ...row };
    delete task.task_label_assignments;
    return task as unknown as Task;
  });
  // A label filter joins assignments; multiple matching labels can yield the
  // same task more than once. Keep one real task record per ID.
  let tasks = [...new Map(taskRows.map((task) => [task.id, task])).values()];
  tasks = sortTasks(tasks, filters.sort);
  const groups = groupTasks(tasks, today, filters.archived);

  let kanbanMetadata: Record<string, TaskKanbanMetadata> = {};
  const kanbanMetadataErrors: Array<{ code?: unknown; status?: unknown }> = [];
  if (includeKanbanMetadata && tasks.length > 0) {
    const taskIds = tasks.map((task) => task.id);
    const [assignmentResponse, checklistResponse] = await Promise.all([
      auth.supabase.from("task_label_assignments")
        .select("task_id, label_id")
        .eq("workspace_id", membership.workspace_id)
        .in("task_id", taskIds),
      auth.supabase.from("task_checklist_items")
        .select("task_id, is_completed")
        .eq("workspace_id", membership.workspace_id)
        .in("task_id", taskIds),
    ]);
    if (assignmentResponse.error) kanbanMetadataErrors.push(assignmentResponse.error);
    if (checklistResponse.error) kanbanMetadataErrors.push(checklistResponse.error);
    const metadata = new Map<string, TaskKanbanMetadata>(taskIds.map((id) => [id, {
      labelIds: [],
      checklistTotal: 0,
      checklistCompleted: 0,
    }]));
    for (const assignment of assignmentResponse.data ?? []) {
      metadata.get(assignment.task_id)?.labelIds.push(assignment.label_id);
    }
    for (const item of checklistResponse.data ?? []) {
      const taskMetadata = metadata.get(item.task_id);
      if (!taskMetadata) continue;
      taskMetadata.checklistTotal += 1;
      if (item.is_completed) taskMetadata.checklistCompleted += 1;
    }
    kanbanMetadata = Object.fromEntries(metadata);
  }

  const loadErrors = [projectResponse.error, taskResponse.error, labelsResponse.error, ...kanbanMetadataErrors].filter(Boolean);
  const loadError: TaskLoadIssue | null = loadErrors.length
    ? loadErrors.some((error) => classifyTaskLoadIssue(error) === "authorization") ? "authorization" : "connection"
    : null;

  return {
    kind: "ready" as const,
    workspace,
    projects: (projects ?? []) as Project[],
    labels: (labelsResponse.data ?? []) as TaskLabel[],
    tasks,
    kanbanMetadata,
    groups,
    today,
    filters,
    canCreateProjects: membership.role === "owner" || membership.role === "admin",
    loadError,
  };
}


