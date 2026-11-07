export function HomeOverallStats({
  completedTasks,
  totalTasks,
  activeProjects,
  workouts,
}: {
  completedTasks: number;
  totalTasks: number;
  activeProjects: number;
  workouts: number;
}) {
  const stats = [
    {
      label: "Tasks done",
      value: completedTasks,
      detail: `${totalTasks - completedTasks} left`,
      total: totalTasks,
    },
    {
      label: "Projects",
      value: activeProjects,
      detail: "in progress",
    },
    {
      label: "Workouts",
      value: workouts,
      detail: "logged",
    },
  ];

  return (
    <section
      aria-label="Overall statistics"
      className="grid grid-cols-3 gap-2 sm:gap-4"
    >
      {stats.map((stat) => (
        <article
          key={stat.label}
          className="rounded-2xl border bg-card p-3 text-card-foreground shadow-sm sm:p-5"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">
            {stat.label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">
            {stat.value}
            {stat.total !== undefined && (
              <span className="text-sm font-medium text-muted-foreground sm:text-base">
                {" "}/ {stat.total}
              </span>
            )}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
            {stat.detail}
          </p>
        </article>
      ))}
    </section>
  );
}
