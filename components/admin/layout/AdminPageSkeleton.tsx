const SKELETON_ROWS = 8;

export function AdminPageSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-gray-100" />

      <div className="h-9 w-28 rounded-lg bg-gray-100" />

      <div className="bg-white rounded-xl border border-admin-card-border overflow-hidden">
        <div className="border-b border-admin-card-border px-4 py-3 flex gap-6">
          {[120, 80, 160, 100, 80].map((w, i) => (
            <div key={i} className={`h-4 rounded bg-gray-100`} style={{ width: w }} />
          ))}
        </div>

        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div
            key={i}
            className="border-b border-admin-card-border last:border-b-0 px-4 py-3 flex gap-6 items-center"
          >
            {[120, 80, 160, 100, 80].map((w, j) => (
              <div key={j} className="h-4 rounded bg-gray-50" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
