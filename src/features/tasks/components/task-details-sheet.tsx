"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskActivitySection, TaskChecklistSection } from "@/features/tasks/components/task-details-sections";
import { TaskEditorForm } from "@/features/tasks/components/task-editor-form";
import { getTaskDetails } from "@/features/tasks/actions/task-details";
import type { TaskActivity, TaskChecklistItem, TaskLabel, Task, Project } from "@/features/tasks/data/queries";

type TaskDetail = {
  labelIds: string[];
  assignedLabels: TaskLabel[];
  checklist: TaskChecklistItem[];
  activity: TaskActivity[];
};

export function TaskDetailsSheet(props: {
  task: Task | null;
  projects: Project[];
  labels: TaskLabel[];
  today: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onChecklistChanged: (taskId: string, progress: { total: number; completed: number }) => void;
  onDelete: (task: Task) => Promise<string | null>;
}) {
  return <TaskDetailsSheetContent key={props.task?.id ?? "closed"} {...props} />;
}

function TaskDetailsSheetContent({ task, projects, labels, today, onClose, onSaved, onChecklistChanged, onDelete }: {
  task: Task | null;
  projects: Project[];
  labels: TaskLabel[];
  today: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onChecklistChanged: (taskId: string, progress: { total: number; completed: number }) => void;
  onDelete: (task: Task) => Promise<string | null>;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(task));
  const [loadError, setLoadError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadDetails = useCallback(async (taskId: string, showLoading = false): Promise<TaskDetail | null> => {
    if (showLoading) setLoading(true);
    try {
      const result = await getTaskDetails({ id: taskId });
      if (result.error || !result.detail) {
        setLoadError(result.error ?? "Não foi possível carregar os detalhes da tarefa.");
        return null;
      }
      setDetail(result.detail);
      setLoadError("");
      return result.detail;
    } catch {
      setLoadError("Não foi possível carregar os detalhes da tarefa.");
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const taskId = task?.id;
    if (!taskId) return;
    let active = true;
    void getTaskDetails({ id: taskId }).then((result) => {
      if (!active) return;
      if (result.error || !result.detail) setLoadError(result.error ?? "Não foi possível carregar os detalhes da tarefa.");
      else setDetail(result.detail);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setLoadError("Não foi possível carregar os detalhes da tarefa.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [task?.id]);

  const currentTask = task;
  const availableLabels = useMemo(() => {
    const byId = new Map(labels.map((label) => [label.id, label]));
    detail?.assignedLabels.forEach((label) => byId.set(label.id, label));
    return [...byId.values()];
  }, [labels, detail?.assignedLabels]);

  function requestClose() {
    if (busy) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  async function handleSaved(savedTask?: Task) {
    if (!savedTask) return;
    setDirty(false);
    onSaved(savedTask);
    await loadDetails(savedTask.id);
  }

  async function handleDelete() {
    if (!currentTask || deletePending) return;
    setDeletePending(true);
    setDeleteError("");
    let error: string | null;
    try {
      error = await onDelete(currentTask);
    } catch {
      error = "Não foi possível excluir a tarefa. Tente novamente.";
    } finally {
      setDeletePending(false);
    }
    if (error) {
      setDeleteError(error);
      return;
    }
    setDeleteOpen(false);
    setDirty(false);
    onClose();
  }

  return (
    <>
      <Sheet open={Boolean(task)} onOpenChange={(open) => { if (!open) requestClose(); }}>
        <SheetContent side="right" showCloseButton={false} className="data-[side=right]:w-[min(520px,100vw)] data-[side=right]:sm:max-w-[520px] gap-0 overflow-hidden border-l border-border bg-card p-0">
          {task && <>
            <SheetHeader className="shrink-0 gap-1 border-b border-border-soft px-6 py-4 pr-16">
              <p className="text-xs font-medium text-text-soft">Tarefa</p>
              <SheetTitle className="text-[20px] font-semibold tracking-tight">Detalhes da tarefa</SheetTitle>
              <SheetDescription className="text-xs leading-5">Edite os detalhes, acompanhe o progresso e mantenha tudo organizado.</SheetDescription>
            </SheetHeader>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar detalhes da tarefa" onClick={requestClose} className="absolute right-4 top-4 z-10 size-9 rounded-lg">
              <X aria-hidden="true" className="size-4" />
            </Button>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-5">
              {loading && <div className="grid gap-5 px-6" aria-label="Carregando detalhes da tarefa">
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-9 w-4/5" />
                <div className="grid grid-cols-2 gap-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                <div className="grid grid-cols-3 gap-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                <Skeleton className="h-14" />
                <Skeleton className="h-24" />
              </div>}

              {!loading && loadError && !detail && <div className="grid gap-3 px-6" role="alert">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button type="button" variant="outline" onClick={() => void loadDetails(task.id, true)}>Tentar novamente</Button>
              </div>}

              {!loading && detail && currentTask && <>
                {loadError && <p role="alert" className="mx-6 mb-4 rounded-lg border border-destructive-border-soft bg-destructive-surface px-3 py-2 text-sm text-destructive">{loadError} Os dados já carregados continuam disponíveis.</p>}
                <TaskEditorForm
                key={currentTask.id}
                task={currentTask}
                projects={projects}
                labels={availableLabels}
                assignedLabelIds={detail.labelIds}
                today={today}
                onCancel={requestClose}
                onSaved={handleSaved}
                onDirtyChange={setDirty}
                onPendingChange={setBusy}
                onDelete={() => { setDeleteError(""); setDeleteOpen(true); }}
              >
                <TaskChecklistSection taskId={currentTask.id} items={detail.checklist} onChanged={async () => {
                  const updatedDetail = await loadDetails(currentTask.id);
                  if (!updatedDetail) return;
                  const total = updatedDetail.checklist.length;
                  const completed = updatedDetail.checklist.reduce((count, item) => count + Number(item.is_completed), 0);
                  onChecklistChanged(currentTask.id, { total, completed });
                }} />
                <TaskActivitySection events={detail.activity} />
                </TaskEditorForm>
              </>}
            </div>
          </>}
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>As mudanças que ainda não foram salvas serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button type="button" variant="outline">Continuar editando</Button></AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => { setDiscardOpen(false); setDirty(false); onClose(); }}>Descartar alterações</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deletePending) setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>“{currentTask?.title}” será removida permanentemente deste workspace. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button type="button" variant="outline" disabled={deletePending}>Cancelar</Button></AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deletePending} onClick={() => { void handleDelete(); }}>{deletePending ? "Excluindo..." : "Excluir tarefa"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
