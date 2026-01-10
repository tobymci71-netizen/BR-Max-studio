import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    
    const { data, error } = await supabaseAdmin
      .from('token_packages')
      .select('*')
      .order('priceUSD', { ascending: true });

    if (error) {
      console.error('Error fetching token packages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch token packages' },
        { status: 500 }
      );
    }

    return NextResponse.json({ packages: data || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}