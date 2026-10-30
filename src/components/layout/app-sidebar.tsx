"use client";

import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { AmoraBrand } from "@/components/brand/amora-brand";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarFooter } from "@/components/layout/sidebar-footer";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SidebarProjects } from "@/components/layout/sidebar-projects";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import type { Persona, Workspace } from "@/features/workspaces/types";

type AppSidebarProps = {
  persona: Persona | null;
  workspace: Pick<Workspace, "id" | "name" | "slug"> | null;
  projects: Array<{ id: string; name: string }>;
  projectsLoadError: boolean;
  canManageProjects: boolean;
};

export function AppSidebar({ persona, workspace, projects, projectsLoadError, canManageProjects }: AppSidebarProps) {
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border-soft">
      <SidebarHeader className="gap-5 px-5 pb-4 pt-[18px] group-data-[collapsible=icon]:px-2">
        <div className="flex h-9 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:hidden">
            <AmoraBrand compact />
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block text-[16px] font-semibold leading-5 tracking-[-0.35px] text-foreground">Amora</span>
              <span className="block whitespace-nowrap text-[13px] leading-[18px] text-text-soft">Content Workspace</span>
            </span>
          </div>
          <div className="hidden min-w-0 items-center group-data-[collapsible=icon]:flex">
            <span className="amora-sidebar-brand-compact"><AmoraBrand compact /></span>
          </div>
          <SidebarTrigger
            className="size-8 shrink-0 rounded-md text-text-sidebar-icon hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:size-7"
          >
            {isMobile ? <X aria-hidden="true" className="size-4" /> : isCollapsed ? <ChevronsRight aria-hidden="true" className="size-4" /> : <ChevronsLeft aria-hidden="true" className="size-4" />}
          </SidebarTrigger>
        </div>
        <WorkspaceSwitcher persona={persona} workspace={workspace} />
      </SidebarHeader>

      <SidebarContent className="gap-0 px-5 pt-1">
        <SidebarNav />
        <SidebarSeparator className="mx-0 my-[18px] bg-border-soft" />
        <SidebarProjects projects={projects} loadError={projectsLoadError} canManageProjects={canManageProjects} />
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  );
}
