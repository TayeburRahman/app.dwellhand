'use client';

import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'free',
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.push('/login'), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md animate-in">
        <Card className="border-border shadow-sm bg-white">
          <CardHeader className="space-y-2 text-center pb-6">
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">
              Create an account
            </CardTitle>
            <CardDescription className="text-slate-500 text-base">
              Enter your email below to create your account
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="text-center py-6">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Check your email</h3>
                <p className="text-slate-600">We've sent you a verification link.</p>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    className="bg-white"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-semibold" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign up'}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
