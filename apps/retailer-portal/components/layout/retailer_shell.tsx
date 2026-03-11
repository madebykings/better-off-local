import { RetailerSidebar } from './retailer_sidebar';
import { RetailerHeader } from './retailer_header';

export function RetailerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <RetailerSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <RetailerHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
