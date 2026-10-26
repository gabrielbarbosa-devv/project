"use server";

import { requireUser } from "@/lib/auth/require-user";
import type { TaskActivity, TaskChecklistItem, TaskLabel } from "@/features/tasks/data/queries";
import {
  checklistItemIdSchema,
  createChecklistItemSchema,
  taskIdSchema,
  updateChecklistItemSchema,
} from "@/features/tasks/schemas/task.schema";

type ActionResult<T = object> = { success?: true; error?: string } & T;

async function getTaskWorkspaceAccess() {
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
  if (!membership || !["owner", "admin", "member"].includes(membership.role)) return null;

  return { ...auth, workspaceId: membership.workspace_id };
}

export async function getTaskDetails(input: unknown): Promise<ActionResult<{ detail?: {
  labelIds: string[];
  assignedLabels: TaskLabel[];
  checklist: TaskChecklistItem[];
  activity: TaskActivity[];
} }>> {
  const parsed = taskIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Tarefa inválida." };
  const auth = await requireUser(null);
  if (!auth) return { error: "Sua sessão ou espaço de trabalho não está disponível." };

  // RLS on tasks and the child tables validates workspace membership. Run the
  // existence check and supplemental reads together instead of serializing
  // profile -> membership -> task lookups before loading the sheet.
  const [taskResponse, assignments, checklist, activity] = await Promise.all([
    auth.supabase.from("tasks").select("id").eq("id", parsed.data.id).maybeSingle(),
    auth.supabase.from("task_label_assignments")
      .select("label_id")
      .eq("task_id", parsed.data.id),
    auth.supabase.from("task_checklist_items")
      .select("id, task_id, workspace_id, title, is_completed, position, created_at, updated_at")
      .eq("task_id", parsed.data.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    auth.supabase.from("task_activity")
      .select("id, task_id, workspace_id, actor_id, event_type, event_data, created_at")
      .eq("task_id", parsed.data.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  if (taskResponse.error || !taskResponse.data) return { error: "Esta tarefa não está disponível neste espaço de trabalho." };
  if (assignments.error || checklist.error || activity.error) {
    return { error: "Não foi possível carregar os detalhes da tarefa." };
  }

  const labelIds = (assignments.data ?? []).map((assignment) => assignment.label_id);
  const labelsResponse = labelIds.length
    ? await auth.supabase.from("task_labels")
        .select("id, workspace_id, created_by, name, name_key, color, created_at")
        .in("id", labelIds)
    : { data: [], error: null };
  if (labelsResponse.error) return { error: "Não foi possível carregar as etiquetas da tarefa." };

  return {
    success: true,
    detail: {
      labelIds,
      assignedLabels: (labelsResponse.data ?? []) as TaskLabel[],
      checklist: (checklist.data ?? []) as TaskChecklistItem[],
      activity: (activity.data ?? []) as TaskActivity[],
    },
  };
}

export async function createTaskChecklistItem(input: unknown): Promise<ActionResult<{ item?: TaskChecklistItem }>> {
  const parsed = createChecklistItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o nome do item." };
  const access = await getTaskWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };

  const { data, error } = await access.supabase.rpc("create_task_checklist_item", {
    p_task_id: parsed.data.taskId,
    p_title: parsed.data.title,
  });
  const item = data?.[0];
  if (error || !item || item.workspace_id !== access.workspaceId) {
    return { error: "Não foi possível adicionar o item ao checklist." };
  }
  return { success: true, item: item as TaskChecklistItem };
}

export async function updateTaskChecklistItem(input: unknown): Promise<ActionResult<{ item?: TaskChecklistItem }>> {
  const parsed = updateChecklistItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o item do checklist." };
  const access = await getTaskWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };

  const update: { title?: string; is_completed?: boolean } = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.isCompleted !== undefined) update.is_completed = parsed.data.isCompleted;
  const { data: item, error } = await access.supabase.from("task_checklist_items")
    .update(update)
    .eq("id", parsed.data.id)
    .eq("workspace_id", access.workspaceId)
    .select("id, task_id, workspace_id, title, is_completed, position, created_at, updated_at")
    .maybeSingle();
  if (error || !item) return { error: "Não foi possível atualizar o item do checklist." };
  return { success: true, item: item as TaskChecklistItem };
}

export async function deleteTaskChecklistItem(input: unknown): Promise<ActionResult> {
  const parsed = checklistItemIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Item inválido." };
  const access = await getTaskWorkspaceAccess();
  if (!access) return { error: "Sua sessão ou espaço de trabalho não está disponível." };
  const { data, error } = await access.supabase.from("task_checklist_items")
    .delete()
    .eq("id", parsed.data.id)
    .eq("workspace_id", access.workspaceId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Não foi possível excluir o item do checklist." };
  return { success: true };
}
