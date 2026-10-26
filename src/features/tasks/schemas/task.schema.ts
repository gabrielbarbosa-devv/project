import { z } from "zod";

const dateField = z.string().refine(
  (value) => value === "" || z.iso.date().safeParse(value).success,
  "Informe uma data válida.",
);

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

const taskFormFieldsSchema = z.object({
  title: z.string().trim().min(1, "Informe o título da tarefa.").max(160, "Use até 160 caracteres."),
  description: z.string().max(4000, "Use até 4.000 caracteres."),
  projectId: z.union([z.literal(""), z.uuid()]),
  plannedFor: dateField,
  startTime: z.string().regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido."),
  dueOn: dateField,
  priority: taskPrioritySchema,
});

const withScheduleValidation = <T extends { plannedFor: string; startTime: string }>(schema: z.ZodType<T>) =>
  schema.superRefine((values, context) => {
    if (values.startTime && !values.plannedFor) {
      context.addIssue({ code: "custom", path: ["plannedFor"], message: "Escolha uma data planejada para usar um horário." });
    }
  });

export const taskFormSchema = withScheduleValidation(taskFormFieldsSchema);
export const createTaskSchema = withScheduleValidation(taskFormFieldsSchema.extend({
  requestId: z.uuid(),
  labelIds: z.array(z.uuid()).max(20),
  newLabelNames: z.array(z.string().trim().min(2, "Use pelo menos 2 caracteres.").max(40, "Use até 40 caracteres.")).max(20),
}).superRefine((values, context) => {
  if (new Set(values.labelIds).size !== values.labelIds.length) {
    context.addIssue({ code: "custom", path: ["labelIds"], message: "Remova etiquetas duplicadas." });
  }
  const normalizedNewLabels = values.newLabelNames.map((name) => name.replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"));
  if (new Set(normalizedNewLabels).size !== normalizedNewLabels.length) {
    context.addIssue({ code: "custom", path: ["newLabelNames"], message: "Cada etiqueta deve ter um nome único." });
  }
}));
export const updateTaskSchema = withScheduleValidation(taskFormFieldsSchema.extend({
  id: z.uuid(),
  status: z.enum(["pending", "completed"]),
  labelIds: z.array(z.uuid()).max(20),
  newLabelNames: z.array(z.string().trim().min(2, "Use pelo menos 2 caracteres.").max(40, "Use até 40 caracteres.")).max(20),
}).superRefine((values, context) => {
  if (new Set(values.labelIds).size !== values.labelIds.length) {
    context.addIssue({ code: "custom", path: ["labelIds"], message: "Remova etiquetas duplicadas." });
  }
  const normalizedNewLabels = values.newLabelNames.map((name) => name.replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"));
  if (new Set(normalizedNewLabels).size !== normalizedNewLabels.length) {
    context.addIssue({ code: "custom", path: ["newLabelNames"], message: "Cada etiqueta deve ter um nome único." });
  }
}));
export const taskIdSchema = z.object({ id: z.uuid() });
export const duplicateTaskSchema = z.object({ id: z.uuid(), requestId: z.uuid() }).refine(
  ({ id, requestId }) => id !== requestId,
  { path: ["requestId"], message: "A nova tarefa precisa de um identificador próprio." },
);
export const checklistItemIdSchema = z.object({ id: z.uuid() });
export const createChecklistItemSchema = z.object({
  taskId: z.uuid(),
  title: z.string().trim().min(1, "Informe o nome do item.").max(160, "Use até 160 caracteres."),
});
export const updateChecklistItemSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Informe o nome do item.").max(160, "Use até 160 caracteres.").optional(),
  isCompleted: z.boolean().optional(),
}).refine((value) => value.title !== undefined || value.isCompleted !== undefined, "Informe uma alteração para o item.");
export const taskCompletionSchema = z.object({ id: z.uuid(), completed: z.boolean() });
export const moveTaskSchema = z.object({ id: z.uuid(), projectId: z.union([z.literal(""), z.uuid()]) });
export const reorderTaskGroupSchema = z.object({
  groupKey: z.enum(["today", "overdue", "completed", "upcoming", "unscheduled", "other"]),
  taskIds: z.array(z.uuid()).min(1).max(500),
}).superRefine(({ taskIds }, context) => {
  if (new Set(taskIds).size !== taskIds.length) {
    context.addIssue({ code: "custom", path: ["taskIds"], message: "A ordem contém tarefas duplicadas." });
  }
});
export const createProjectSchema = z.object({ name: z.string().trim().min(2, "Use pelo menos 2 caracteres.").max(80, "Use até 80 caracteres.") });

export type TaskFormValues = z.infer<typeof taskFormSchema>;
