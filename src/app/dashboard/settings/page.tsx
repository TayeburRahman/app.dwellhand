'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Loader2, Check } from 'lucide-react';

const supabase = createClient();

const fetchUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export default function SettingsPage() {
  const { data: user, mutate, isLoading } = useSWR('user_settings', fetchUser, {
    revalidateOnFocus: false,
    dedupingInterval: 300000 // Cache for 5 minutes
  });

  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Account Deletion States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const router = useRouter();

  // Sync internal state when SWR returns the user data
  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Update Supabase Auth user metadata
    const { data: updateData, error } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    });

    setLoading(false);
    
    if (!error && updateData?.user) {
      // Immediately update the SWR cache with the newly updated user!
      mutate(updateData.user, false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'delete') return;
    setIsDeleting(true);
    
    // Deleting a user requires backend processing with a Service Role Key.
    // For this prototype, we simulate deletion by revoking their session.
    await new Promise(resolve => setTimeout(resolve, 1500));
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="space-y-6 animate-in max-w-4xl pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-2">Manage your account settings and preferences.</p>
      </div>

      <div className="space-y-6">
        <Card className="shadow-sm border-border bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-slate-900">Profile</CardTitle>
            <CardDescription className="text-slate-500">Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700">Full Name</Label>
                  {isLoading ? (
                    <div className="h-10 w-full bg-slate-100 rounded-md animate-pulse" />
                  ) : (
                    <Input 
                      id="name"
                      placeholder="e.g. John Doe" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-white"
                      disabled={loading}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700">Email Address</Label>
                  {isLoading ? (
                    <div className="h-10 w-full bg-slate-100 rounded-md animate-pulse" />
                  ) : (
                    <Input 
                      id="email"
                      type="email" 
                      value={user?.email || ''} 
                      disabled
                      className="bg-slate-50 text-slate-500"
                    />
                  )}
                  <p className="text-xs text-slate-500">Email cannot be changed right now.</p>
                </div>
              </div>
              
              <div className="flex justify-end pt-2">
                <Button 
                  type="submit" 
                  disabled={loading || isLoading}
                  className={saved ? "bg-green-600 hover:bg-green-700 font-medium" : "font-medium"}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                   saved ? <Check className="w-4 h-4 mr-2" /> : 
                   <Save className="w-4 h-4 mr-2" />}
                  {saved ? 'Saved' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-red-100 bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-red-600">Danger Zone</CardTitle>
            <CardDescription className="text-slate-500">Permanently delete your account and all associated data.</CardDescription>
          </CardHeader>
          <CardContent>
            {!showDeleteConfirm ? (
              <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" className="font-medium" disabled={isLoading}>
                Delete Account
              </Button>
            ) : (
              <div className="space-y-4 animate-in">
                <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-md border border-red-100">
                  This action cannot be undone. All data will be permanently removed. <br className="hidden md:block"/>
                  Please type <span className="font-bold">delete</span> to confirm.
                </p>
                <Input 
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type 'delete'"
                  className="bg-white border-red-200 focus-visible:ring-red-500 max-w-sm"
                />
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteInput('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    disabled={deleteInput !== 'delete' || isDeleting}
                    onClick={handleDeleteAccount}
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Confirm Deletion
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
