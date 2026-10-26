"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { summarizeKanbanLabels } from "@/features/tasks/data/kanban-presentation";
import { taskLabelTone } from "@/features/tasks/data/task-label-presentation";
import type { TaskLabel } from "@/features/tasks/data/queries";

type Props = {
  labels: TaskLabel[];
  visibleLimit?: number;
};

/** Compact, accessible summary of the real labels assigned to a Kanban task. */
export function TaskLabelBadges({ labels, visibleLimit = 2 }: Props) {
  if (labels.length === 0) return null;

  const summary = summarizeKanbanLabels(labels, visibleLimit);
  const hiddenLabels = labels.slice(summary.visible.length);
  const hiddenNames = hiddenLabels.map((label) => label.name);
  const hiddenLabelDescription = summary.hiddenCount === 1 ? "1 etiqueta adicional" : `${summary.hiddenCount} etiquetas adicionais`;

  return (
    <>
      {summary.visible.map((label) => (
        <Badge
          key={label.id}
          variant="outline"
          className={`h-auto min-h-5 min-w-0 max-w-full shrink-0 whitespace-normal break-words rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-3 [overflow-wrap:anywhere] ${taskLabelTone[label.color] ?? taskLabelTone.violet}`}
        >
          {label.name}
        </Badge>
      ))}
      {summary.hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${hiddenLabelDescription}: ${hiddenNames.join(", ")}`}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-5 shrink-0 items-center rounded-md border border-border-soft bg-surface-soft px-1.5 text-[10px] font-medium text-text-secondary outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              +{summary.hiddenCount}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] whitespace-normal text-center">
            {hiddenNames.join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
