import { Skeleton } from "@/components/ui/skeleton";

export function TaskListSkeleton() {
  return (
    <main className="min-w-0 flex-1 bg-card" aria-label="Carregando tarefas">
      <section className="mx-auto grid w-full max-w-[1600px] gap-6 px-5 pb-8 pt-5 sm:px-7 lg:px-8" aria-busy="true">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-5 w-80 max-w-[80vw]" />
          </div>
          <Skeleton className="h-11 w-36 rounded-[10px]" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-4">
          <Skeleton className="h-11 w-32 rounded-[10px]" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-44 rounded-[10px]" />
            <Skeleton className="h-10 w-24 rounded-[10px]" />
            <Skeleton className="h-10 w-28 rounded-[10px]" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <Skeleton className="h-11 rounded-none" />
          <div className="grid gap-0 divide-y divide-border-soft">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-[52px] rounded-none" />)}
          </div>
        </div>
      </section>
    </main>
  );
}
