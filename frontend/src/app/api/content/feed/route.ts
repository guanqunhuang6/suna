import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ContentFeedResponse } from '@/types/content';

// Cache URLs in memory to avoid hitting backend every time
let cachedUrls: any[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute cache

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export async function GET() {
  try {
    // Get auth session using Supabase server client (same pattern as api.ts)
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

    // Check if we need to refresh the cache
    const now = Date.now();
    if (cachedUrls.length === 0 || now - lastFetchTime > CACHE_DURATION) {
      // Call backend API to get URLs (same pattern as api.ts)
      const response = await fetch(`${API_URL}/url-feed`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json();
      cachedUrls = data.urls || [];
      lastFetchTime = now;
    }
    
    // If no URLs available, return empty
    if (cachedUrls.length === 0) {
      return NextResponse.json({
        contents: [],
      });
    }

    // Return all URLs transformed to the expected format
    const feedResponse: ContentFeedResponse = {
      contents: cachedUrls.map(urlData => ({
        id: urlData.id || `content-${Date.now()}-${Math.random()}`,
        url: urlData.url,
      })),
    };

    return NextResponse.json(feedResponse);
  } catch (error) {
    console.error('Error in content feed API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}