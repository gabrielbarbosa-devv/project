import { describe, expect, it } from "vitest";
import { createChecklistItemSchema, createTaskSchema, duplicateTaskSchema, reorderTaskGroupSchema, taskFormSchema, updateChecklistItemSchema, updateTaskSchema } from "@/features/tasks/schemas/task.schema";

const validForm = {
  title: "Preparar roteiro",
  description: "",
  projectId: "",
  plannedFor: "",
  startTime: "",
  dueOn: "",
  priority: "medium" as const,
};

describe("task creation schema", () => {
  it("requires task and retry UUIDs before duplicating", () => {
    const valid = {
      id: "71360d82-f90f-4625-b554-3c014a5da821",
      requestId: "e95e1c69-333e-4a5d-9955-22f66932751c",
    };
    expect(duplicateTaskSchema.safeParse(valid).success).toBe(true);
    expect(duplicateTaskSchema.safeParse({ ...valid, requestId: "invalid" }).success).toBe(false);
    expect(duplicateTaskSchema.safeParse({ ...valid, requestId: valid.id }).success).toBe(false);
    expect(duplicateTaskSchema.safeParse({ id: valid.id }).success).toBe(false);
  });

  it("accepts a title-only task with no project or optional dates", () => {
    expect(createTaskSchema.safeParse({
      ...validForm,
      requestId: "e95e1c69-333e-4a5d-9955-22f66932751c",
      labelIds: [],
      newLabelNames: [],
    }).success).toBe(true);
  });

  it("rejects blank titles and a time without a planned date", () => {
    expect(taskFormSchema.safeParse({ ...validForm, title: "   " }).success).toBe(false);
    const result = taskFormSchema.safeParse({ ...validForm, startTime: "09:00" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toContain("plannedFor");
  });

  it("validates civil dates and the 24-hour time format", () => {
    expect(taskFormSchema.safeParse({ ...validForm, plannedFor: "2026-10-26", startTime: "23:59" }).success).toBe(true);
    expect(taskFormSchema.safeParse({ ...validForm, plannedFor: "2026-02-30" }).success).toBe(false);
    expect(taskFormSchema.safeParse({ ...validForm, plannedFor: "2026-10-26", startTime: "24:00" }).success).toBe(false);
  });

  it("rejects duplicate selected label IDs and equivalent new names", () => {
    const common = { ...validForm, requestId: "e95e1c69-333e-4a5d-9955-22f66932751c" };
    expect(createTaskSchema.safeParse({ ...common, labelIds: ["71360d82-f90f-4625-b554-3c014a5da821", "71360d82-f90f-4625-b554-3c014a5da821"], newLabelNames: [] }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...common, labelIds: [], newLabelNames: ["Roteiro", " roteiro "] }).success).toBe(false);
  });

  it("validates the persisted task status and label fields for editing", () => {
    const validEdit = {
      ...validForm,
      id: "71360d82-f90f-4625-b554-3c014a5da821",
      status: "pending" as const,
      labelIds: [],
      newLabelNames: [],
    };
    expect(updateTaskSchema.safeParse(validEdit).success).toBe(true);
    expect(updateTaskSchema.safeParse({ ...validEdit, status: "in_progress" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ ...validEdit, labelIds: [validEdit.id, validEdit.id] }).success).toBe(false);
  });

  it("validates checklist create and update input without accepting empty updates", () => {
    const taskId = "71360d82-f90f-4625-b554-3c014a5da821";
    expect(createChecklistItemSchema.safeParse({ taskId, title: "Revisar roteiro" }).success).toBe(true);
    expect(createChecklistItemSchema.safeParse({ taskId, title: "   " }).success).toBe(false);
    expect(updateChecklistItemSchema.safeParse({ id: taskId }).success).toBe(false);
    expect(updateChecklistItemSchema.safeParse({ id: taskId, isCompleted: true }).success).toBe(true);
  });

  it("accepts unique task IDs for manual ordering and rejects duplicates or archived groups", () => {
    const taskIds = ["71360d82-f90f-4625-b554-3c014a5da821", "e95e1c69-333e-4a5d-9955-22f66932751c"];
    expect(reorderTaskGroupSchema.safeParse({ groupKey: "today", taskIds }).success).toBe(true);
    expect(reorderTaskGroupSchema.safeParse({ groupKey: "today", taskIds: [taskIds[0], taskIds[0]] }).success).toBe(false);
    expect(reorderTaskGroupSchema.safeParse({ groupKey: "archived", taskIds }).success).toBe(false);
  });
});
