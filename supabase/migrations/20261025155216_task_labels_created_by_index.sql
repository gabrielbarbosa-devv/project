-- Keep auth.users deletion/update checks indexed for label creator references.
create index if not exists task_labels_created_by_idx
  on public.task_labels (created_by);
