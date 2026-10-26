# Amora

Plataforma de operações de conteúdo com autenticação, onboarding e gerenciamento de tarefas em Lista e Kanban, persistidos no Supabase. Os módulos de CRM, analytics, calendário e criação de conteúdo ainda não estão disponíveis.

## Rodar localmente

1. Instale as dependências com `pnpm install`.
2. Copie `.env.example` para `.env.local` e preencha a URL e a chave publicável do Supabase.
3. Defina `NEXT_PUBLIC_SITE_URL=http://localhost:3000` no `.env.local`. No Supabase Auth → URL Configuration, configure `http://localhost:3000` como Site URL e adicione `http://localhost:3000/auth/confirm` e `http://localhost:3000/auth/callback` à lista de Redirect URLs. Em produção, troque Site URL e `NEXT_PUBLIC_SITE_URL` pelo domínio HTTPS publicado e adicione os caminhos desse domínio.
4. Em Supabase Auth → Providers → Email, mantenha Email habilitado. Em Authentication → Email Templates → Reset Password, mantenha o link do template como `{{ .ConfirmationURL }}`. O fluxo SSR usa PKCE e retorna para `/auth/confirm?next=/redefinir-senha`; não troque pelo formato `token_hash` sem alterar a implementação para OTP.
5. Em Authentication → Rate Limits, confira o limite de envio de e-mail. A aplicação mostra o bloqueio devolvido pelo Supabase sem revelar se o endereço está cadastrado.
6. Para editar o template ou preparar envio de produção, abra Authentication → SMTP Settings, habilite Custom SMTP e preencha host, porta, usuário, senha, nome e endereço do remetente fornecidos pelo serviço de e-mail. Verifique o domínio remetente com os registros DNS (SPF/DKIM) indicados por esse serviço. Salve e envie um teste para uma inbox controlada. Sem SMTP próprio, o projeto usa o serviço padrão do Supabase, sujeito aos limites e às regras atuais do plano.
7. Rode `pnpm dev`.

## Tarefas e projetos

O schema incremental `20261025053127_tasks_and_projects.sql` cria apenas as tabelas `projects` e `tasks`, com índices, constraints, trigger de `updated_at` e RLS por workspace. `20261025053150_index_task_creators.sql` adiciona índices para as FKs de autoria. `20261025135220_task_labels_and_idempotent_task_creation.sql` adiciona etiquetas e associações com RLS, unicidade normalizada por workspace, FKs compostas contra associações cruzadas e RPC transacional para criação idempotente de tarefas. `20261025143035_task_details_checklist_activity.sql` adiciona checklist e histórico real de atividade, RLS por workspace e RPCs/trigger transacionais para registrar mudanças confirmadas. As migrações foram aplicadas ao projeto `xbincikkslurfslpefsg` (branch `main`) e verificadas no Supabase; não foram inseridas tarefas, projetos, etiquetas, itens de checklist ou atividades de exemplo. Os seletores começam vazios até que o usuário crie registros reais.

Ao criar uma etiqueta no formulário, ela só é persistida junto com a tarefa na mesma transação. A data planejada e o prazo são datas civis; a aplicação não os converte para UTC. O horário só pode ser enviado quando uma data planejada estiver definida. A RPC deriva o usuário e o workspace da sessão autenticada e as chaves compostas do banco impedem associar etiquetas e tarefas de workspaces diferentes.

O painel de detalhes reutiliza o formulário de criação para editar título, descrição, projeto, prioridade, datas, status e etiquetas. Essas alterações são salvas atomicamente; checklist é persistido imediatamente, e o histórico começa na migração, sem reconstruir eventos antigos. O banco só oferece os status `pending` e `completed`, apresentados como Pendente e Concluída.

Para aplicar em outro ambiente Supabase, instale a CLI (`pnpm dlx supabase`), autentique e vincule o projeto (`pnpm dlx supabase link --project-ref <project-ref>`). Aplique as migrações versionadas com `pnpm dlx supabase db push`. Confirme as versões em `supabase_migrations.schema_migrations` e verifique em Database → Tables que `projects` e `tasks` estão com RLS habilitada.

As variáveis locais necessárias estão em `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL`. Não use uma `service_role` no navegador.

