"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, ChevronRight, Flag, Folder, GripVertical, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskCreateDialog } from "@/features/tasks/components/task-create-dialog";
import type { TaskSaveContext } from "@/features/tasks/components/task-editor-form";
import { CreateProjectDialog } from "@/features/tasks/components/create-project-dialog";
import { TaskDetailsSheet } from "@/features/tasks/components/task-details-sheet";
import { TaskEmptyState } from "@/features/tasks/components/task-empty-state";
import { TaskRowActions, type TaskAction, type TaskActionResult } from "@/features/tasks/components/task-row-actions";
import { TaskToolbar } from "@/features/tasks/components/task-toolbar";
import { TaskKanbanView } from "@/features/tasks/components/task-kanban-view";
import { TaskLoadErrorPanel } from "@/features/tasks/components/task-load-error";
import { archiveTask, deleteTask, duplicateTask, moveTask, moveTaskStatus, reorderTaskGroup, restoreTask, setTaskCompletion } from "@/features/tasks/actions/tasks";
import { formatTaskDate, getTaskPriorityPresentation, groupTasks } from "@/features/tasks/data/presentation";
import { withKanbanChecklistProgress } from "@/features/tasks/data/kanban-progress";
import { canReorderTasks, hasActiveTaskFilters, matchesTaskFilters, replaceTaskInOrder, sortTasks } from "@/features/tasks/data/task-filtering";
import type { TaskLoadIssue } from "@/features/tasks/data/kanban-presentation";
import type { Project, Task, TaskFilters, TaskKanbanMetadata, TaskLabel, TaskStatus } from "@/features/tasks/data/queries";

type Props = {
  workspaceName: string;
  projects: Project[];
  labels: TaskLabel[];
  tasks: Task[];
  kanbanMetadata: Record<string, TaskKanbanMetadata>;
  today: string;
  view: "list" | "kanban";
  filters: TaskFilters;
  canCreateProjects: boolean;
  loadError: TaskLoadIssue | null;
};

const groupTone: Record<string, string> = {
  today: "bg-selection-soft text-primary",
  overdue: "bg-state-overdue-surface text-state-overdue",
  completed: "bg-state-completed-surface text-state-completed",
  upcoming: "bg-state-neutral-surface text-text-secondary",
  unscheduled: "bg-state-neutral-surface text-text-secondary",
  other: "bg-state-neutral-surface text-text-secondary",
  archived: "bg-state-neutral-surface text-text-secondary",
};

