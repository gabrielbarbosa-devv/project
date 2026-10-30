"use client";

import { Fragment, useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ArrowDownUp, Columns3, Filter, Flag, List, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Project, TaskFilters, TaskLabel, TaskSort } from "@/features/tasks/data/queries";
import { hasActiveTaskFilters } from "@/features/tasks/data/task-filtering";

const priorityOptions = [
  { value: "high", label: "Alta", color: "text-priority-high" },
  { value: "medium", label: "Média", color: "text-priority-medium" },
  { value: "low", label: "Baixa", color: "text-priority-low" },
] as const;

const statusOptions = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluída" },
  { value: "paused", label: "Pausada" },
] as const;

const dueOptions = [
  { value: "all", label: "Todos os prazos" },
  { value: "overdue", label: "Vencidas" },
  { value: "today", label: "Vencem hoje" },
  { value: "next7", label: "Próximos 7 dias" },
  { value: "none", label: "Sem prazo" },
] as const;

const sortOptions: Array<{ value: TaskSort; label: string }> = [
  { value: "manual", label: "Ordem manual" },
  { value: "priority_high", label: "Prioridade · Alta primeiro" },
  { value: "priority_low", label: "Prioridade · Baixa primeiro" },
  { value: "due_soon", label: "Prazo · Mais próximo primeiro" },
  { value: "due_far", label: "Prazo · Mais distante primeiro" },
  { value: "planned_recent", label: "Data planejada · Mais recente" },
  { value: "planned_oldest", label: "Data planejada · Mais antiga" },
  { value: "created_recent", label: "Criação · Mais recentes" },
  { value: "created_oldest", label: "Criação · Mais antigas" },
  { value: "title_asc", label: "Título · A–Z" },
  { value: "title_desc", label: "Título · Z–A" },
];

type ParamValue = string | string[] | null;