## Verificações

- `pnpm lint` — ESLint.
- `pnpm exec tsc --noEmit` — checagem de tipos.
- `pnpm test` — schemas e helpers puros com Vitest.
- `pnpm test:e2e` — smoke tests de autenticação e proteção da rota `/hoje`; requer Chromium instalado.
- `pnpm build` — build de produção.
- Os fluxos de CRUD de tarefa não são automatizados contra o banco de produção para evitar registros fictícios. A validação ponta a ponta de mutações exige um projeto/branch de teste e usuário real de teste.

O projeto Supabase `xbincikkslurfslpefsg` recebeu as migrações versionadas em `supabase/migrations/` (schema, endurecimento dos RPCs, criação atômica do proprietário e trigger de perfil idempotente). A chave publicável local nunca é commitada; o arquivo `.env.local` está no `.gitignore`.

O botão de Google aparece quando `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. Antes de ativá-lo, habilite Google em Auth → Providers e cadastre as credenciais OAuth no Supabase.

**Bloqueio jurídico de lançamento:** textos oficiais dos Termos de Uso e da Política de Privacidade ainda não foram fornecidos. Por isso, o cadastro não apresenta checkbox nem links legais inventados. Antes do lançamento público, publicar os textos aprovados, incluir links funcionais e exigir o aceite correspondente.

## Fluxos

- `/` redireciona visitantes para `/login` e pessoas autenticadas para a etapa de onboarding correspondente.
- `/login` e `/cadastro` usam e-mail e senha; cadastro com confirmação retorna por `/auth/confirm` e troca o token por sessão nos cookies SSR.
- `/recuperar-senha` envia link sem revelar se o endereço existe; `/redefinir-senha` exige sessão PKCE criada pelo callback de recovery e um marcador httpOnly curto. Ao concluir, a sessão local é encerrada e a pessoa volta ao login.
- `/auth/confirm` troca códigos PKCE por sessão em cookies; a redefinição usa apenas esse fluxo SSR. Códigos, cookies de sessão e dados da senha não são exibidos na interface.
- `/onboarding` cria perfil de operação e workspace; a função SQL cria também o vínculo de proprietário na mesma transação.
- `/onboarding/canais` permite cadastrar canais manualmente ou pular a etapa.
- Ao concluir ou pular canais, a tela de espera aparece enquanto `complete_my_onboarding` salva o estado no Supabase; somente após sucesso, a navegação segue para `/hoje`.
- `/onboarding/concluido` redireciona configurações já concluídas para `/hoje`. A área Hoje consulta workspace, projetos e tarefas reais; a autorização também é aplicada pelas policies RLS.

## Arquitetura

- Next.js 16 App Router, Server Components, Server Actions e `src/proxy.ts`.
- TypeScript strict, Tailwind CSS 4 e componentes shadcn/ui em `src/components/ui`.
- Supabase Auth SSR com `@supabase/ssr`, cookies PKCE e checagem de usuário no servidor.
- PostgreSQL com RLS, perfis, workspaces, membros, canais, projetos, tarefas e etiquetas. RPCs autenticadas verificam `auth.uid()` e mantêm criação de tarefa/etiquetas na mesma transação.
- React Hook Form, Zod, Lucide React e pnpm.

O exemplo `supabase/tests/rls_workspace_isolation.example.sql` mostra como confirmar, no Supabase local, que um usuário não consegue ler workspaces ou canais de outro. Não execute esse exemplo em produção. O CRUD da área Hoje deriva o workspace no servidor e não aceita `workspace_id` informado pelo navegador.

**Verificação real de e-mail pendente:** os testes locais validam schema, callback SSR, mensagens de erro e interface. Não foi enviado e-mail nem redefinida senha contra uma caixa de entrada real. Para validar ponta a ponta, configure Site URL e Redirect URLs acima, configure SMTP de teste com inbox controlada, solicite recuperação em `/recuperar-senha`, abra a mensagem recebida no mesmo navegador que iniciou o pedido e conclua `/redefinir-senha`. Não use contas de produção para automação de testes.

Tipos do banco estão em `src/types/database.ts` e foram gerados do projeto Supabase após a migração.
