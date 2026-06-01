import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const license = searchParams.get('license')?.trim();

  if (!license) {
    return NextResponse.json({ error: 'License required' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from('builder_intelligence_test')
    .select('*')
    .eq('contractor_license', license)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: profile ?? null });
}
