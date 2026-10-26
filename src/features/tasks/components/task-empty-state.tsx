"use client";

import { Archive, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TaskEmptyState({ archived, filtered, onCreate, onClear }: { archived: boolean; filtered: boolean; onCreate: () => void; onClear: () => void }) {
  return (
    <div className="grid justify-items-center px-5 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-selected text-primary">
        {archived ? <Archive aria-hidden="true" className="size-5" /> : <ClipboardList aria-hidden="true" className="size-5" />}
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">{archived ? "Nenhuma tarefa arquivada" : filtered ? "Nenhuma tarefa encontrada" : "Você ainda não tem tarefas"}</h2>
      <p className="mt-1 max-w-sm text-sm leading-5 text-text-gray">
        {archived ? "As tarefas que você arquivar poderão ser restauradas nesta lista." : filtered ? "Tente outro termo ou remova os filtros aplicados." : "Crie sua primeira tarefa para organizar o que precisa ser feito hoje."}
      </p>
      {!archived && filtered && <Button type="button" variant="outline" onClick={onClear} className="mt-5 h-10 rounded-lg">Limpar filtros</Button>}
      {!archived && !filtered && <Button type="button" onClick={onCreate} className="mt-5 h-10 rounded-lg bg-primary px-4 text-primary-foreground hover:bg-primary-dark">Criar minha primeira tarefa</Button>}
    </div>
  );
}
