import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskListSkeleton } from "@/features/tasks/components/task-list-skeleton";
import { TaskKanbanSkeleton } from "@/features/tasks/components/task-kanban-view";
import { TaskWorkspaceLoadError } from "@/features/tasks/components/task-load-error";
import { getTodayWorkspaceData, parseTaskFilters } from "@/features/tasks/data/queries";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HojePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = params.view === "kanban" ? "kanban" : "list";
  return <Suspense fallback={view === "kanban" ? <TaskKanbanSkeleton /> : <TaskListSkeleton />}><HojePageData params={params} view={view} /></Suspense>;
}

async function HojePageData({ params, view }: { params: Record<string, string | string[] | undefined>; view: "list" | "kanban" }) {
  await connection();
  const filters = parseTaskFilters(params);
  const result = await getTodayWorkspaceData(filters, { includeKanbanMetadata: view === "kanban" });
  if (!result) redirect("/login");
  if (result.kind === "unavailable") return <TaskWorkspaceLoadError issue={result.issue} />;
  const data = result;

  return <TaskList
    workspaceName={data.workspace.name}
    projects={data.projects}
    labels={data.labels}
    tasks={data.tasks}
    kanbanMetadata={data.kanbanMetadata}
    today={data.today}
    view={view}
    filters={data.filters}
    canCreateProjects={data.canCreateProjects}
    loadError={data.loadError}
  />;
}
