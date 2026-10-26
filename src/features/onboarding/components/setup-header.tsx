import { AmoraBrand } from "@/components/brand/amora-brand";
import { signOut } from "@/features/auth/actions/auth";

export function SetupHeader() {
  return <header className="setup-topbar"><AmoraBrand linked /><form action={signOut}><button className="signout-button" type="submit">Sair</button></form></header>;
}