export function TaskList({ workspaceName, projects: initialProjects, labels, tasks: initialTasks, kanbanMetadata, today, view, filters, canCreateProjects, loadError }: Props) {
  const router = useRouter();
  const [taskState, setTaskState] = useState({ base: initialTasks, value: initialTasks });
  const tasks = taskState.base === initialTasks ? taskState.value : initialTasks;
  const [kanbanMetadataState, setKanbanMetadataState] = useState({ base: kanbanMetadata, value: kanbanMetadata });
  const currentKanbanMetadata = kanbanMetadataState.base === kanbanMetadata ? kanbanMetadataState.value : kanbanMetadata;
  function updateTasks(updater: (current: Task[]) => Task[]) {
    setTaskState((current) => {
      const base = current.base === initialTasks ? current.value : initialTasks;
      return { base: initialTasks, value: updater(base) };
    });
  }
  function updateChecklistProgress(taskId: string, progress: { total: number; completed: number }) {
    setKanbanMetadataState((current) => {
      const base = current.base === kanbanMetadata ? current.value : kanbanMetadata;
      return {
        base: kanbanMetadata,
        value: withKanbanChecklistProgress(base, taskId, progress),
      };
    });
  }
  const projects = initialProjects;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createdTaskToFocus, setCreatedTaskToFocus] = useState<string | null>(null);
  const focusedCreatedTask = useRef<string | null>(null);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const detailsOpenerRef = useRef<HTMLElement | null>(null);
  const pendingTaskIdsRef = useRef(new Set<string>());
  const [pendingTaskIds, setPendingTaskIds] = useState<ReadonlySet<string>>(() => new Set());
  const pendingCount = pendingTaskIds.size;
  const [reordering, setReordering] = useState(false);

  const groups = useMemo(() => groupTasks(tasks, today, filters.archived), [tasks, today, filters.archived]);
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const filtered = hasActiveTaskFilters(filters);
  const canReorder = canReorderTasks(filters);

  useEffect(() => {
    if (!createdTaskToFocus || focusedCreatedTask.current === createdTaskToFocus) return;
    const titleButton = document.querySelector<HTMLButtonElement>(`[data-task-title-id="${CSS.escape(createdTaskToFocus)}"][data-task-view="${view}"]`);
    if (!titleButton) return;

    titleButton.focus({ preventScroll: true });
    titleButton.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    focusedCreatedTask.current = createdTaskToFocus;
  }, [createdTaskToFocus, tasks, view]);

  function handleTaskCreated(task: Task, context?: TaskSaveContext) {
    setCreateOpen(false);
    if (view === "kanban") {
      const labelIds = context?.labelIds ?? [];
      if (matchesTaskFilters(task, filters, today, labelIds)) {
        updateTasks((current) => sortTasks([...current.filter((item) => item.id !== task.id), task], filters.sort));
        setKanbanMetadataState((current) => {
          const base = current.base === kanbanMetadata ? current.value : kanbanMetadata;
          return {
            base: kanbanMetadata,
            value: {
              ...base,
              [task.id]: { labelIds, checklistTotal: 0, checklistCompleted: 0 },
            },
          };
        });
        setCreatedTaskToFocus(task.id);
      }
      if (context?.createdNewLabels) router.refresh();
      toast.success("Tarefa criada.");
      return;
    }
    if (filters.labelIds.length) {
      router.refresh();
    } else if (matchesTaskFilters(task, filters, today)) {
      updateTasks((current) => sortTasks([...current.filter((item) => item.id !== task.id), task], filters.sort));
      const group = groupTasks([task], today, false)[0];
      if (group) setCollapsedGroups((current) => ({ ...current, [group.key]: false }));
      setCreatedTaskToFocus(task.id);
    }

    toast.success("Tarefa criada.");
  }

  function refreshAfterSave(message: string) {
    toast.success(message);
    router.refresh();
  }

  function openTaskDetails(task: Task, opener?: HTMLElement | null) {
    const activeElement = document.activeElement;
    detailsOpenerRef.current = opener ?? (activeElement instanceof HTMLElement ? activeElement : null);
    setDetailsTask(task);
  }

  function closeTaskDetails() {
    const opener = detailsOpenerRef.current;
    detailsOpenerRef.current = null;
    setDetailsTask(null);
    if (opener?.isConnected) requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  }

  async function performAction(action: TaskAction, task: Task, projectId?: string, requestId?: string): Promise<TaskActionResult> {
    const deleteToastId = action === "delete" ? `delete-task-${task.id}` : undefined;
    if (deleteToastId) toast.loading("Excluindo tarefa...", { id: deleteToastId });

    let result: TaskActionResult;
    try {
      if (action === "duplicate") result = await duplicateTask({ id: task.id, requestId });
      else if (action === "archive") result = await archiveTask({ id: task.id });
      else if (action === "restore") result = await restoreTask({ id: task.id });
      else if (action === "delete") result = await deleteTask({ id: task.id });
      else result = await moveTask({ id: task.id, projectId: projectId ?? "" });
    } catch {
      result = { error: "Não foi possível concluir a ação. Tente novamente." };
    }

    if (result.error) {
      toast.error(result.error, deleteToastId ? { id: deleteToastId } : undefined);
      return result;
    }

    if (action === "archive" || action === "restore" || action === "delete") {
      updateTasks((current) => current.filter((item) => item.id !== task.id));
    } else if (action === "move" && result.task) {
      updateTasks((current) => sortTasks(
        [...current.filter((item) => item.id !== task.id), ...(matchesTaskFilters(result.task!, filters, today, filters.labelIds) ? [result.task!] : [])],
        filters.sort,
      ));
    } else if (action === "duplicate" && result.task && view === "kanban") {
      router.refresh();
    } else if (action === "duplicate" && result.task) {
      const copy = result.task;
      if (filters.labelIds.length) router.refresh();
      else if (matchesTaskFilters(copy, filters, today)) updateTasks((current) => sortTasks(current.some((item) => item.id === copy.id) ? current : [...current, copy], filters.sort));
    }
    const successMessages: Record<TaskAction, string> = {
      duplicate: "Tarefa duplicada.", archive: "Tarefa arquivada.", restore: "Tarefa restaurada.", delete: "Tarefa excluída.", move: "Tarefa movida.",
    };
    toast.success(successMessages[action], deleteToastId ? { id: deleteToastId } : undefined);
    return result;
  }

  async function toggleCompletion(task: Task, checked: boolean) {
    if (pendingTaskIdsRef.current.has(task.id) || (task.status === "completed") === checked) return;

    const previous = task.status;
    const previousCompletedAt = task.completed_at;
    const completedAt = checked ? new Date().toISOString() : null;
    const optimisticTask: Task = { ...task, status: checked ? "completed" : "pending", completed_at: completedAt };
    const remainsVisible = matchesTaskFilters(optimisticTask, filters, today, filters.labelIds);
    pendingTaskIdsRef.current.add(task.id);
    setPendingTaskIds(new Set(pendingTaskIdsRef.current));
    updateTasks((current) => sortTasks([
      ...current.filter((item) => item.id !== task.id),
      ...(remainsVisible ? [optimisticTask] : []),
    ], filters.sort));
    setDetailsTask((current) => current?.id === task.id
      ? { ...current, status: checked ? "completed" : "pending", completed_at: completedAt }
      : current);

    try {
      const result = await setTaskCompletion({ id: task.id, completed: checked });
      if (result.error) {
        const originalTask = { ...task, status: previous, completed_at: previousCompletedAt } as Task;
        updateTasks((current) => sortTasks([...current.filter((item) => item.id !== task.id), originalTask], filters.sort));
        setDetailsTask((current) => current?.id === task.id
          ? { ...current, status: previous, completed_at: previousCompletedAt }
          : current);
        toast.error(result.error);
      }
    } catch {
      const originalTask = { ...task, status: previous, completed_at: previousCompletedAt } as Task;
      updateTasks((current) => sortTasks([...current.filter((item) => item.id !== task.id), originalTask], filters.sort));
      setDetailsTask((current) => current?.id === task.id
        ? { ...current, status: previous, completed_at: previousCompletedAt }
        : current);
      const message = "Não foi possível atualizar a tarefa. Tente novamente.";
      toast.error(message);
    } finally {
      pendingTaskIdsRef.current.delete(task.id);
      setPendingTaskIds(new Set(pendingTaskIdsRef.current));
    }
  }

  async function moveKanbanTask(task: Task, status: TaskStatus) {
    if (filters.archived || status === task.status || pendingTaskIdsRef.current.has(task.id)) return;

    const completedAt = status === "completed" ? task.completed_at ?? new Date().toISOString() : null;
    const optimisticTask: Task = { ...task, status, completed_at: completedAt };
    const labelIds = currentKanbanMetadata[task.id]?.labelIds ?? [];
    const originalIndex = tasks.findIndex((item) => item.id === task.id);
    pendingTaskIdsRef.current.add(task.id);
    setPendingTaskIds(new Set(pendingTaskIdsRef.current));
    updateTasks((current) => replaceTaskInOrder(
      current,
      optimisticTask,
      matchesTaskFilters(optimisticTask, filters, today, labelIds),
      originalIndex,
    ));
    setDetailsTask((current) => current?.id === task.id ? optimisticTask : current);

    try {
      const result = await moveTaskStatus({ id: task.id, status });
      if (result.error || !result.task) throw new Error(result.error ?? "Não foi possível mover a tarefa.");
      const savedTask = result.task;
      updateTasks((current) => replaceTaskInOrder(
        current,
        savedTask,
        matchesTaskFilters(savedTask, filters, today, labelIds),
        originalIndex,
      ));
      setDetailsTask((current) => current?.id === task.id ? savedTask : current);
      toast.success("Tarefa movida de etapa.");
    } catch (error) {
      updateTasks((current) => replaceTaskInOrder(
        current,
        task,
        matchesTaskFilters(task, filters, today, labelIds),
        originalIndex,
      ));
      setDetailsTask((current) => current?.id === task.id ? task : current);
      toast.error(error instanceof Error ? error.message : "Não foi possível mover a tarefa. Tente novamente.");
    } finally {
      pendingTaskIdsRef.current.delete(task.id);
      setPendingTaskIds(new Set(pendingTaskIdsRef.current));
    }
  }

  function handleTaskSaved(task: Task) {
    if (filters.labelIds.length || view === "kanban") router.refresh();
    else updateTasks((current) => sortTasks([
      ...current.filter((item) => item.id !== task.id),
      ...(matchesTaskFilters(task, filters, today) ? [task] : []),
    ], filters.sort));
    setDetailsTask(task);
  }

  async function handleTaskReorder(groupKey: string, groupTasks: Task[], sourceId: string, targetId: string) {
    if (!canReorder || reordering || sourceId === targetId) return;
    const from = groupTasks.findIndex((task) => task.id === sourceId);
    const to = groupTasks.findIndex((task) => task.id === targetId);
    if (from < 0 || to < 0) return;

    const nextGroup = [...groupTasks];
    const [moved] = nextGroup.splice(from, 1);
    nextGroup.splice(to, 0, moved);
    const nextOrders = new Map(nextGroup.map((task, index) => [task.id, index + 1]));
    const previousOrders = new Map(groupTasks.map((task) => [task.id, task.sort_order]));
    updateTasks((current) => sortTasks(current.map((task) => nextOrders.has(task.id)
      ? { ...task, sort_order: nextOrders.get(task.id)! }
      : task), filters.sort));
    setReordering(true);

    const restoreOrder = () => updateTasks((current) => sortTasks(current.map((task) => previousOrders.has(task.id)
      ? { ...task, sort_order: previousOrders.get(task.id) ?? null }
      : task), filters.sort));
    try {
      const result = await reorderTaskGroup({ groupKey, taskIds: nextGroup.map((task) => task.id) });
      if (result.error) {
        restoreOrder();
        toast.error(result.error);
      }
    } catch {
      restoreOrder();
      const message = "Não foi possível salvar a ordem manual. Tente novamente.";
      toast.error(message);
    } finally {
      setReordering(false);
    }
  }

  async function deleteFromDetails(task: Task) {
    const result = await performAction("delete", task);
    if (!result.error) setDetailsTask(null);
    return result.error ?? null;
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (view === "kanban") params.set("view", "kanban");
    if (filters.sort !== "due_soon") params.set("sort", filters.sort);
    router.push(params.size ? `/hoje?${params.toString()}` : "/hoje", { scroll: false });
  }

  return (
    <main className={`min-w-0 flex-1 bg-card ${view === "kanban" ? "amora-kanban-page" : ""}`}>
      <section className="mx-auto w-full max-w-[1600px] px-5 pb-8 pt-5 sm:px-7 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <nav aria-label="Trilha de navegação" className="mb-4 flex items-center gap-2 text-[13px] text-text-faint">
              <span className="max-w-[240px] truncate">{workspaceName}</span>
              <span aria-hidden="true">/</span>
              {view === "kanban" ? <>
                <span>Tarefas</span>
                <span aria-hidden="true">/</span>
                <span className="text-text-secondary">Kanban</span>
              </> : <span className="text-text-secondary">Tarefas</span>}
            </nav>
            <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.8px] text-foreground">Minhas tarefas</h1>
            <p className="mt-1.5 text-[14px] text-text-gray">{view === "kanban" ? "Organize seu trabalho e acompanhe o andamento de cada tarefa." : "Organize e acompanhe tudo o que precisa ser feito."}</p>
          </div>
          <div className="flex items-center gap-2">
            {canCreateProjects && <CreateProjectDialog onCreated={() => refreshAfterSave("Projeto criado.")} />}
            <TaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} projects={projects} labels={labels} today={today} onSaved={handleTaskCreated} />
          </div>
        </div>

        <div className="mb-6 border-b border-border-soft pb-4">
          <TaskToolbar key={filters.q} projects={projects} labels={labels} filters={filters} view={view} />
          {filters.sort === "manual" && filtered && <p className="mt-2 text-xs text-text-faint" role="status">Limpe os filtros para reorganizar as tarefas.</p>}
          {canReorder && <p id="task-reorder-help" className="sr-only">Use as setas para cima e para baixo para mover esta tarefa dentro do grupo.</p>}
        </div>

        {loadError && <TaskLoadErrorPanel issue={loadError} className="mb-4" />}

        <div hidden={Boolean(loadError) || view !== "list"}>
          {tasks.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <TaskEmptyState archived={filters.archived} filtered={filtered} onCreate={() => setCreateOpen(true)} onClear={clearFilters} />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table className="min-w-[1040px] table-fixed border-collapse text-left text-[13px]">
              <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[31%]" />
                  <col className="w-[16%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[22%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <TableHeader className="bg-muted text-[12px] font-semibold text-text-mid">
                  <TableRow className="h-11 border-border-soft hover:bg-transparent">
                    <TableHead className="px-4"><span className="sr-only">Concluir tarefa</span></TableHead>
                    <TableHead className="px-3">Tarefa</TableHead>
                    <TableHead className="px-3">Projeto</TableHead>
                    <TableHead className="px-3">Início</TableHead>
                    <TableHead className="px-3">Prazo</TableHead>
                    <TableHead className="px-3">Prioridade</TableHead>
                    <TableHead className="px-2"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const collapsed = Boolean(collapsedGroups[group.key]);
                    return <TaskGroupRows
                      key={group.key}
                      group={group}
                      collapsed={collapsed}
                      onToggle={() => setCollapsedGroups((current) => ({ ...current, [group.key]: !current[group.key] }))}
                      projectNames={projectNames}
                      projects={projects}
                      today={today}
                      archived={filters.archived}
                      pendingTaskIds={pendingTaskIds}
                      onToggleCompletion={toggleCompletion}
                      onOpen={openTaskDetails}
                      onAction={performAction}
                      canReorder={canReorder && group.key !== "archived"}
                      reordering={reordering}
                      onReorder={(sourceId, targetId) => void handleTaskReorder(group.key, group.tasks, sourceId, targetId)}
                      selectedTaskId={detailsTask?.id ?? null}
                    />;
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div hidden={Boolean(loadError) || view !== "kanban"}>
          <TaskKanbanView
            tasks={tasks}
            projects={projects}
            labels={labels}
            metadata={currentKanbanMetadata}
            today={today}
            archived={filters.archived}
            filtered={filtered}
            selectedTaskId={detailsTask?.id ?? null}
            pendingTaskIds={pendingTaskIds}
            onOpen={openTaskDetails}
            onAction={performAction}
            onMoveStatus={moveKanbanTask}
            onCreate={() => setCreateOpen(true)}
            onClearFilters={clearFilters}
          />
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-text-soft" aria-live="polite">
          {pendingCount > 0 && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />}
          {tasks.length > 0 ? `${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"}` : ""}
          {pendingCount > 0 && <span>{`· Salvando ${pendingCount} ${pendingCount === 1 ? "tarefa" : "tarefas"}`}</span>}
        </p>
      </section>
      <TaskDetailsSheet task={detailsTask} projects={projects} labels={labels} today={today} onClose={closeTaskDetails} onSaved={handleTaskSaved} onChecklistChanged={updateChecklistProgress} onDelete={deleteFromDetails} />
    </main>
  );
}

