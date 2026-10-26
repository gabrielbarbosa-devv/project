import { Menu } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

type AppTopbarProps = {
  email?: string | null;
  name?: string | null;
};

export function AppTopbar({ email, name }: AppTopbarProps) {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-border-soft bg-card px-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="lg:hidden">
          <Menu aria-hidden="true" />
        </SidebarTrigger>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <UserMenu email={email} name={name} />
      </div>
    </header>
  );
}
