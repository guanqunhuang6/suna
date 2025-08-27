'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ContentItem } from '@/types/content';

interface HTMLContentViewerProps {
  content: ContentItem | null;
  isActive: boolean;
  preload?: boolean;
  className?: string;
}

export function HTMLContentViewer({ 
  content, 
  isActive, 
  preload = false,
  className 
}: HTMLContentViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (content) {
      console.log('Displaying content:', content.url);
    }
  }, [content]);

  if (!content) {
    return (
      <div className={cn(
        "flex items-center justify-center w-full h-full",
        "bg-black",
        className
      )}>
        <div className="text-white/60 text-lg">No content available</div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative w-full h-full flex items-center justify-center",
      "bg-black",
      className
    )}>
      {/* Content container - responsive height for mobile browsers */}
      <div className="relative w-full h-[66dvh] sm:h-[75vh] px-4 sm:px-8">
        {/* iframe container with rounded corners */}
        <div className={cn(
          "w-full h-full rounded-2xl overflow-hidden",
          isActive ? "block" : "hidden"
        )}>
          <iframe
            ref={iframeRef}
            src={content.url}
            className="w-full h-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            loading="eager"
            style={{
              border: 'none',
              display: 'block'
            }}
          />
        </div>

        {/* Decorative elements removed for cleaner black background */}
      </div>
    </div>
  );
}