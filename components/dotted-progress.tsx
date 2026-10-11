type DottedProgressProps = {
  progress: number;
  dotCount?: number;
};

export function DottedProgress({ progress, dotCount = 24 }: DottedProgressProps) {
  const boundedProgress = Math.min(100, Math.max(0, progress));
  const activeDots = Math.round((boundedProgress / 100) * dotCount);

  return (
    <div
      className="mt-6"
      role="img"
      aria-label={`Progress: ${Math.round(boundedProgress)}%`}
      style={{ justifyContent: "center", display: "flex" }}
    >
      <svg viewBox="0 0 120 120" className="size-28" aria-hidden="true">
        {Array.from({ length: dotCount }, (_, dotIndex) => {
          const angle = (dotIndex / dotCount) * 2 * Math.PI - Math.PI / 2;
          const x = Math.round((60 + 46 * Math.cos(angle)) * 1000) / 1000;
          const y = Math.round((60 + 46 * Math.sin(angle)) * 1000) / 1000;

          return (
            <circle
              key={dotIndex}
              cx={x}
              cy={y}
              r="3"
              className={dotIndex < activeDots ? "fill-primary" : "fill-muted"}
            />
          );
        })}
        <text
          x="60"
          y="64"
          textAnchor="middle"
          className="fill-current text-xl font-semibold"
        >
          {Math.round(boundedProgress)}%
        </text>
      </svg>
    </div>
  );
}