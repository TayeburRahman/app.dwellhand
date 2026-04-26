'use client';

import { Bell, Search, User } from 'lucide-react';
import { Input } from './ui/input';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

const fetchUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export function Navbar() {
  const { data: user, isLoading } = useSWR('user_settings', fetchUser, {
    revalidateOnFocus: false,
    dedupingInterval: 300000 // Sharing cache with settings page!
  });

  const getInitials = () => {
    if (isLoading) return '...';
    if (!user) return 'U';
    const fullName = user.user_metadata?.full_name;
    if (fullName && fullName.trim().length > 0) {
      return fullName.trim().charAt(0).toUpperCase();
    }
    return user.email ? user.email.charAt(0).toUpperCase() : 'U';
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/50 backdrop-blur-md sticky top-0 z-30 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search permits by address or number..." 
            className="pl-10 bg-slate-100/50 border-none focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/20">
          {getInitials()}
        </div>
      </div>
    </header>
  );
}
