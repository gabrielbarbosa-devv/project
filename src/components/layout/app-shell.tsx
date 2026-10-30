import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Persona } from "@/features/workspaces/types";
import type { Workspace } from "@/features/workspaces/types";

type AppShellProps = {
  children: ReactNode;
  email?: string | null;
  name?: string | null;
  persona: Persona | null;
  workspace: Pick<Workspace, "id" | "name" | "slug"> | null;
  projects: Array<{ id: string; name: string }>;
  projectsLoadError: boolean;
  canManageProjects: boolean;
  sidebarDefaultOpen: boolean;
};

export function AppShell({ children, email, name, persona, workspace, projects, projectsLoadError, canManageProjects, sidebarDefaultOpen }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen} className="amora-app-shell" style={{ "--sidebar-width": "clamp(268px, 20.5vw, 338px)" } as CSSProperties}>
      <TooltipProvider>
        <AppSidebar persona={persona} workspace={workspace} projects={projects} projectsLoadError={projectsLoadError} canManageProjects={canManageProjects} />
        <SidebarInset className="min-h-screen bg-app-background">
          <AppTopbar email={email} name={name} />
          {children}
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
