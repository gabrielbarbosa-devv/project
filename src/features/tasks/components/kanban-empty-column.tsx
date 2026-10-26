import { Columns2 } from "lucide-react";
import type { KanbanColumn } from "@/features/tasks/data/presentation";

type Props = {
  column: KanbanColumn;
  filtersActive: boolean;
  welcome?: boolean;
  announce?: boolean;
};

/** A quiet, data-driven empty state inside a loaded Kanban column. */
export function KanbanEmptyColumn({ column, filtersActive, welcome = false, announce = true }: Props) {
  if (column.tasks.length > 0) return null;

  return (
    <div role={announce ? "status" : undefined} aria-hidden={announce ? undefined : true} className="flex w-full flex-col items-center px-2 pt-7 text-center">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-selection-soft text-primary">
        <Columns2 className="size-6" />
      </span>
      <p className="mt-3 max-w-[230px] text-[13px] font-semibold leading-[18px] text-foreground">
        {welcome ? "Seu quadro começa aqui" : filtersActive ? "Nenhuma tarefa corresponde aos filtros." : "Nenhuma tarefa nesta etapa"}
      </p>
      <p className="mt-1.5 max-w-[230px] text-xs leading-[18px] text-text-gray">
        {welcome
          ? "Crie sua primeira tarefa para começar."
          : filtersActive
          ? "Ajuste a busca ou os filtros para ver tarefas nesta etapa."
          : "Não há tarefas nesta etapa."}
      </p>
    </div>
  );
}
