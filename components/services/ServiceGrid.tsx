'use client';

import { memo } from 'react';
import type { Service } from '@/types/services';
import ServiceCard, { ServiceCardSkeleton } from './ServiceCard';

interface ServiceGridProps {
  services: Service[];
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onToggleActive: (service: Service) => void;
  isLoading?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

function ServiceGrid({
  services,
  onEdit,
  onDelete,
  onToggleActive,
  isLoading = false,
  canEdit = true,
  canDelete = true,
}: ServiceGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <ServiceCardSkeleton key={index} index={index} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {services.map((service, index) => (
        <ServiceCard
          key={service.id}
          service={service}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
          index={index}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}
    </div>
  );
}

export default memo(ServiceGrid);
