import React from 'react';

export default function SkeletonCard() {
  return (
    <div className="p-4 border-b border-surface-container-high/50 cursor-default pointer-events-none">
      <div className="flex items-start justify-between gap-2 animate-pulse">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="h-4 bg-surface-container-high rounded w-32"></div>
          <div className="h-4 bg-surface-container-high rounded w-16"></div>
        </div>
        <div className="h-4 bg-surface-container-high rounded w-12"></div>
      </div>
      <div className="mt-2 animate-pulse">
        <div className="h-5 bg-surface-container-high rounded w-3/4 mb-1.5"></div>
        <div className="h-4 bg-surface-container-high rounded w-1/2"></div>
      </div>
      <div className="mt-2.5 flex items-center gap-1 animate-pulse">
        <div className="w-4 h-4 bg-surface-container-high rounded-full"></div>
        <div className="h-3 bg-surface-container-high rounded w-2/3"></div>
      </div>
      <div className="mt-3 pt-1.5 flex items-center gap-2 animate-pulse">
        <div className="h-4 bg-surface-container-high rounded w-24"></div>
      </div>
    </div>
  );
}
