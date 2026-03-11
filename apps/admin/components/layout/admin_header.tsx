export function AdminHeader() {
  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="text-sm text-gray-500">
        {/* TODO: breadcrumb */}
      </div>
      <div className="flex items-center gap-3">
        {/* TODO: admin user context + sign out */}
        <div className="w-8 h-8 rounded-full bg-gray-200" />
      </div>
    </header>
  );
}
