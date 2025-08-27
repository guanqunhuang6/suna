'use client';

import { useEffect, useCallback } from 'react';
import { useContentQueueStore } from '@/lib/stores/content/content-queue-store';
import { HTMLContentViewer } from './HTMLContentViewer';
import { NavigationArrows } from './NavigationArrows';
import { LoadingIndicator } from './LoadingIndicator';
import { ContentPreloader } from './ContentPreloader';
import { cn } from '@/lib/utils';

interface ContentFeedContainerProps {
  className?: string;
}

export function ContentFeedContainer({ className }: ContentFeedContainerProps) {
  const {
    contentQueue,
    currentIndex,
    isLoading,
    navigateNext,
    navigatePrevious,
    initializeContent,
  } = useContentQueueStore();

  // Initialize content on mount
  useEffect(() => {
    console.log('Initializing content feed...');
    initializeContent();
  }, [initializeContent]);
  
  // Log content queue changes
  useEffect(() => {
    console.log('Content queue updated:', contentQueue);
    console.log('Current index:', currentIndex);
  }, [contentQueue, currentIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        navigatePrevious();
        break;
      case 'ArrowDown':
        event.preventDefault();
        navigateNext();
        break;
    }
  }, [navigateNext, navigatePrevious]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Navigation state
  const canNavigateUp = currentIndex > 0;
  const canNavigateDown = currentIndex < contentQueue.length - 1;
  const currentContent = contentQueue[currentIndex] || null;
  const nextContent = contentQueue[currentIndex + 1] || null;
  const prevContent = contentQueue[currentIndex - 1] || null;

  if (isLoading && contentQueue.length === 0) {
    return <LoadingIndicator className={className} />;
  }

  return (
    <div className={cn(
      "fixed inset-0 overflow-hidden",
      "bg-black",
      className
    )}>
      {/* Background decoration - removed for cleaner black background */}

      {/* Main content viewer */}
      <div className="relative w-full h-full">
        {currentContent && (
          <HTMLContentViewer
            content={currentContent}
            isActive={true}
            className="absolute inset-0"
          />
        )}
      </div>

      {/* Navigation moved to bottom */}

      {/* Content preloader (invisible) */}
      <ContentPreloader />

      {/* Kacha Logo */}
      <div className="fixed left-4 sm:left-8 z-50"
           style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))' }}>
        <h1 className="text-white font-bold text-xl sm:text-2xl tracking-tight">
          Kacha
        </h1>
      </div>

      {/* Bottom navigation bar */}
      <NavigationArrows
        onNavigateUp={navigatePrevious}
        onNavigateDown={navigateNext}
        canNavigateUp={canNavigateUp}
        canNavigateDown={canNavigateDown}
      />
    </div>
  );
}