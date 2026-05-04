import MapComponent from '@/components/MapComponent';
import { Sidebar } from '@/components/Sidebar';

export default function MapPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />
      <main className="flex-1 relative">
        <div className="absolute inset-0 p-4 pt-16 md:p-8">
          <MapComponent />
        </div>
      </main>
    </div>
  );
}
