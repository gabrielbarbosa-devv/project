import { Search } from "lucide-react";

export function SearchCommandInput() {
  return (
    <label className="hidden h-10 w-[min(320px,34vw)] items-center gap-3 rounded-xl border border-border-soft bg-card px-3 text-text-muted focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 sm:flex">
      <Search aria-hidden="true" className="size-[18px] shrink-0" />
      <input
        type="search"
        aria-label="Buscar tarefas, projetos e conteúdos"
        placeholder="Buscar tarefas, projetos, conteúdos..."
        className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-text-soft"
      />
      <kbd className="hidden shrink-0 rounded-md border border-border-soft bg-surface-soft px-1.5 py-0.5 text-[11px] text-text-soft lg:inline-flex">⌘K</kbd>
    </label>
  );
}