function TaskGroupRows({ group, collapsed, onToggle, projectNames, projects, today, archived, pendingTaskIds, onToggleCompletion, onOpen, onAction, canReorder, reordering, onReorder, selectedTaskId }: {
  group: { key: string; label: string; tasks: Task[] };
  collapsed: boolean;
  onToggle: () => void;
  projectNames: Map<string, string>;
  projects: Project[];
  today: string;
  archived: boolean;
  pendingTaskIds: ReadonlySet<string>;
  onToggleCompletion: (task: Task, checked: boolean) => void;
  onOpen: (task: Task, opener?: HTMLElement | null) => void;
  onAction: (action: TaskAction, task: Task, projectId?: string, requestId?: string) => Promise<TaskActionResult>;
  canReorder: boolean;
  reordering: boolean;
  onReorder: (sourceId: string, targetId: string) => void;
  selectedTaskId: string | null;
}) {
  return <>
    <TableRow className="border-0 hover:bg-transparent">
      <TableHead scope="rowgroup" colSpan={7} className={`h-11 px-4 py-0 text-left ${groupTone[group.key] ?? groupTone.other}`}>
        <button type="button" aria-expanded={!collapsed} onClick={onToggle} className="flex h-full w-full items-center gap-2 text-left font-semibold focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
          {collapsed ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          <span>{group.label}</span>
          <Badge variant="secondary" className="h-5 min-w-6 justify-center border-0 bg-card/70 px-1.5 text-[11px] font-semibold tabular-nums text-current">{group.tasks.length}</Badge>
        </button>
      </TableHead>
    </TableRow>
    {!collapsed && group.tasks.map((task) => {
      const completed = task.status === "completed";
      const pending = pendingTaskIds.has(task.id);
      return <TableRow key={task.id} data-task-row-id={task.id} data-state={selectedTaskId === task.id ? "selected" : undefined} aria-busy={pending || undefined} onDragOver={(event) => { if (canReorder && !reordering) event.preventDefault(); }} onDrop={(event) => {
        if (!canReorder || reordering) return;
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/plain");
        if (sourceId) onReorder(sourceId, task.id);
      }} className={`group h-[52px] border-border-soft transition-colors hover:bg-row-hover ${selectedTaskId === task.id ? "bg-selection-soft/70" : ""}`}>
        <TableCell className="px-4 py-2.5">
          {!archived && <div className="flex items-center gap-1.5">
            <Checkbox checked={completed} disabled={pending} onCheckedChange={(checked) => onToggleCompletion(task, checked === true)} aria-label={completed ? `Reabrir ${task.title}` : `Concluir ${task.title}`} className="size-[18px] rounded-[5px]" />
            <span className="flex size-4 shrink-0 items-center justify-center">
              {pending ? <><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-primary motion-reduce:animate-none" /><span className="sr-only" role="status">Salvando tarefa</span></> : <span className="size-3.5" aria-hidden="true" />}
            </span>
          </div>}
          {archived && <span className="block w-[18px]" aria-hidden="true" />}
        </TableCell>
        <TableCell className="max-w-0 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-1">
            {canReorder && <button type="button" disabled={reordering} draggable={!reordering} aria-label={`Reordenar ${task.title}`} aria-describedby="task-reorder-help" aria-keyshortcuts="ArrowUp ArrowDown" title="Arraste ou use as setas para reordenar" onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", task.id);
            }} onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              const index = group.tasks.findIndex((item) => item.id === task.id);
              const target = group.tasks[index + (event.key === "ArrowUp" ? -1 : 1)];
              if (target) onReorder(task.id, target.id);
            }} className="inline-flex size-7 shrink-0 items-center justify-center rounded text-text-faint opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none">
              <GripVertical aria-hidden="true" className="size-4" />
            </button>}
            <button type="button" data-task-title-id={task.id} data-task-view="list" onClick={() => onOpen(task)} title={task.title} className={`block min-w-0 grow truncate text-left leading-5 text-text-heading underline-offset-2 hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring ${completed ? "text-text-soft line-through" : ""}`}>
              {task.title}
            </button>
          </div>
        </TableCell>
        <TableCell className="max-w-[210px] px-3 py-2.5">
          <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-text-secondary">
            <Folder aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 truncate">{task.project_id ? projectNames.get(task.project_id) ?? "Projeto indisponível" : "Sem projeto"}</span>
          </span>
        </TableCell>
        <TableCell className="px-3 py-2.5 text-text-gray">{formatStart(task, today)}</TableCell>
        <TableCell className="px-3 py-2.5">{dueBadge(task, today, completed)}</TableCell>
        <TableCell className="px-3 py-2.5"><PriorityLabel priority={task.priority} /></TableCell>
        <TableCell className="px-2 py-2">
          <TaskRowActions task={task} projects={projects} archived={archived} onOpen={onOpen} onAction={onAction} />
        </TableCell>
      </TableRow>;
    })}
  </>;
}

