export default function AdminLoading(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-7 w-32 rounded-lg bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-6 rounded-xl border border-admin-card-border"
          >
            <div className="w-12 h-12 rounded-lg bg-gray-100 animate-pulse shrink-0" />
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
              <div className="h-6 w-10 rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
