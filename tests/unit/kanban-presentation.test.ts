import { describe, expect, it } from "vitest";
import { classifyTaskLoadIssue, getKanbanEmptyState, summarizeKanbanLabels } from "../../src/features/tasks/data/kanban-presentation";

describe("estados de apresentação do Kanban", () => {
  it("distingue workspace vazio, resultado vazio filtrado e quadro com tarefas", () => {
    expect(getKanbanEmptyState(0, false)).toBe("workspace");
    expect(getKanbanEmptyState(0, true)).toBe("filtered");
    expect(getKanbanEmptyState(1, true)).toBeNull();
    expect(getKanbanEmptyState(4, false)).toBeNull();
  });

  it("resume etiquetas visualmente sem remover os dados originais", () => {
    const labels = ["Roteiro", "YouTube", "Canal", "Prioridade"];
    const summary = summarizeKanbanLabels(labels);

    expect(summary.visible).toEqual(["Roteiro", "YouTube"]);
    expect(summary.hiddenCount).toBe(2);
    expect(labels).toHaveLength(4);
  });

  it("não confunde erros de autorização com falhas de conexão", () => {
    expect(classifyTaskLoadIssue({ status: 403 })).toBe("authorization");
    expect(classifyTaskLoadIssue({ code: "42501" })).toBe("authorization");
    expect(classifyTaskLoadIssue({ code: "PGRST301" })).toBe("authorization");
    expect(classifyTaskLoadIssue({ code: "PGRST205", status: 500 })).toBe("connection");
    expect(classifyTaskLoadIssue(null)).toBe("connection");
  });
});
