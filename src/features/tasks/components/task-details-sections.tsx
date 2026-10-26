"use client";

import { useState, type KeyboardEvent } from "react";
import { Check, CircleCheck, Ellipsis, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { createTaskChecklistItem, deleteTaskChecklistItem, updateTaskChecklistItem } from "@/features/tasks/actions/task-details";
import type { TaskActivity, TaskChecklistItem } from "@/features/tasks/data/queries";

export function TaskChecklistSection({ taskId, items, onChanged }: {
  taskId: string;
  items: TaskChecklistItem[];
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingItem, setDeletingItem] = useState<TaskChecklistItem | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function addItem() {
    if (pending || !newTitle.trim()) return;
    setPending(true);
    setError("");
    try {
      const result = await createTaskChecklistItem({ taskId, title: newTitle });
      if (result.error || !result.item) {
        setError(result.error ?? "Não foi possível adicionar o item.");
        return;
      }
      setNewTitle("");
      setAdding(false);
      await onChanged();
    } catch {
      setError("Não foi possível adicionar o item. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function updateItem(item: TaskChecklistItem, update: { title?: string; isCompleted?: boolean }) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await updateTaskChecklistItem({ id: item.id, ...update });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditingId(null);
      await onChanged();
    } catch {
      setError("Não foi possível atualizar o item. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function removeItem() {
    if (!deletingItem || pending) return;
    setPending(true);
    setError("");
    try {
      const result = await deleteTaskChecklistItem({ id: deletingItem.id });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeletingItem(null);
      await onChanged();
    } catch {
      setError("Não foi possível excluir o item. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="task-checklist-heading" className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 id="task-checklist-heading" className="text-sm font-semibold">Checklist</h3>
          <Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px] tabular-nums">{items.length}</Badge>
        </div>
        <Button type="button" variant="outline" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs" onClick={() => { setAdding(true); setError(""); }} disabled={pending}>
          <Plus aria-hidden="true" className="size-3.5" /> Adicionar item
        </Button>
      </div>

      {items.length > 0 ? <ul className="overflow-hidden rounded-xl border border-border-soft bg-background/50">
        {items.map((item, index) => <li key={item.id} className={`flex min-h-10 items-center gap-2.5 px-2.5 py-1.5 ${index > 0 ? "border-t border-border-soft" : ""}`}>
          <Checkbox checked={item.is_completed} disabled={pending} aria-label={item.is_completed ? `Reabrir item ${item.title}` : `Concluir item ${item.title}`} onCheckedChange={(checked) => { void updateItem(item, { isCompleted: checked === true }); }} className="size-[18px] shrink-0 rounded-[5px]" />
          {editingId === item.id ? <div role="group" aria-label={`Renomear ${item.title}`} className="flex min-w-0 flex-1 items-center gap-1.5">
            <Input autoFocus value={editingTitle} maxLength={160} aria-label="Nome do item do checklist" onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void updateItem(item, { title: editingTitle });
              } else if (event.key === "Escape") {
                setEditingId(null);
                setEditingTitle("");
              }
            }} className="h-8 min-w-0 text-sm" />
            <Button type="button" variant="ghost" size="icon-sm" className="size-8 shrink-0" disabled={pending || !editingTitle.trim()} onClick={() => { void updateItem(item, { title: editingTitle }); }} aria-label="Salvar nome do item"><Check aria-hidden="true" className="size-4" /></Button>
          </div> : <span className={`min-w-0 flex-1 text-[13px] leading-5 ${item.is_completed ? "text-text-soft line-through" : "text-foreground"}`}>{item.title}</span>}
          {editingId !== item.id && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={`Ações para ${item.title}`} className="size-8 shrink-0 text-text-soft"><Ellipsis aria-hidden="true" className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => { setEditingId(item.id); setEditingTitle(item.title); }}><Pencil aria-hidden="true" />Renomear</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeletingItem(item)}><Trash2 aria-hidden="true" />Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </li>)}
      </ul> : <p className="rounded-xl border border-dashed border-border-soft px-3 py-4 text-center text-xs text-text-soft">Nenhum item no checklist.</p>}

      {adding && <div role="group" aria-label="Adicionar item ao checklist" className="flex items-center gap-2">
        <Input autoFocus value={newTitle} maxLength={160} aria-label="Novo item do checklist" placeholder="Nome do item" onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void addItem();
          }
        }} className="h-10 min-w-0 flex-1" />
        <Button type="button" className="h-10" disabled={pending || !newTitle.trim()} onClick={() => { void addItem(); }}>{pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : "Adicionar"}</Button>
        <Button type="button" variant="ghost" className="h-10" disabled={pending} onClick={() => { setAdding(false); setNewTitle(""); }}>Cancelar</Button>
      </div>}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <AlertDialog open={Boolean(deletingItem)} onOpenChange={(open) => { if (!pending && !open) setDeletingItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item do checklist?</AlertDialogTitle>
            <AlertDialogDescription>“{deletingItem?.title}” será removido deste checklist.</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button type="button" variant="outline" disabled={pending}>Cancelar</Button></AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => { void removeItem(); }}>{pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : "Excluir item"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

const activityCopy: Record<string, string> = {
  task_created: "Tarefa criada",
  task_title_changed: "Título alterado",
  task_priority_changed: "Prioridade alterada",
  task_project_changed: "Projeto alterado",
  task_schedule_changed: "Datas ou horário atualizados",
  task_status_changed: "Status atualizado",
  task_description_changed: "Descrição atualizada",
  task_labels_changed: "Etiqueta atualizada",
  checklist_item_added: "Item adicionado ao checklist",
  checklist_item_renamed: "Item do checklist renomeado",
  checklist_item_completed: "Item do checklist concluído",
  checklist_item_reopened: "Item do checklist reaberto",
  checklist_item_deleted: "Item removido do checklist",
};

function activityData(activity: TaskActivity) {
  return typeof activity.event_data === "object" && activity.event_data !== null && !Array.isArray(activity.event_data)
    ? activity.event_data as Record<string, unknown>
    : {};
}

function activityDescription(activity: TaskActivity) {
  const data = activityData(activity);
  if (activity.event_type === "task_priority_changed") {
    const labels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
    const from = labels[String(data.from)];
    const to = labels[String(data.to)];
    if (from && to) return `Prioridade alterada de ${from} para ${to}`;
  }
  if (activity.event_type === "task_status_changed") {
    return data.to === "completed" ? "Tarefa concluída" : "Tarefa reaberta";
  }
  if (activity.event_type === "task_labels_changed" && typeof data.label_name === "string") {
    return `${data.action === "removed" ? "Etiqueta removida" : "Etiqueta adicionada"}: ${data.label_name}`;
  }
  if (activity.event_type.startsWith("checklist_item_") && typeof data.title === "string") {
    return `${activityCopy[activity.event_type]}: ${data.title}`;
  }
  return activityCopy[activity.event_type] ?? "Tarefa atualizada";
}

export function TaskActivitySection({ events }: { events: TaskActivity[] }) {
  return <section aria-labelledby="task-activity-heading" className="grid gap-2">
    <h3 id="task-activity-heading" className="text-sm font-semibold">Atividade</h3>
    {events.length === 0 ? <p className="rounded-xl border border-dashed border-border-soft px-3 py-4 text-center text-xs text-text-soft">Nenhuma atividade registrada ainda.</p> : <ul>
      {events.map((event, index) => {
        const data = activityData(event);
        const name = typeof data.actor_name === "string" ? data.actor_name : "Equipe";
        const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at));
        return <li key={event.id} className={`flex min-h-[58px] items-center gap-3 py-2.5 ${index > 0 ? "border-t border-border-soft" : ""}`}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-text-secondary">
            {event.event_type.startsWith("checklist_item_") ? <CircleCheck aria-hidden="true" className="size-4" /> : <Pencil aria-hidden="true" className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-text-soft">{activityDescription(event)}</p>
          </div>
          <time className="shrink-0 text-[11px] text-text-soft" dateTime={event.created_at}>{date}</time>
        </li>;
      })}
    </ul>}
  </section>;
}
