'use client';

import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavigationArrowsProps {
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  canNavigateUp: boolean;
  canNavigateDown: boolean;
  onCreateClick?: () => void;
  className?: string;
}

export function NavigationArrows({
  onNavigateUp,
  onNavigateDown,
  canNavigateUp,
  canNavigateDown,
  onCreateClick,
  className
}: NavigationArrowsProps) {
  const [clickedButton, setClickedButton] = useState<string | null>(null);

  const handleClick = (action: () => void, buttonName: string) => {
    setClickedButton(buttonName);
    action();
    setTimeout(() => setClickedButton(null), 300);
  };

  return (
    <div className={cn("fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 sm:gap-8", className)}
         style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
      {/* Up Arrow */}
      <button
        onClick={() => handleClick(onNavigateUp, 'up')}
        disabled={!canNavigateUp}
        className={cn(
          "group relative p-3 sm:p-4 rounded-full",
          "bg-white/10 backdrop-blur-md",
          "border border-white/20",
          "transition-all duration-300 ease-out",
          "hover:bg-white/20",
          "active:scale-75",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          "shadow-lg shadow-black/20",
          clickedButton === 'up' && "animate-pulse scale-110 bg-white/30"
        )}
        aria-label="Previous content"
      >
        <ChevronUp 
          className={cn(
            "w-6 h-6 text-white",
            "transition-transform duration-300",
            clickedButton === 'up' && "animate-bounce"
          )} 
        />
        {clickedButton === 'up' && (
          <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
        )}
      </button>

      {/* Create Button (center) */}
      <button 
        className={cn(
          "group relative p-3 sm:p-4 rounded-full",
          "bg-gradient-to-r from-purple-600 to-blue-600",
          "text-white font-semibold",
          "shadow-xl shadow-purple-500/25",
          "hover:shadow-2xl hover:shadow-purple-500/30",
          "transform hover:scale-110",
          "transition-all duration-300",
          "border border-white/20",
          "active:scale-75",
          clickedButton === 'create' && "animate-pulse scale-125"
        )}
        onClick={() => handleClick(() => onCreateClick?.(), 'create')}
      >
        <Plus className={cn(
          "w-6 h-6",
          clickedButton === 'create' && "animate-spin"
        )} />
        {clickedButton === 'create' && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-blue-400 animate-ping" />
        )}
      </button>

      {/* Down Arrow */}
      <button
        onClick={() => handleClick(onNavigateDown, 'down')}
        disabled={!canNavigateDown}
        className={cn(
          "group relative p-3 sm:p-4 rounded-full",
          "bg-white/10 backdrop-blur-md",
          "border border-white/20",
          "transition-all duration-300 ease-out",
          "hover:bg-white/20",
          "active:scale-75",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          "shadow-lg shadow-black/20",
          clickedButton === 'down' && "animate-pulse scale-110 bg-white/30"
        )}
        aria-label="Next content"
      >
        <ChevronDown 
          className={cn(
            "w-6 h-6 text-white",
            "transition-transform duration-300",
            clickedButton === 'down' && "animate-bounce"
          )} 
        />
        {clickedButton === 'down' && (
          <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
        )}
      </button>
    </div>
  );
}