function PriorityLabel({ priority }: { priority: string }) {
  const value = getTaskPriorityPresentation(priority);
  return <span className="inline-flex items-center gap-2 whitespace-nowrap text-text-secondary"><Flag aria-hidden="true" className={`size-4 ${value.color}`} fill="currentColor" strokeWidth={1.5} /><span>{value.label}</span></span>;
}

function formatStart(task: Task, today: string) {
  if (!task.planned_for) return task.start_time ? task.start_time.slice(0, 5) : <span className="text-text-disabled">—</span>;
  if (task.planned_for === today) return task.start_time ? task.start_time.slice(0, 5) : "Hoje";
  if (task.planned_for < today) return formatTaskDate(task.planned_for);
  return formatTaskDate(task.planned_for);
}

function dueBadge(task: Task, today: string, completed: boolean) {
  if (!task.due_on) return <span className="text-text-disabled">—</span>;
  const overdue = !completed && task.due_on < today;
  const label = task.due_on === today ? "Hoje" : formatTaskDate(task.due_on);
  const style = overdue ? "bg-state-overdue-chip-surface text-state-overdue" : completed ? "bg-state-completed-chip-surface text-state-completed" : "bg-selection-soft text-primary";
  return <Badge variant="secondary" className={`h-6 rounded-full border-0 px-2 text-[12px] font-medium ${style}`}><CalendarDays aria-hidden="true" className="size-3.5" />{label}</Badge>;
}

