"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskEditorForm, type TaskSaveContext } from "@/features/tasks/components/task-editor-form";
import type { Project, Task, TaskLabel } from "@/features/tasks/data/queries";

export function TaskCreateDialog({ open, onOpenChange, projects, labels, today, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  labels: TaskLabel[];
  today: string;
  onSaved: (task: Task, context: TaskSaveContext) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    // Keep the editor mounted while an in-flight save resolves. On success the
    // parent closes it directly through its controlled `open` state.
    if (!nextOpen && submitting) return;
    onOpenChange(nextOpen);
  }

  return (
    <>
      <Button type="button" onClick={() => onOpenChange(true)} className="h-11 gap-2 rounded-[10px] bg-primary px-[18px] text-[14px] text-primary-foreground hover:bg-primary-dark">
        <Plus aria-hidden="true" className="size-[18px]" /> Nova tarefa
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-[680px] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl sm:w-[calc(100vw-2rem)]">
          <DialogHeader className="shrink-0 border-b border-border-soft px-7 pb-5 pt-7">
            <DialogTitle className="text-[23px] font-semibold tracking-tight">Nova tarefa</DialogTitle>
            <DialogDescription>Organize o que precisa ser feito, sem complicar.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-5">
            <TaskEditorForm projects={projects} labels={labels} today={today} onCancel={() => onOpenChange(false)} onSaved={(task, context) => { if (task && context) onSaved(task, context); }} onPendingChange={setSubmitting} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
