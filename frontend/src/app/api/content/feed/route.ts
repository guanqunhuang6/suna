import { NextResponse } from 'next/server';
import type { ContentFeedResponse } from '@/types/content';

// Two URLs to cycle through
const CONTENT_URLS = [
  'https://3e94b6bc-aca7-4d59-b2b1-55d7ae2789bd-hello-world.pages.dev',
  'https://d84ec0d7-91c0-470a-a9dc-4dd64cc0e7e7-hello-world.pages.dev',
];

// Track current index (in memory, resets on server restart)
let currentIndex = 0;

export async function GET() {
  try {
    // Return one link at a time, cycling through the array
    const url = CONTENT_URLS[currentIndex];
    currentIndex = (currentIndex + 1) % CONTENT_URLS.length;
    
    const response: ContentFeedResponse = {
      contents: [{
        id: `content-${Date.now()}`,
        url: url,
      }],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in content feed API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}