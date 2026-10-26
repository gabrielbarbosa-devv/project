"use client";

import { Check, ChevronDown, Folder } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

export function SidebarProjects({ projects, loadError }: { projects: Array<{ id: string; name: string }>; loadError: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [isExpanded, setIsExpanded] = useState(true);
  const searchParams = useSearchParams();
  const activeProject = searchParams.get("project");

  return (
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
          <DropdownMenuContent side="right" align="start" className="w-56">
            <DropdownMenuLabel>Meus projetos</DropdownMenuLabel>
            {projects.length ? projects.map((project) => {
              const active = activeProject === project.id;
              return (
                <DropdownMenuItem key={project.id} asChild className={active ? "bg-accent font-medium text-accent-foreground" : ""}>
                  <Link href={`/hoje?project=${encodeURIComponent(project.id)}`} aria-current={active ? "page" : undefined} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                    <Folder aria-hidden="true" className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {active && <Check aria-hidden="true" className="size-4" />}
                  </Link>
                </DropdownMenuItem>
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
                <SidebarMenuButton asChild isActive={activeProject === project.id} className="h-9 gap-2.5 rounded-lg px-3 text-[13px] text-text-mid data-[active=true]:bg-hover data-[active=true]:text-foreground">
                  <Link href={`/hoje?project=${encodeURIComponent(project.id)}`} title={project.name} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                    <Folder aria-hidden="true" className="size-4" />
                    <span>{project.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        ) : (
          <p className="px-2 py-2 pl-[34px] text-[13px] text-text-soft">{loadError ? "Não foi possível carregar projetos." : "Nenhum projeto cadastrado."}</p>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
