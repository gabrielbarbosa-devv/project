import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KanbanTaskCard } from "@/features/tasks/components/kanban-task-card";
import { TaskLabelBadges } from "@/features/tasks/components/task-label-badges";
import type { Project, Task, TaskLabel } from "@/features/tasks/data/queries";

const task: Task = {
  id: "task-card-fixture",
  workspace_id: "workspace-fixture",
  created_by: "user-fixture",
  project_id: "project-fixture",
  title: "Organizar uma campanha com um título longo que deve ser limitado a duas linhas no cartão",
  description: "Descrição realista de teste com contexto adicional para verificar o limite visual de duas linhas no cartão compacto.",
  planned_for: "2026-10-24",
  start_time: "09:00:00",
  due_on: "2026-10-23",
  priority: "high",
  status: "pending",
  completed_at: null,
  archived_at: null,
  sort_order: 1,
  created_at: "2026-10-20T12:00:00.000Z",
  updated_at: "2026-10-20T12:00:00.000Z",
};

const projects: Project[] = [{ id: "project-fixture", name: "Canal Dark" }];
const labels: TaskLabel[] = ["Roteiro", "YouTube", "Planejamento", "Revisão"].map((name, index) => ({
  id: `label-${index}`,
  name,
  name_key: name.toLowerCase(),
  color: index === 1 ? "blue" : "violet",
}));

function renderCard(overrides: Partial<Parameters<typeof KanbanTaskCard>[0]> = {}) {
  const props: Parameters<typeof KanbanTaskCard>[0] = {
    task,
    projectName: "Canal Dark",
    labels,
    checklistTotal: 5,
    checklistCompleted: 3,
    today: "2026-10-25",
    archived: false,
    selected: true,
    projects,
    onOpen: () => undefined,
    onAction: async () => ({}),
    ...overrides,
  };
  return renderToStaticMarkup(createElement(TooltipProvider, null, createElement(KanbanTaskCard, props)));
}

