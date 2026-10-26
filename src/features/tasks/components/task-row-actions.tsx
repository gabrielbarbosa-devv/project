"use client";

import { useRef, useState } from "react";
import { Archive, Check, Copy, Ellipsis, FileText, FolderInput, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project, Task } from "@/features/tasks/data/queries";

export type TaskAction = "duplicate" | "archive" | "restore" | "delete" | "move";
export type TaskActionResult = { error?: string; task?: Task };

export function TaskRowActions({ task, projects, archived, onOpen, onAction }: {
  task: Task;
  projects: Project[];
  archived: boolean;
  onOpen: (task: Task, opener?: HTMLElement | null) => void;
  onAction: (action: TaskAction, task: Task, projectId?: string, requestId?: string) => Promise<TaskActionResult>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pendingAction, setPendingAction] = useState<TaskAction | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const duplicateRequestId = useRef<string | null>(null);
  const actionLock = useRef(false);

  async function runAction(action: TaskAction, projectId?: string) {
    if (actionLock.current) return { error: "Aguarde a ação atual terminar." };
    actionLock.current = true;
    setPendingAction(action);
    if (action === "delete") setDeleteError("");

    const requestId = action === "duplicate"
      ? (duplicateRequestId.current ??= crypto.randomUUID())
      : undefined;

    try {
      const result = await onAction(action, task, projectId, requestId);
      if (action === "duplicate" && !result.error) duplicateRequestId.current = null;
      if (action === "delete") {
        if (result.error) setDeleteError(result.error);
        else setDeleteOpen(false);
      }
      return result;
    } catch {
      const error = action === "delete"
        ? "Não foi possível excluir a tarefa. Tente novamente."
        : "Não foi possível concluir a ação. Tente novamente.";
      if (action === "delete") setDeleteError(error);
      return { error };
    } finally {
      actionLock.current = false;
      setPendingAction(null);
    }
  }

  async function moveTo(projectId: string) {
    setMenuOpen(false);
    await runAction("move", projectId);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={menuTriggerRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pendingAction !== null}
            aria-label={`Ações da tarefa: ${task.title}`}
            className="size-8 rounded-lg text-text-muted opacity-70 transition-[background-color,opacity,color] hover:bg-hover hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:bg-hover data-[state=open]:text-foreground data-[state=open]:opacity-100"
            onClick={(event) => event.stopPropagation()}
          >
            <Ellipsis aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="w-[228px] rounded-[11px] border border-border-soft bg-popover p-1.5 text-[13px] shadow-[0_8px_24px_rgba(15,23,42,0.10)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)]" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem className="h-[38px] gap-2.5 px-3 text-[13px] font-medium focus:bg-hover focus:text-foreground" onSelect={() => onOpen(task, menuTriggerRef.current)}>
            <FileText aria-hidden="true" className="size-4" /> Abrir detalhes
          </DropdownMenuItem>
          {!archived && (
            <DropdownMenuItem className="h-[38px] gap-2.5 px-3 text-[13px] font-medium focus:bg-hover focus:text-foreground" onSelect={() => onOpen(task, menuTriggerRef.current)}>
              <Pencil aria-hidden="true" className="size-4" /> Renomear
            </DropdownMenuItem>
          )}
          {!archived && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-[38px] gap-2.5 px-3 text-[13px] font-medium focus:bg-hover focus:text-foreground data-open:bg-hover data-open:text-foreground">
                <FolderInput aria-hidden="true" className="size-4" /> Mover para
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent sideOffset={6} alignOffset={-4} className="w-64 rounded-[11px] border border-border-soft bg-popover p-1.5 text-[13px] shadow-[0_8px_24px_rgba(15,23,42,0.10)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
                  <Command className="h-auto min-w-0 rounded-lg! bg-popover p-0 text-[13px]">
                    <CommandInput aria-label="Buscar projeto" placeholder="Buscar projeto..." className="text-[13px]" />
                    <CommandList className="max-h-64">
                      <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="sem projeto" onSelect={() => void moveTo("")} className="h-[38px] gap-2.5 px-3 text-[13px] font-medium">
                          <FolderInput aria-hidden="true" className="size-4 text-text-muted" />
                          <span>Sem projeto</span>
                          {task.project_id === null && <Check aria-hidden="true" className="ml-auto size-4 text-primary" />}
                        </CommandItem>
                        {projects.map((project) => (
                          <CommandItem key={project.id} value={project.name} onSelect={() => void moveTo(project.id)} className="h-[38px] gap-2.5 px-3 text-[13px] font-medium">
                            <FolderInput aria-hidden="true" className="size-4 text-primary" />
                            <span className="min-w-0 truncate">{project.name}</span>
                            {task.project_id === project.id && <Check aria-hidden="true" className="ml-auto size-4 shrink-0 text-primary" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}
          {!archived && (
            <DropdownMenuItem disabled={pendingAction !== null} className="h-[38px] gap-2.5 px-3 text-[13px] font-medium focus:bg-hover focus:text-foreground" onSelect={() => { void runAction("duplicate"); }}>
              <Copy aria-hidden="true" className="size-4" /> Duplicar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {archived ? (
            <DropdownMenuItem disabled={pendingAction !== null} className="h-[38px] gap-2.5 px-3 text-[13px] font-medium focus:bg-hover focus:text-foreground" onSelect={() => { void runAction("restore"); }}>
              <RotateCcw aria-hidden="true" className="size-4" /> Restaurar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pendingAction !== null} className="h-[38px] gap-2.5 px-3 text-[13px] font-medium focus:bg-hover focus:text-foreground" onSelect={() => { void runAction("archive"); }}>
              <Archive aria-hidden="true" className="size-4" /> Arquivar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={pendingAction !== null} className="h-[38px] gap-2.5 px-3 text-[13px] font-medium" onSelect={() => { setDeleteError(""); setDeleteOpen(true); }}>
            <Trash2 aria-hidden="true" className="size-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (pendingAction !== "delete") setDeleteOpen(open); }}>
        <AlertDialogContent onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (menuTriggerRef.current?.isConnected) menuTriggerRef.current.focus({ preventScroll: true });
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>“{task.title}” será removida permanentemente deste workspace, incluindo checklist, etiquetas e atividade vinculados. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button type="button" variant="outline" disabled={pendingAction === "delete"}>Cancelar</Button></AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pendingAction === "delete"} onClick={() => { void runAction("delete"); }}>
              {pendingAction === "delete" ? "Excluindo..." : "Excluir tarefa"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
