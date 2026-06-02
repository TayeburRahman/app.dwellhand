import { createClient } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();
  const email = 'melodymclaire@gmail.com';
  const password = 'melodymclaire';

  // 1. Try to create the user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'enterprise'
      }
    }
  });

  if (signUpError) {
    // 2. If user exists, try to update their metadata
    console.log('User might already exist, attempting update...');
    
    // Note: In a production app, you'd use the admin API to update another user.
    // For this debug route, we assume the person visiting it IS the test user or we just want to ensure the metadata exists.
    // Since we can't easily update another user's metadata without service role, 
    // we'll just advise the user to sign up via the UI if this fails.
    
    return NextResponse.json({ 
      error: signUpError.message,
      message: "If 'User already registered', please use the standard /signup page, then let me know and I will force the role via a manual script."
    }, { status: 400 });
  }

  return NextResponse.json({ 
    message: 'User created successfully with commercial role!',
    user: signUpData.user
  });
}
