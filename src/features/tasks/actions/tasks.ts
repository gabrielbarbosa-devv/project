"use server";

import { requireUser } from "@/lib/auth/require-user";
import {
  createProjectSchema,
  createTaskSchema,
  duplicateTaskSchema,
  moveTaskSchema,
  projectIdSchema,
  reorderTaskGroupSchema,
  taskCompletionSchema,
  taskIdSchema,
  taskStatusChangeSchema,
  updateTaskSchema,
} from "@/features/tasks/schemas/task.schema";
import type { Task } from "@/features/tasks/data/queries";

type ActionResult<T = object> = { success?: true; error?: string } & T;

async function getWorkspaceAccess() {
  const auth = await requireUser(null);
  if (!auth) return null;

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("onboarding_state, primary_workspace_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.onboarding_state !== "complete" || !profile.primary_workspace_id) return null;

  const { data: membership } = await auth.supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("workspace_id", profile.primary_workspace_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) return null;

  return { ...auth, workspaceId: membership.workspace_id, role: membership.role };
}

async function projectBelongsToWorkspace(supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>>["supabase"], projectId: string, workspaceId: string) {
  const { data } = await supabase.from("projects").select("id").eq("id", projectId).eq("workspace_id", workspaceId).maybeSingle();
  return Boolean(data);
}

export async function createTask(input: unknown): Promise<ActionResult<{ task?: Task }>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os campos da tarefa." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };

  if (parsed.data.projectId && !await projectBelongsToWorkspace(access.supabase, parsed.data.projectId, access.workspaceId)) {
    return { error: "O projeto selecionado não pertence a este espaço de trabalho." };
  }

  const { data, error } = await access.supabase.rpc("create_task_with_labels", {
    p_request_id: parsed.data.requestId,
    p_title: parsed.data.title,
    p_description: parsed.data.description.trim() || null,
    p_project_id: parsed.data.projectId || null,
    p_planned_for: parsed.data.plannedFor || null,
    p_start_time: parsed.data.startTime || null,
    p_due_on: parsed.data.dueOn || null,
    p_priority: parsed.data.priority,
    p_label_ids: parsed.data.labelIds,
    p_new_label_names: parsed.data.newLabelNames,
  });
  const task = data?.[0];
  if (error || !task) return { error: "Não foi possível criar a tarefa. Tente novamente." };
  return { success: true, task: task as Task };
}

export async function updateTask(input: unknown): Promise<ActionResult<{ task?: Task }>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os campos da tarefa." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  if (parsed.data.projectId && !await projectBelongsToWorkspace(access.supabase, parsed.data.projectId, access.workspaceId)) {
    return { error: "O projeto selecionado não pertence a este espaço de trabalho." };
  }

  const { data, error } = await access.supabase.rpc("update_task_with_labels", {
    p_task_id: parsed.data.id,
    p_title: parsed.data.title,
    p_description: parsed.data.description.trim() || null,
    p_project_id: parsed.data.projectId || null,
    p_planned_for: parsed.data.plannedFor || null,
    p_start_time: parsed.data.startTime || null,
    p_due_on: parsed.data.dueOn || null,
    p_priority: parsed.data.priority,
    p_status: parsed.data.status,
    p_label_ids: parsed.data.labelIds,
    p_new_label_names: parsed.data.newLabelNames,
  });
  const task = data?.[0];
  if (error || !task) return { error: "Não foi possível salvar a tarefa. Confira o acesso e tente novamente." };
  return { success: true, task: task as Task };
}

