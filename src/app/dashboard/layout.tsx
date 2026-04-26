import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-8 pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
