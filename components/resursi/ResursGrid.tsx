'use client';

import { memo } from 'react';
import type { Resurs } from '@/types/resursi';
import ResursCard, { ResursCardSkeleton } from './ResursCard';

interface ResursGridProps {
  resursi: Resurs[];
  onEdit: (r: Resurs) => void;
  onDelete: (r: Resurs) => void;
  onToggleActive: (r: Resurs) => void;
  isLoading?: boolean;
}

function ResursGrid({ resursi, onEdit, onDelete, onToggleActive, isLoading = false }: ResursGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ResursCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {resursi.map((r, i) => (
        <ResursCard
          key={r.id}
          resurs={r}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
          index={i}
        />
      ))}
    </div>
  );
}

export default memo(ResursGrid);
