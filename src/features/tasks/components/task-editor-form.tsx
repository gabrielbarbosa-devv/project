"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Flag,
  Folder,
  LoaderCircle,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SheetFooter } from "@/components/ui/sheet";
import { createTask, updateTask } from "@/features/tasks/actions/tasks";
import { taskFormSchema, type TaskFormValues } from "@/features/tasks/schemas/task.schema";
import { taskLabelTone } from "@/features/tasks/data/task-label-presentation";
import type { Project, Task, TaskLabel, TaskStatus } from "@/features/tasks/data/queries";

type Props = {
  task?: Task | null;
  projects: Project[];
  labels?: TaskLabel[];
  assignedLabelIds?: string[];
  today: string;
  onCancel: () => void;
  onSaved: (task?: Task, context?: TaskSaveContext) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
  onDelete?: () => void;
  children?: ReactNode;
};

export type TaskSaveContext = { labelIds: string[]; createdNewLabels: boolean };

const priorities = [
  { value: "high", label: "Alta", color: "text-priority-high" },
  { value: "medium", label: "Média", color: "text-priority-medium" },
  { value: "low", label: "Baixa", color: "text-priority-low" },
] as const;

function initialValues(task?: Task | null, today?: string): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    projectId: task?.project_id ?? "",
    plannedFor: task?.planned_for ?? (task ? "" : today ?? ""),
    startTime: task?.start_time?.slice(0, 5) ?? "",
    dueOn: task?.due_on ?? "",
    priority: (task?.priority as TaskFormValues["priority"]) ?? "medium",
  };
}