export function TaskToolbar({ projects, labels, filters, view }: { projects: Project[]; labels: TaskLabel[]; filters: TaskFilters; view: "list" | "kanban" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const query = searchDraft;
  const [labelQuery, setLabelQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchParamString = searchParams.toString();

  useEffect(() => {
    const nextQuery = query.trim().slice(0, 120);
    if (nextQuery === filters.q) return;
    const timeout = window.setTimeout(() => updateParams({ q: nextQuery || null }, "replace"), 300);
    return () => window.clearTimeout(timeout);
    // searchParamString ensures a pending debounce is rebuilt from the latest URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.q, searchParamString]);

  function updateParams(changes: Record<string, ParamValue>, mode: "push" | "replace" = "push") {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      params.delete(key);
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else if (value) params.set(key, value);
    }
    const suffix = params.size ? `?${params.toString()}` : "";
    startTransition(() => {
      if (mode === "replace") router.replace(`${pathname}${suffix}`, { scroll: false });
      else router.push(`${pathname}${suffix}`, { scroll: false });
    });
  }

  function toggleMulti(key: "priority" | "status" | "label", current: string[], value: string) {
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    updateParams({ [key]: next, ...(key === "status" ? { state: null } : {}) });
  }

  function clearFilters() {
    updateParams({ q: null, project: null, priority: null, status: null, state: null, archived: null, due: null, label: null });
    setQuery("");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParams({ q: query.trim().slice(0, 120) || null });
  }

  function setQuery(value: string) {
    setSearchDraft(value);
  }

  const activeCount = Number(Boolean(filters.q)) + Number(Boolean(filters.project))
    + filters.priorities.length + filters.statuses.length + Number(filters.archived)
    + Number(Boolean(filters.due)) + filters.labelIds.length;
  const active = hasActiveTaskFilters(filters);
  const projectName = filters.project === "none" ? "Sem projeto" : projects.find((project) => project.id === filters.project)?.name ?? "Projeto";
  const selectedLabels = filters.labelIds.map((id) => labels.find((label) => label.id === id)?.name ?? "Etiqueta indisponível");

  return (
    <div className="grid gap-2" aria-busy={isPending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Visualização das tarefas" className="flex h-10 shrink-0 items-center rounded-[9px] border border-border bg-card p-1">
          <Button type="button" variant="ghost" aria-pressed={view === "list"} onClick={() => updateParams({ view: null })} className={cn("h-8 gap-2 rounded-[7px] px-3 text-[13px] font-medium text-text-secondary", view === "list" && "border border-primary bg-selection-soft font-semibold text-primary hover:bg-selection-soft hover:text-primary")}>
            <List aria-hidden="true" className="size-4" /> Lista
          </Button>
          <Button type="button" variant="ghost" aria-pressed={view === "kanban"} onClick={() => updateParams({ view: "kanban" })} className={cn("h-8 gap-2 rounded-[7px] px-3 text-[13px] font-medium text-text-secondary", view === "kanban" && "border border-primary bg-selection-soft font-semibold text-primary hover:bg-selection-soft hover:text-primary")}>
            <Columns3 aria-hidden="true" className="size-4" /> Kanban
          </Button>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <form onSubmit={submitSearch} role="search" className="flex h-10 min-w-[190px] flex-1 items-center gap-2 rounded-[9px] border border-border bg-card px-3 sm:w-[210px] sm:flex-none">
            <Search aria-hidden="true" className="size-4 shrink-0 text-text-faint" />
            <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar tarefas por título ou descrição" placeholder="Buscar tarefa..." className="h-9 min-w-0 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0" />
            {query && <button type="button" aria-label="Limpar busca" onClick={() => { setQuery(""); updateParams({ q: null }); }} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-faint hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><X aria-hidden="true" className="size-4" /></button>}
            <button type="submit" className="sr-only">Buscar</button>
          </form>

          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              type="button"
              data-variant="outline"
              data-size="default"
              aria-label={activeCount ? `Filtrar tarefas, ${activeCount} filtros ativos` : "Filtrar tarefas"}
              className={cn(buttonVariants({
                variant: "outline",
                className: "h-10 w-auto min-w-[100px] gap-2 rounded-[9px] border-border bg-card px-3 text-[13px] text-text-secondary hover:bg-muted",
              }))}
            >
              <Filter aria-hidden="true" className="size-4" /><span>Filtrar</span>
              {activeCount > 0 && <span aria-hidden="true" className="inline-flex size-5 items-center justify-center rounded-full bg-selection-soft text-[11px] font-semibold text-primary">{activeCount}</span>}
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="max-h-[min(78vh,680px)] w-[min(320px,calc(100vw-2rem))] gap-3 overflow-y-auto rounded-xl border border-border bg-popover p-4 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Filtrar tarefas</h2>
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters} disabled={!active} className="h-8 px-2 text-xs text-text-secondary">Limpar</Button>
              </div>

              <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-xs font-semibold text-text-secondary">Prioridade</legend>
                {priorityOptions.map((item) => <FilterCheckbox key={item.value} checked={filters.priorities.includes(item.value)} onCheckedChange={() => toggleMulti("priority", filters.priorities, item.value)}>
                  <Flag aria-hidden="true" className={`size-4 ${item.color}`} fill="currentColor" strokeWidth={1.5} />{item.label}
                </FilterCheckbox>)}
              </fieldset>

              <fieldset className="grid gap-1.5 border-t border-border-soft pt-3">
                <legend className="mb-1 text-xs font-semibold text-text-secondary">Status</legend>
                {statusOptions.map((item) => <FilterCheckbox key={item.value} checked={filters.statuses.includes(item.value)} onCheckedChange={() => toggleMulti("status", filters.statuses, item.value)}>
                  {item.label}
                </FilterCheckbox>)}
                <FilterCheckbox checked={filters.archived} onCheckedChange={(checked) => updateParams({ archived: checked ? "true" : null, state: null })}>
                  <Archive aria-hidden="true" className="size-4 text-text-faint" />Arquivadas
                </FilterCheckbox>
              </fieldset>

              <div className="grid gap-1.5 border-t border-border-soft pt-3">
                <label htmlFor="task-due-filter" className="text-xs font-semibold text-text-secondary">Prazo final</label>
                <Select value={filters.due || "all"} onValueChange={(value) => updateParams({ due: value === "all" ? null : value })}>
                  <SelectTrigger id="task-due-filter" className="h-9 border-border bg-card text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent align="start">
                    {dueOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5 border-t border-border-soft pt-3">
                <p className="text-xs font-semibold text-text-secondary">Etiquetas <span className="font-normal text-text-faint">(qualquer uma)</span></p>
                {labels.length ? <Command className="h-auto rounded-lg border border-border bg-card p-0" shouldFilter>
                  <CommandInput value={labelQuery} onValueChange={setLabelQuery} placeholder="Buscar etiqueta..." className="text-[13px]" />
                  <CommandList className="max-h-36">
                    <CommandEmpty>Nenhuma etiqueta encontrada.</CommandEmpty>
                    <CommandGroup>
                      {labels.map((label) => {
                        const checked = filters.labelIds.includes(label.id);
                        return <CommandItem key={label.id} value={label.name} onSelect={() => toggleMulti("label", filters.labelIds, label.id)} aria-label={`${label.name}, ${checked ? "selecionada" : "não selecionada"}`} className="cursor-pointer text-[13px]">
                          <Checkbox checked={checked} aria-hidden="true" tabIndex={-1} className="pointer-events-none" />
                          <span className="min-w-0 truncate">{label.name}</span>
                        </CommandItem>;
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command> : <p className="rounded-md border border-dashed border-border-soft px-3 py-2 text-xs text-text-faint">Nenhuma etiqueta cadastrada.</p>}
              </div>

              <p className="sr-only" role="status" aria-live="polite">{isPending ? "Atualizando tarefas" : "Filtros atualizados"}</p>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" aria-label={`Ordenar tarefas. Atual: ${sortOptions.find((item) => item.value === filters.sort)?.label ?? "Prazo"}`} className="h-10 w-[125px] gap-2 rounded-[9px] border-border bg-card px-3 text-[13px] text-text-secondary hover:bg-muted"><ArrowDownUp aria-hidden="true" className="size-4" /><span>Ordenar</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[min(75vh,520px)] w-[min(300px,calc(100vw-2rem))] overflow-y-auto border-border bg-popover">
              <DropdownMenuLabel>Organização</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={filters.sort} onValueChange={(value) => updateParams({ sort: value })}>
                {sortOptions.map((item, index) => <Fragment key={item.value}>
                  {index === 1 || index === 3 || index === 5 || index === 7 || index === 9 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuRadioItem value={item.value} className="text-[13px]">{item.label}</DropdownMenuRadioItem>
                </Fragment>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={filters.project || "all"} onValueChange={(value) => updateParams({ project: value === "all" ? null : value })}>
            <SelectTrigger aria-label="Filtrar por projeto" className="h-10 w-[180px] rounded-[9px] border-border bg-card text-[13px] text-text-secondary">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              <SelectItem value="none">Sem projeto</SelectItem>
              {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {active && <div className="flex min-h-7 flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
        {filters.q && <FilterChip label={`Busca: ${filters.q}`} onRemove={() => { setQuery(""); updateParams({ q: null }); }} />}
        {filters.project && <FilterChip label={`Projeto: ${projectName}`} onRemove={() => updateParams({ project: null })} />}
        {filters.priorities.map((value) => <FilterChip key={value} label={`Prioridade: ${priorityOptions.find((item) => item.value === value)?.label ?? value}`} onRemove={() => toggleMulti("priority", filters.priorities, value)} />)}
        {filters.statuses.map((value) => <FilterChip key={value} label={`Status: ${statusOptions.find((item) => item.value === value)?.label ?? value}`} onRemove={() => toggleMulti("status", filters.statuses, value)} />)}
        {filters.archived && <FilterChip label="Status: Arquivadas" onRemove={() => updateParams({ archived: null, state: null })} />}
        {filters.due && <FilterChip label={`Prazo: ${dueOptions.find((item) => item.value === filters.due)?.label ?? filters.due}`} onRemove={() => updateParams({ due: null })} />}
        {filters.labelIds.map((id, index) => <FilterChip key={id} label={`Etiqueta: ${selectedLabels[index]}`} onRemove={() => toggleMulti("label", filters.labelIds, id)} />)}
        <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs text-text-secondary">Limpar tudo</Button>
      </div>}
    </div>
  );
}

function FilterCheckbox({ checked, onCheckedChange, children }: { checked: boolean; onCheckedChange: (checked: boolean) => void; children: ReactNode }) {
  return <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] text-foreground hover:bg-muted focus-within:bg-muted">
    <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} aria-label={typeof children === "string" ? children : undefined} />
    <span className="flex min-w-0 items-center gap-2">{children}</span>
  </label>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <Badge asChild variant="outline" className="h-7 max-w-[min(100%,340px)] gap-1 border-border-soft bg-muted px-2 text-[11px] font-medium text-text-secondary">
    <button type="button" aria-label={`Remover filtro ${label}`} onClick={onRemove} className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
      <span className="truncate">{label}</span><X aria-hidden="true" className="size-3 shrink-0 text-text-faint" />
    </button>
  </Badge>;
}
