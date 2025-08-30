import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export async function POST(request: Request) {
  try {
    // Get auth session using Supabase server client
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!API_URL) {
      throw new Error(
        'Backend URL is not configured. Set NEXT_PUBLIC_BACKEND_URL in your environment.',
      );
    }

    // Get request body
    const body = await request.json();
    
    // Call backend API to upload image
    const response = await fetch(`${API_URL}/images/upload-base64`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend upload error:', errorText);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in image upload API:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}