export async function setTaskCompletion(input: unknown): Promise<ActionResult> {
  const parsed = taskCompletionSchema.safeParse(input);
  if (!parsed.success) return { error: "Não foi possível atualizar o estado da tarefa." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  const completedAt = parsed.data.completed ? new Date().toISOString() : null;
  const { data, error } = await access.supabase
    .from("tasks")
    .update({ status: parsed.data.completed ? "completed" : "pending", completed_at: completedAt })
    .eq("id", parsed.data.id)
    .eq("workspace_id", access.workspaceId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Não foi possível atualizar a tarefa. Tente novamente." };
  return { success: true };
}

export async function moveTaskStatus(input: unknown): Promise<ActionResult<{ task?: Task }>> {
  const parsed = taskStatusChangeSchema.safeParse(input);
  if (!parsed.success) return { error: "A etapa selecionada não é válida." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  const completedAt = parsed.data.status === "completed" ? new Date().toISOString() : null;
  const { data, error } = await access.supabase.from("tasks")
    .update({ status: parsed.data.status, completed_at: completedAt })
    .eq("id", parsed.data.id)
    .eq("workspace_id", access.workspaceId)
    .is("archived_at", null)
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: "Não foi possível mover a tarefa. Atualize o quadro e tente novamente." };
  return { success: true, task: data as Task };
}

export async function duplicateTask(input: unknown): Promise<ActionResult<{ task?: Task }>> {
  const parsed = duplicateTaskSchema.safeParse(input);
  if (!parsed.success) return { error: "Tarefa inválida." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  const { data, error } = await access.supabase.rpc("duplicate_task", {
    p_task_id: parsed.data.id,
    p_request_id: parsed.data.requestId,
  });
  const task = data?.[0];
  if (error || !task || task.workspace_id !== access.workspaceId || task.created_by !== access.user.id) {
    return { error: "Não foi possível duplicar a tarefa. Tente novamente." };
  }
  return { success: true, task: task as Task };
}

export async function moveTask(input: unknown): Promise<ActionResult<{ task?: Task }>> {
  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return { error: "Revise o projeto selecionado." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  if (parsed.data.projectId && !await projectBelongsToWorkspace(access.supabase, parsed.data.projectId, access.workspaceId)) {
    return { error: "O projeto selecionado não pertence a este espaço de trabalho." };
  }
  const { data, error } = await access.supabase.from("tasks")
    .update({ project_id: parsed.data.projectId || null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", access.workspaceId)
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: "Não foi possível mover a tarefa." };
  return { success: true, task: data as Task };
}

export async function reorderTaskGroup(input: unknown): Promise<ActionResult> {
  const parsed = reorderTaskGroupSchema.safeParse(input);
  if (!parsed.success) return { error: "A ordem das tarefas é inválida." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };

  const { error } = await access.supabase.rpc("reorder_task_group", {
    p_group_key: parsed.data.groupKey,
    p_task_ids: parsed.data.taskIds,
  });
  if (error) return { error: "Não foi possível salvar a ordem manual. Atualize a lista e tente novamente." };
  return { success: true };
}

async function setTaskArchived(input: unknown, archived: boolean): Promise<ActionResult> {
  const parsed = taskIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Tarefa inválida." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  let query = access.supabase.from("tasks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", access.workspaceId);
  query = archived ? query.is("archived_at", null) : query.not("archived_at", "is", null);
  const { error } = await query.select("id").maybeSingle();
  if (error) return { error: archived ? "Não foi possível arquivar a tarefa." : "Não foi possível restaurar a tarefa." };
  return { success: true };
}

export async function archiveTask(input: unknown) {
  return setTaskArchived(input, true);
}

export async function restoreTask(input: unknown) {
  return setTaskArchived(input, false);
}

export async function deleteTask(input: unknown): Promise<ActionResult> {
  const parsed = taskIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Tarefa inválida." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  const { error } = await access.supabase.from("tasks")
    .delete()
    .eq("id", parsed.data.id)
    .eq("workspace_id", access.workspaceId);
  if (error) return { error: "Não foi possível excluir a tarefa." };
  // Repeated deletes are successful no-ops, including retries after a committed
  // delete whose response was lost. Workspace scoping keeps this non-enumerating.
  return { success: true };
}

export async function createProject(input: unknown): Promise<ActionResult<{ project?: unknown }>> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Informe um nome para o projeto." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  if (access.role !== "owner" && access.role !== "admin") return { error: "Somente pessoas administradoras podem criar projetos." };

  const { data: project, error } = await access.supabase.from("projects")
    .insert({ workspace_id: access.workspaceId, created_by: access.user.id, name: parsed.data.name })
    .select("*")
    .single();
  if (error) return { error: "Não foi possível criar o projeto. Verifique se já existe um projeto com esse nome." };
  return { success: true, project };
}

export async function deleteProject(input: unknown): Promise<ActionResult> {
  const parsed = projectIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Projeto inválido." };
  const access = await getWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  if (access.role !== "owner" && access.role !== "admin") {
    return { error: "Somente pessoas administradoras podem excluir projetos." };
  }

  const { data: project, error } = await access.supabase.from("projects")
    .delete()
    .eq("id", parsed.data.id)
    .eq("workspace_id", access.workspaceId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "Não foi possível excluir o projeto. Tente novamente." };
  if (!project) return { error: "Projeto não encontrado neste workspace." };
  return { success: true };
}