function dateFromCivil(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function civilDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(value: string, days: number) {
  const date = dateFromCivil(value);
  date.setDate(date.getDate() + days);
  return civilDate(date);
}

function displayDate(value: string) {
  return format(dateFromCivil(value), "d MMM yyyy", { locale: ptBR });
}

export function TaskEditorForm({ task, projects, labels = [], assignedLabelIds = [], today, onCancel, onSaved, onDirtyChange, onPendingChange, onDelete, children }: Props) {
  const [values, setValues] = useState<TaskFormValues>(() => initialValues(task, today));
  const [status, setStatus] = useState<TaskStatus>((task?.status as TaskStatus | undefined) ?? "pending");
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(assignedLabelIds);
  const [newLabelNames, setNewLabelNames] = useState<string[]>([]);
  const [labelSearch, setLabelSearch] = useState("");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const [baseline, setBaseline] = useState(() => ({
    values: initialValues(task, today),
    status: (task?.status as TaskStatus | undefined) ?? "pending",
    labelIds: [...assignedLabelIds].sort(),
    newLabelNames: [] as string[],
  }));
  const selectedLabels = useMemo(
    () => labels.filter((label) => selectedLabelIds.includes(label.id)),
    [labels, selectedLabelIds],
  );
  const normalizedLabelSearch = labelSearch.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  const existingMatch = labels.find((label) => label.name_key === normalizedLabelSearch);
  const canCreateLabel = normalizedLabelSearch.length >= 2 && normalizedLabelSearch.length <= 40 && !existingMatch;
  const dueBeforePlan = values.plannedFor && values.dueOn && values.dueOn < values.plannedFor;
  const dirty = JSON.stringify({ values, status, labelIds: [...selectedLabelIds].sort(), newLabelNames }) !== JSON.stringify(baseline);

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => onPendingChange?.(pending), [pending, onPendingChange]);

  function update<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function toggleLabel(labelId: string) {
    setSelectedLabelIds((current) => current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]);
  }

  function addNewLabel() {
    const cleanName = labelSearch.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || cleanName.length > 40) return;
    if (existingMatch) {
      if (!selectedLabelIds.includes(existingMatch.id)) toggleLabel(existingMatch.id);
    } else if (!newLabelNames.some((name) => name.toLocaleLowerCase("pt-BR") === cleanName.toLocaleLowerCase("pt-BR"))) {
      setNewLabelNames((current) => [...current, cleanName]);
    }
    setLabelSearch("");
    setLabelsOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setServerError("");
    const parsed = taskFormSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        nextErrors[key] ??= issue.message;
      });
      setErrors(nextErrors);
      return;
    }

    startTransition(async () => {
      try {
        const result = task
          ? await updateTask({ ...parsed.data, id: task.id, status, labelIds: selectedLabelIds, newLabelNames })
          : await createTask({
              ...parsed.data,
              requestId: requestId.current ?? (requestId.current = crypto.randomUUID()),
              labelIds: selectedLabelIds,
              newLabelNames,
            });
        if (result.error || !result.task) {
          setServerError(result.error ?? "Não foi possível salvar a tarefa.");
          return;
        }
        setValues(parsed.data);
        setBaseline({
          values: parsed.data,
          status,
          labelIds: [...selectedLabelIds].sort(),
          newLabelNames: [...newLabelNames],
        });
        if (task) toast.success("Tarefa atualizada.");
        onSaved(result.task, { labelIds: [...selectedLabelIds], createdNewLabels: newLabelNames.length > 0 });
      } catch {
        setServerError("Não foi possível salvar a tarefa. Verifique sua conexão e tente novamente.");
      }
    });
  }

  const footerContent = <>
    <div className="flex shrink-0 items-center">
      {task && onDelete && <Button type="button" variant="ghost" className="h-10 shrink-0 gap-2 whitespace-nowrap rounded-[10px] px-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} disabled={pending}><Trash2 aria-hidden="true" className="size-4" />Excluir</Button>}
    </div>
    <div className="ml-auto flex shrink-0 items-center justify-end gap-2 max-sm:ml-0 max-sm:w-full">
      <Button type="button" variant="outline" className="h-10 shrink-0 whitespace-nowrap rounded-[10px] border-border px-3 sm:px-4" onClick={onCancel} disabled={pending}>Cancelar</Button>
      <Button type="submit" disabled={pending} className="h-10 shrink-0 whitespace-nowrap rounded-[10px] bg-primary px-3 text-primary-foreground hover:bg-primary-dark sm:px-4">
        {pending ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Salvando...</> : <><Check aria-hidden="true" className="size-4" /> {task ? "Salvar alterações" : "Criar tarefa"}</>}
      </Button>
    </div>
  </>;
  const footerClass = `sticky bottom-0 ${task ? "-mx-6 px-6" : "-mx-7 px-7"} mt-1 flex flex-row items-center justify-between gap-3 border-t border-border-soft bg-card/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/85 max-sm:flex-col max-sm:items-stretch`;

  return (
    <form className={`grid min-h-0 gap-5 ${task ? "amora-task-details-form px-6 pb-0" : "px-7 pb-0"}`} onSubmit={submit} noValidate>
      {task && <Field className="gap-1.5">
        <FieldLabel htmlFor="task-status" className="text-xs font-medium text-text-soft">Status</FieldLabel>
        <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
          <SelectTrigger id="task-status" data-task-control="status" className="h-10 w-fit min-w-36 rounded-[10px] border-input-border bg-background px-3 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
          </SelectContent>
        </Select>
      </Field>}
      <Field>
        <FieldLabel htmlFor="task-title" className={task ? "sr-only" : "text-sm font-medium"}>Título</FieldLabel>
        <Input id="task-title" autoFocus value={values.title} maxLength={160} aria-invalid={!!errors.title} aria-describedby={errors.title ? "task-title-error" : undefined} onChange={(event) => update("title", event.target.value)} placeholder="O que precisa ser feito?" className={task ? "h-auto min-h-10 rounded-md border-transparent bg-transparent px-0 py-1 text-[22px] font-semibold leading-7 tracking-tight shadow-none focus-visible:border-ring" : "h-12 rounded-[10px] border-input-border bg-background px-3.5 text-[15px]"} />
        {errors.title && <FieldError id="task-title-error">{errors.title}</FieldError>}
      </Field>

      {!task && <DescriptionField values={values} errors={errors} update={update} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="task-project" className={task ? "text-xs font-medium" : "text-sm font-medium"}>Projeto</FieldLabel>
          <Popover open={projectOpen} onOpenChange={(open) => { setProjectOpen(open); if (!open) setProjectSearch(""); }}>
            <PopoverTrigger asChild>
              <Button id="task-project" data-task-control="project" type="button" variant="outline" role="combobox" aria-expanded={projectOpen} className={`${task ? "h-10 text-sm" : "h-12 text-[15px]"} w-full justify-between rounded-[10px] border-input-border bg-background px-3 font-normal`}>
                <span className="flex min-w-0 items-center gap-2 truncate"><Folder aria-hidden="true" className="size-4 shrink-0 text-primary" />{projects.find((project) => project.id === values.projectId)?.name ?? "Sem projeto"}</span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput value={projectSearch} onValueChange={setProjectSearch} placeholder="Buscar projetos..." />
                <CommandList>
                  <CommandEmpty>{projects.length ? "Nenhum projeto encontrado." : "Este workspace ainda não tem projetos."}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="sem projeto" onSelect={() => { update("projectId", ""); setProjectOpen(false); }}>
                      <Folder aria-hidden="true" className="size-4 text-text-muted" />Sem projeto{!values.projectId && <Check aria-hidden="true" className="ml-auto size-4" />}
                    </CommandItem>
                    {projects.map((project) => (
                      <CommandItem key={project.id} value={project.name} onSelect={() => { update("projectId", project.id); setProjectOpen(false); }}>
                        <Folder aria-hidden="true" className="size-4 text-primary" />{project.name}{values.projectId === project.id && <Check aria-hidden="true" className="ml-auto size-4" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel htmlFor="task-priority" className={task ? "text-xs font-medium" : "text-sm font-medium"}>Prioridade</FieldLabel>
          <Select value={values.priority} onValueChange={(value) => update("priority", value as TaskFormValues["priority"])}>
            <SelectTrigger id="task-priority" data-task-control="priority" className={`${task ? "h-10 text-sm" : "h-12 text-[15px]"} rounded-[10px] border-input-border bg-background px-3`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {priorities.map((priority) => <SelectItem key={priority.value} value={priority.value}><span className="inline-flex items-center gap-2"><Flag aria-hidden="true" className={`size-4 ${priority.color}`} fill="currentColor" />{priority.label}</span></SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
        <DatePickerField id="task-planned-for" label="Planejado para" value={values.plannedFor} today={today} error={errors.plannedFor} compact={Boolean(task)} onChange={(value) => update("plannedFor", value)} />
        <Field>
          <FieldLabel htmlFor="task-start-time" className={task ? "text-xs font-medium" : "text-sm font-medium"}>Horário</FieldLabel>
          <div className="relative">
            <Clock3 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <Input id="task-start-time" data-task-control="time" type="time" value={values.startTime} aria-invalid={!!errors.startTime} aria-describedby={errors.startTime ? "task-start-time-error" : undefined} onChange={(event) => update("startTime", event.target.value)} className={`${task ? "h-10 text-sm" : "h-12 text-[15px]"} rounded-[10px] border-input-border bg-background pl-9 pr-2`} />
          </div>
          {errors.startTime && <FieldError id="task-start-time-error">{errors.startTime}</FieldError>}
        </Field>
        <DatePickerField id="task-due-on" label="Prazo final" value={values.dueOn} today={today} error={errors.dueOn} compact={Boolean(task)} onChange={(value) => update("dueOn", value)} />
      </div>
      {dueBeforePlan && <p role="status" className="-mt-2 text-xs text-text-gray">O prazo está antes da data planejada. Confira se as datas estão corretas.</p>}

      <Field>
        <FieldLabel htmlFor="task-label-picker" className={task ? "text-xs font-medium" : "text-sm font-medium"}>Etiquetas</FieldLabel>
        <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
          <div data-task-control={task ? "labels" : undefined} className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-[10px] border border-input-border bg-background px-2.5 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            {selectedLabels.map((label) => <Badge key={label.id} variant="outline" className={`h-7 gap-1 rounded-full px-2.5 text-xs font-medium ${taskLabelTone[label.color] ?? taskLabelTone.violet}`}>
              {label.name}
              <button type="button" aria-label={`Remover etiqueta ${label.name}`} className="inline-grid size-7 place-items-center rounded-full hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => toggleLabel(label.id)}><X aria-hidden="true" className="size-3.5" /></button>
            </Badge>)}
            {newLabelNames.map((name) => <Badge key={name} variant="outline" className="h-6 gap-1 rounded-full border-primary/20 bg-primary/10 px-2 text-[11px] font-medium text-primary">
              {name}<button type="button" aria-label={`Remover etiqueta ${name}`} className="inline-grid size-7 place-items-center rounded-full hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setNewLabelNames((current) => current.filter((item) => item !== name))}><X aria-hidden="true" className="size-3.5" /></button>
            </Badge>)}
            <PopoverTrigger asChild>
              <Button id="task-label-picker" type="button" variant="ghost" role="combobox" aria-label="Selecionar etiquetas" aria-expanded={labelsOpen} className="h-7 min-w-20 justify-start gap-1.5 rounded-md px-1.5 text-xs font-normal text-text-soft hover:text-foreground">
                {selectedLabelIds.length === 0 && newLabelNames.length === 0 ? <><Tag aria-hidden="true" className="size-3.5" />Adicionar etiqueta</> : <><Plus aria-hidden="true" className="size-3.5" />Adicionar</>}
                <ChevronDown aria-hidden="true" className="ml-auto size-3.5 text-text-muted" />
              </Button>
            </PopoverTrigger>
          </div>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command shouldFilter>
              <CommandInput value={labelSearch} onValueChange={setLabelSearch} placeholder="Buscar ou criar etiqueta..." />
              <CommandList>
                <CommandEmpty>{labels.length === 0 ? "Nenhuma etiqueta neste workspace." : "Nenhuma etiqueta encontrada."}</CommandEmpty>
                {canCreateLabel && <CommandGroup heading="Criar etiqueta">
                  <CommandItem value={`criar ${labelSearch}`} onSelect={addNewLabel}><Plus aria-hidden="true" className="size-4" />Criar “{labelSearch.trim()}”</CommandItem>
                </CommandGroup>}
                {existingMatch && !selectedLabelIds.includes(existingMatch.id) && <CommandGroup heading="Correspondência">
                  <CommandItem value={existingMatch.name} onSelect={() => { toggleLabel(existingMatch.id); setLabelSearch(""); setLabelsOpen(false); }}><Tag aria-hidden="true" className="size-4" />Selecionar {existingMatch.name}</CommandItem>
                </CommandGroup>}
                <CommandGroup heading="Etiquetas do workspace">
                  {labels.map((label) => {
                    const selected = selectedLabelIds.includes(label.id);
                    return <CommandItem key={label.id} value={label.name} onSelect={() => toggleLabel(label.id)}>
                      <span aria-hidden="true" className={`size-2 rounded-full ${taskLabelTone[label.color]?.split(" ")[2] ?? "bg-primary"}`} />
                      {label.name}{selected && <Check aria-hidden="true" className="ml-auto size-4" />}
                    </CommandItem>;
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {(newLabelNames.length > 0 || !task) && <p className="text-xs text-text-soft">Etiquetas novas são salvas junto com a tarefa.</p>}
      </Field>

      {task && <DescriptionField values={values} errors={errors} update={update} />}

      {children}

      {serverError && <p role="alert" className="rounded-lg border border-destructive-border-soft bg-destructive-surface px-3 py-2 text-sm text-destructive">{serverError}</p>}
      {task ? <SheetFooter className={footerClass}>{footerContent}</SheetFooter> : <div className={footerClass}>{footerContent}</div>}
    </form>
  );
}

function DescriptionField({ values, errors, update }: {
  values: TaskFormValues;
  errors: Record<string, string>;
  update: <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => void;
}) {
  return <Field>
    <FieldLabel htmlFor="task-description" className="text-sm font-medium">Descrição <span className="font-normal text-text-soft">(opcional)</span></FieldLabel>
    <Textarea id="task-description" value={values.description} maxLength={4000} aria-invalid={!!errors.description} aria-describedby={errors.description ? "task-description-error" : "task-description-hint"} onChange={(event) => update("description", event.target.value)} placeholder="Adicione detalhes, links, referências ou qualquer informação importante..." className="min-h-[90px] resize-y rounded-[10px] border-input-border bg-background px-3.5 py-3 text-[14px] leading-6" />
    {errors.description ? <FieldError id="task-description-error">{errors.description}</FieldError> : <p id="task-description-hint" className="text-right text-[11px] text-text-soft">{values.description.length}/4.000</p>}
  </Field>;
}

function DatePickerField({ id, label, value, today, error, compact = false, onChange }: {
  id: string;
  label: string;
  value: string;
  today: string;
  error?: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentDate = value ? dateFromCivil(value) : undefined;
  const referenceDate = value || today;

  function selectDate(date?: Date) {
    onChange(date ? civilDate(date) : "");
    setOpen(false);
  }

  return <Field>
    <FieldLabel htmlFor={id} className={compact ? "text-xs font-medium" : "text-sm font-medium"}>{label}</FieldLabel>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} data-task-control={compact ? "date" : undefined} type="button" variant="outline" aria-haspopup="dialog" aria-expanded={open} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className={`${compact ? "h-10 px-2 text-[12px]" : "h-12 px-3 text-[15px]"} w-full justify-start gap-1.5 rounded-[10px] border-input-border bg-background font-normal`}>
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
          <span className={value ? "truncate" : "truncate text-text-soft"}>{value ? displayDate(value) : "Selecionar data"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" sideOffset={6} className="w-auto max-w-[calc(100vw-2rem)] p-2.5">
        <Calendar mode="single" selected={currentDate} defaultMonth={currentDate ?? dateFromCivil(referenceDate)} onSelect={selectDate} locale={ptBR} autoFocus />
        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border-soft px-1 pt-2">
          <div className="flex flex-wrap gap-1">
            {[
              { label: "Hoje", days: 0 },
              { label: "Amanhã", days: 1 },
              { label: "Próxima semana", days: 7 },
            ].map((preset) => <Button key={preset.label} type="button" variant="ghost" className="h-7 rounded-md px-2 text-[11px] text-text-secondary" onClick={() => { onChange(addDays(referenceDate, preset.days)); setOpen(false); }}>{preset.label}</Button>)}
          </div>
          {value && <Button type="button" variant="ghost" className="h-7 rounded-md px-2 text-[11px] text-text-secondary" onClick={() => selectDate(undefined)}>Limpar</Button>}
        </div>
      </PopoverContent>
    </Popover>
    {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
  </Field>;
}
