"use client";

import { BriefcaseBusiness, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Persona, Workspace } from "@/features/workspaces/types";

type WorkspaceSwitcherProps = {
  persona: Persona | null;
  workspace: Pick<Workspace, "id" | "name" | "slug"> | null;
};

const personaLabels: Record<Persona, string> = {
  creator: "Criador de conteúdo",
  agency: "Agência ou estúdio",
  brand: "Marca ou negócio",
};

export function WorkspaceSwitcher({ persona, workspace }: WorkspaceSwitcherProps) {
  const name = workspace?.name ?? "Workspace indisponível";
  const initial = workspace?.name.trim().charAt(0).toLocaleUpperCase("pt-BR");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-[56px] w-full items-center gap-2.5 rounded-xl border border-border-soft bg-card px-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0"
          aria-label="Selecionar espaço de trabalho"
          title={name}
        >
          {workspace ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">{initial}</span>
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-selected text-primary"><BriefcaseBusiness aria-hidden="true" className="size-4" /></span>
          )}
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-[14px] font-semibold leading-5 text-foreground">
              {name}
            </span>
            <span className="block truncate text-xs leading-4 text-text-soft">
              {persona ? personaLabels[persona] : "Espaço de trabalho"}
            </span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-text-muted group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[228px]">
        <DropdownMenuLabel>Espaço de trabalho</DropdownMenuLabel>
        {workspace ? (
          <DropdownMenuItem disabled>
            <Check aria-hidden="true" className="size-4 text-primary" />
            {workspace.name}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>O workspace não está disponível.</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
