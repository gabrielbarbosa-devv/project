"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  SquareCheckBig,
  SunMedium,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import styles from "./sidebar-nav.module.css";

const taskItems = [
  { label: "Hoje", icon: SunMedium, href: "/hoje", state: "today" },
  { label: "Próximas", icon: CalendarDays, href: "/hoje?state=pending", state: "upcoming" },
  { label: "Concluídas", icon: CheckCircle2, href: "/hoje?state=completed", state: "completed" },
] as const;

export function SidebarNav() {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskState = searchParams.get("state");
  const isTasksRoute = pathname === "/hoje" || pathname.startsWith("/hoje/");
  const activeTask = taskState === "completed"
    ? "completed"
    : taskState === "pending"
      ? "upcoming"
      : taskState === "archived"
        ? null
        : "today";
  const isCompact = state === "collapsed" && !isMobile;

  return (
    <SidebarGroup className="px-0 py-0">
      <nav aria-label="Navegação principal">
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            {isCompact ? (
              <SidebarMenuButton
                type="button"
                aria-label="Tarefas; expandir a navegação para acessar Hoje, Próximas e Concluídas"
                aria-current={isTasksRoute ? "page" : undefined}
                isActive={isTasksRoute}
                tooltip="Tarefas · expandir para abrir as opções"
                onClick={() => setOpen(true)}
                className="relative mx-auto size-8 justify-center rounded-md text-text-muted data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:-left-2 group-data-[collapsible=icon]:data-[active=true]:before:-left-5 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-r data-[active=true]:before:bg-primary [&>svg]:size-[18px]"
              >
                <SquareCheckBig aria-hidden="true" />
              </SidebarMenuButton>
            ) : (
              <Collapsible defaultOpen className="w-full">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    aria-label="Tarefas"
                    title="Tarefas"
                    aria-current={isTasksRoute ? "location" : undefined}
                    data-active={isTasksRoute}
                    className={`${styles.trigger} relative flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[14px] font-semibold text-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[active=true]:bg-hover data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:-left-5 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-r data-[active=true]:before:bg-primary`}
                  >
                    <SquareCheckBig aria-hidden="true" className="size-[18px] shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1 truncate">Tarefas</span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-md text-text-muted">
                      <ChevronDown aria-hidden="true" className={`${styles.chevron} size-4`} />
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className={styles.content}>
                  <SidebarMenu className="ml-7 mt-1 gap-1">
                    {taskItems.map(({ label, icon: Icon, href, state: itemState }) => (
                      <SidebarMenuItem key={itemState}>
                        <SidebarMenuButton
                          asChild
                          isActive={isTasksRoute && activeTask === itemState}
                          aria-current={isTasksRoute && activeTask === itemState ? "page" : undefined}
                          tooltip={label}
                          className="h-[38px] rounded-[9px] px-3 text-[13px] font-medium text-text-mid data-[active=true]:bg-hover data-[active=true]:text-foreground [&>svg]:size-4 [&>svg]:text-text-muted data-[active=true]:[&>svg]:text-foreground"
                        >
                        <Link href={href} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                            <Icon aria-hidden="true" />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarMenuItem>

        </SidebarMenu>
      </nav>
    </SidebarGroup>
  );
}
