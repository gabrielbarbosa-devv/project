import { ChevronRight, Headphones, Settings } from "lucide-react";
import {
  SidebarFooter as ShadcnSidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { label: "Configurações", icon: Settings },
  { label: "Central de ajuda", icon: Headphones },
];

export function SidebarFooter() {
  return (
    <ShadcnSidebarFooter className="mt-auto px-5 pb-[18px] pt-4">
      <div className="mb-3 border-t border-border-soft" />
      <SidebarMenu className="gap-1.5">
        {items.map(({ label, icon: Icon }) => (
          <SidebarMenuItem key={label}>
            <SidebarMenuButton
              disabled
              aria-label={label}
              title={label}
              className="h-[42px] rounded-[10px] px-4 text-[14px] font-medium text-text-mid opacity-100 disabled:pointer-events-none disabled:opacity-100 [&>svg]:size-5 [&>svg]:text-text-muted"
            >
              <Icon aria-hidden="true" />
              <span className="group-data-[collapsible=icon]:hidden">{label}</span>
              <ChevronRight aria-hidden="true" className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </ShadcnSidebarFooter>
  );
}
