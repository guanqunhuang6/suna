'use client';

import { cn } from '@/lib/utils';

interface LoadingIndicatorProps {
  className?: string;
}

export function LoadingIndicator({ className }: LoadingIndicatorProps) {
  return (
    <div className={cn(
      "fixed inset-0 flex items-center justify-center",
      "bg-black",
      className
    )}>
      <div className="flex flex-col items-center gap-6">
        {/* Animated loader */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-white/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-purple-400 animate-spin-slow" />
        </div>
        
        {/* Loading text */}
        <div className="text-center">
          <h2 className="text-white font-semibold text-lg mb-2">Loading Content</h2>
          <p className="text-white/60 text-sm">Preparing your experience...</p>
        </div>

        {/* Loading dots */}
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}