'use client';

import { useEffect } from 'react';
import { useContentQueueStore } from '@/lib/stores/content/content-queue-store';

export function ContentPreloader() {
  const { 
    contentQueue, 
    currentIndex, 
    preloadThreshold, 
    fetchMoreContent,
    isFetchingMore 
  } = useContentQueueStore();

  useEffect(() => {
    // Check if we need to fetch more content
    const remainingContent = contentQueue.length - currentIndex - 1;
    
    if (remainingContent < preloadThreshold && !isFetchingMore && contentQueue.length > 0) {
      console.log('Triggering content preload, remaining:', remainingContent);
      fetchMoreContent();
    }
  }, [currentIndex, contentQueue.length, preloadThreshold, fetchMoreContent, isFetchingMore]);

  // This component doesn't render anything visible
  return null;
}