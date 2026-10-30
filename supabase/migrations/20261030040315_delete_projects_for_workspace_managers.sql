-- Project deletion is restricted to workspace owners and admins. Tasks use
-- ON DELETE SET NULL for project_id, so deleting a project keeps its tasks.
grant delete on public.projects to authenticated;

create policy "Workspace managers can delete projects"
  on public.projects for delete to authenticated
  using (exists (
    select 1 from public.workspace_members as membership
    where membership.workspace_id = projects.workspace_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  ));
