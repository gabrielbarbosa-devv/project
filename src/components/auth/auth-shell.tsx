import type { ReactNode } from "react";
import { ArrowDownUp, CalendarDays, Camera, ChartNoAxesColumnIncreasing, ChevronDown, FileText, Filter, LayoutGrid, MessageCircle, Play, Plus } from "lucide-react";
import { AmoraBrand } from "@/components/brand/amora-brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-stage">
      <section className="auth-card" aria-label="Acesso à Amora">
        <div className="form-panel">
          <AmoraBrand linked />
          <div className="form-content">{children}</div>
        </div>
        <AuthShowcase />
      </section>
    </main>
  );
}

function AuthShowcase() {
  return (
    <aside className="auth-showcase" aria-hidden="true">
      <div className="workspace-preview">
        <div className="preview-sidebar">
          <div className="preview-brand">
            <AmoraBrand compact />
            <span><b>Amora</b><small>Espaço de conteúdo</small></span>
          </div>
          <nav className="preview-nav">
            <span><LayoutGrid /> Visão geral</span>
            <span className="selected"><FileText /> Pautas</span>
            <span><CalendarDays /> Calendário</span>
            <span><Play /> Canais</span>
            <span><ChartNoAxesColumnIncreasing /> Analytics</span>
            <span><MessageCircle /> Equipe</span>
          </nav>
        </div>

        <div className="preview-main">
          <header className="preview-topbar">
            <div><FileText /><b>Pautas</b></div>
          </header>
          <div className="preview-toolbar">
            <span><Filter /> Filtrar</span>
            <span><ArrowDownUp /> Ordenar</span>
            <span><ChartNoAxesColumnIncreasing /> Agrupar <ChevronDown /></span>
          </div>
          <div className="preview-columns">
            <PreviewColumn title="Ideias" tone="purple">
              <PreviewCard platform="youtube" tags={["Planejamento", "Short"]} title="Ideias para os próximos conteúdos" />
              <PreviewCard platform="instagram" tags={["Dicas", "Reels"]} title="Uma pauta para desenvolver" />
              <PreviewCard platform="youtube" tags={["Referências", "Vídeo"]} title="Anotações de criação" />
              <PreviewAdd />
            </PreviewColumn>
            <PreviewColumn title="Em produção" tone="blue">
              <PreviewCard platform="youtube" tags={["Roteiro", "Vídeo"]} title="Roteiro em andamento" />
              <PreviewCard platform="instagram" tags={["Conteúdo", "Reels"]} title="Publicação em preparação" />
              <PreviewAdd />
            </PreviewColumn>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PreviewColumn({ title, tone, children }: { title: string; tone: "purple" | "blue"; children: ReactNode }) {
  return <section className="preview-column"><div className="column-heading"><i className={`dot-${tone}`} />{title}</div>{children}</section>;
}

function PreviewCard({ platform, tags, title }: { platform: "youtube" | "instagram"; tags: [string, string]; title: string }) {
  const PlatformIcon = platform === "youtube" ? Play : Camera;
  return (
    <article className="preview-card">
      <div className="preview-tags"><PlatformIcon className={platform} /><span>{tags[0]}</span><em>{tags[1]}</em><b>···</b></div>
      <p>{title}</p>
      <div className="preview-card-meta"><CalendarDays /><span>Rascunho</span></div>
    </article>
  );
}

function PreviewAdd() {
  return <div className="preview-add"><Plus />Adicionar pauta</div>;
}
