'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import type { Service } from '@/types/services';
import ServiceCard, { ServiceCardSkeleton } from './ServiceCard';

interface ServiceGridProps {
  services: Service[];
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onToggleActive: (service: Service) => void;
  isLoading?: boolean;
}

function ServiceGrid({
  services,
  onEdit,
  onDelete,
  onToggleActive,
  isLoading = false,
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
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
        />
      ))}
    </motion.div>
  );
}

export default memo(ServiceGrid);
