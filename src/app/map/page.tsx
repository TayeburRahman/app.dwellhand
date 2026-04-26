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
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center pointer-events-none">
          <div className="glass px-6 py-3 rounded-2xl pointer-events-auto">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Interactive Permit Explorer
            </h1>
            <p className="text-[10px] uppercase font-bold tracking-widest text-primary">
              Los Angeles Metropolitan Area
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
