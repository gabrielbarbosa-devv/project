"use client";

import { Check, ChevronDown, Ellipsis, Folder, LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { deleteProject } from "@/features/tasks/actions/tasks";

type Project = { id: string; name: string };

export function SidebarProjects({ projects, loadError, canManageProjects }: {
  projects: Project[];
  loadError: boolean;
  canManageProjects: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [isExpanded, setIsExpanded] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const activeProject = searchParams.get("project");

  function requestDelete(project: Project) {
    setDeleteError("");
    setDeleteTarget(project);
  }

  function handleProjectDeleted(projectId: string) {
    if (isMobile) setOpenMobile(false);

    if (activeProject === projectId) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.delete("project");
      const query = nextSearchParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      return;
    }

    router.refresh();
  }

  function confirmDelete() {
    if (!deleteTarget || deletePending) return;
    const target = deleteTarget;
    setDeleteError("");

    startDeleteTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteProject>>;
      try {
        result = await deleteProject({ id: target.id });
      } catch {
        result = { error: "Não foi possível excluir o projeto. Tente novamente." };
      }

      if (result.error) {
        setDeleteError(result.error);
        return;
      }

      setDeleteTarget(null);
      toast.success("Projeto excluído. As tarefas continuam no workspace sem projeto.");
      handleProjectDeleted(target.id);
    });
  }

  return (
    <>
      <SidebarGroup className="relative px-0 py-0">
        <div className="mb-1 h-8 shrink-0 px-0.5 group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls="sidebar-project-list"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] font-medium text-text-mid outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
            <span>Meus projetos</span>
          </button>
        </div>
        <div className="hidden w-full justify-center group-data-[collapsible=icon]:flex">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Meus projetos, abrir lista de projetos"
                    title="Meus projetos"
                    aria-current={activeProject ? "location" : undefined}
                    data-active={Boolean(activeProject)}
                    className="relative grid size-8 place-items-center rounded-md text-text-muted outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:-left-2 group-data-[collapsible=icon]:data-[active=true]:before:-left-5 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-r data-[active=true]:before:bg-primary"
                  >
                    <Folder aria-hidden="true" className="size-5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Meus projetos</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start" className="w-64">
              <DropdownMenuLabel>Meus projetos</DropdownMenuLabel>
              {projects.length ? projects.map((project) => {
                const active = activeProject === project.id;
                return (
                  <DropdownMenuGroup key={project.id} className="flex items-center gap-0">
                    <DropdownMenuItem asChild className={`h-9 min-w-0 flex-1 ${active ? "bg-accent font-medium text-accent-foreground" : ""}`}>
                      <Link href={`/hoje?project=${encodeURIComponent(project.id)}`} aria-current={active ? "page" : undefined} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                        <Folder aria-hidden="true" className="size-4" />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {active && <Check aria-hidden="true" className="size-4" />}
                      </Link>
                    </DropdownMenuItem>
                    {canManageProjects && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger aria-label={`Ações do projeto: ${project.name}`} className="h-8 w-8 shrink-0 justify-center px-1 [&>svg:last-child]:hidden">
                          <Ellipsis aria-hidden="true" className="size-4" />
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent sideOffset={6} className="w-44">
                          <DropdownMenuItem variant="destructive" onSelect={() => requestDelete(project)}>
                            <Trash2 aria-hidden="true" className="size-4" /> Excluir projeto
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                  </DropdownMenuGroup>
                );
              }) : (
                <DropdownMenuItem disabled>
                  {loadError ? "Não foi possível carregar projetos." : "Nenhum projeto cadastrado."}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SidebarGroupContent id="sidebar-project-list" hidden={!isExpanded} className="group-data-[collapsible=icon]:hidden">
          {projects.length ? (
            <SidebarMenu className="gap-1 pt-1">
              {projects.map((project) => (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton asChild isActive={activeProject === project.id} className={`h-9 gap-2.5 rounded-lg px-3 text-[13px] text-text-mid data-[active=true]:bg-hover data-[active=true]:text-foreground ${canManageProjects ? "pr-9" : ""}`}>
                    <Link href={`/hoje?project=${encodeURIComponent(project.id)}`} title={project.name} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                      <Folder aria-hidden="true" className="size-4" />
                      <span>{project.name}</span>
                    </Link>
                  </SidebarMenuButton>
                  {canManageProjects && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ações do projeto: ${project.name}`}
                          className="absolute right-1 top-1/2 z-10 size-7 -translate-y-1/2 rounded-md text-text-muted opacity-70 transition-opacity hover:bg-hover hover:text-foreground hover:opacity-100 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                        >
                          <Ellipsis aria-hidden="true" className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="bottom" align="end" className="w-44">
                        <DropdownMenuItem variant="destructive" onSelect={() => requestDelete(project)}>
                          <Trash2 aria-hidden="true" className="size-4" /> Excluir projeto
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          ) : (
            <p className="px-2 py-2 pl-[34px] text-[13px] text-text-soft">{loadError ? "Não foi possível carregar projetos." : "Nenhum projeto cadastrado."}</p>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!deletePending && !open) {
          setDeleteTarget(null);
          setDeleteError("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” será excluído. As tarefas vinculadas continuarão no workspace, mas ficarão sem projeto. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={deletePending}>Cancelar</Button>
            </AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deletePending} onClick={confirmDelete}>
              {deletePending ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Excluindo...</> : "Excluir projeto"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