describe("KanbanTaskCard", () => {
  it("permite iniciar o arraste em todo o cartão ativo", () => {
    const markup = renderCard();

    expect(markup).toContain('draggable="true"');
    expect(markup).toContain('aria-roledescription="cartão arrastável"');
    expect(markup).not.toContain("Arrastar tarefa");
  });

  it("mantém cartões arquivados fora do arraste", () => {
    const markup = renderCard({ archived: true });

    expect(markup).toContain('draggable="false"');
    expect(markup).not.toContain("cartão arrastável");
  });

  it("apresenta dados carregados, resumo de etiquetas e progresso real do checklist", () => {
    const markup = renderCard();

    expect(markup).toContain('aria-label="Tarefa: Organizar uma campanha');
    expect(markup).toContain("Abrir tarefa: Organizar uma campanha");
    expect(markup).toContain('aria-label="Ações da tarefa: Organizar uma campanha');
    expect(markup).toContain("Canal Dark");
    expect(markup).toContain("Roteiro");
    expect(markup).toContain("YouTube");
    expect(markup).toContain('aria-label="2 etiquetas adicionais: Planejamento, Revisão"');
    expect(markup).toContain("+2");
    expect(markup).toContain("Prazo final vencido");
    expect(markup).toContain("Alta");
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuetext="Checklist: 3 de 5 itens concluídos, 60%."');
    expect(markup).toContain('aria-valuenow="3"');
    expect(markup).toContain("3/5");
    expect(markup).toContain("Checklist");
    expect(markup).toContain("Descrição realista de teste");
  });

  it("mantém a descrição resumida visível antes de abrir detalhes", () => {
    const markup = renderCard({ selected: false });
    const description = markup.slice(markup.indexOf("<p aria-hidden=\"true\""), markup.indexOf("</p>", markup.indexOf("<p aria-hidden=\"true\"")));

    expect(description).toContain("line-clamp-2");
    expect(description).not.toMatch(/class="[^"]*\bhidden\b/);
    expect(description).toContain("Descrição realista de teste");
  });

  it("indica seleção e reserva um foco visível separado para teclado", () => {
    const markup = renderCard({ selected: true });

    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain("border-primary/75");
    expect(markup).not.toContain("ring-1 ring-primary/20");
    expect(markup).toContain("amora-kanban-card-open");
    expect(markup).not.toContain("focus-within:ring-2");
    expect(markup).toContain("overflow-visible");
  });

  it("não inventa projeto, etiquetas ou progresso quando os dados estão ausentes", () => {
    const markup = renderCard({
      task: { ...task, project_id: null, description: null, due_on: null, planned_for: null, start_time: null },
      projectName: null,
      labels: [],
      checklistTotal: 0,
      checklistCompleted: 0,
      selected: false,
    });

    expect(markup).toContain("Sem projeto");
    expect(markup).toContain("Sem prazo");
    expect(markup).not.toContain("Checklist");
    expect(markup).not.toContain("0/0");
    expect(markup).not.toContain("Descrição:");
    expect(markup).not.toContain("+0");
  });

  it("risca somente o título de tarefas concluídas e mantém a prioridade legível", () => {
    const markup = renderCard({ task: { ...task, status: "completed", priority: "low", due_on: null } });

    expect(markup).toContain("line-through");
    expect(markup).toContain("Baixa");
    expect(markup).not.toContain("Prazo final vencido");
    expect(markup).not.toContain("bg-card/85");
    expect(markup).toContain("Checklist");
  });

  it("representa checklist completo com progresso integral", () => {
    const markup = renderCard({ checklistTotal: 4, checklistCompleted: 4 });

    expect(markup).toContain('aria-valuetext="Checklist: 4 de 4 itens concluídos, 100%."');
    expect(markup).toContain("4/4");
    expect(markup).toContain("stroke-dashoffset=\"0\"");
  });

  it("mantém a contagem real com status concluído mesmo se o checklist estiver incompleto", () => {
    const markup = renderCard({ task: { ...task, status: "completed" }, checklistTotal: 4, checklistCompleted: 1 });

    expect(markup).toContain('aria-valuetext="Checklist: 1 de 4 itens concluídos, 25%."');
    expect(markup).toContain(">1/4</span>");
    expect(markup).toContain("line-through");
  });

  it("não ultrapassa os limites de progresso recebidos", () => {
    const markup = renderCard({ checklistTotal: 4, checklistCompleted: 8 });

    expect(markup).toContain('aria-valuenow="4"');
    expect(markup).toContain('aria-valuetext="Checklist: 4 de 4 itens concluídos, 100%."');
    expect(markup).toContain(">4/4</span>");
  });

  it("usa cores distintas e suaves para etiquetas semanticamente diferentes", () => {
    const markup = renderToStaticMarkup(createElement(TaskLabelBadges, {
      labels: [
        { id: "blue-label", name: "Azul", name_key: "azul", color: "blue" },
        { id: "amber-label", name: "Âmbar", name_key: "ambar", color: "amber" },
        { id: "green-label", name: "Verde", name_key: "verde", color: "green" },
      ],
      visibleLimit: 3,
    }));

    expect(markup).toContain("text-blue-700 dark:text-blue-300");
    expect(markup).toContain("text-amber-700 dark:text-amber-300");
    expect(markup).toContain("text-green-700 dark:text-green-300");
  });

  it("nomeia uma etiqueta excedente no botão de resumo", () => {
    const markup = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(TaskLabelBadges, {
      labels: [
        { id: "one", name: "Roteiro", name_key: "roteiro", color: "violet" },
        { id: "two", name: "YouTube", name_key: "youtube", color: "blue" },
        { id: "three", name: "Canal Dark", name_key: "canal-dark", color: "slate" },
      ],
    })));

    expect(markup).toContain('aria-label="1 etiqueta adicional: Canal Dark"');
    expect(markup).toContain(">+1</button>");
  });
});
