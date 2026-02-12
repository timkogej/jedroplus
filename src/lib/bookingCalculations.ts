type Discount = {
  enabled: boolean;
  type: "EUR" | "PERCENT";
  value: number;
};

type ServiceInput = {
  total_duration_min?: number | null;
  duration_min?: number | null;
  buffer_before_min?: number | null;
  buffer_after_min?: number | null;
  price?: number | null;
  price_type?: string | null;
};

export function computeTotalDurationMin(services: ServiceInput[]): number {
  return services.reduce((sum, service) => {
    const duration =
      Number(service.total_duration_min) ||
      (Number(service.duration_min) || 0) +
        (Number(service.buffer_before_min) || 0) +
        (Number(service.buffer_after_min) || 0);
    return sum + duration;
  }, 0);
}

export function computeBaseTotalPrice(
  services: ServiceInput[],
  manualOverride?: number | null
): number {
  if (typeof manualOverride === "number") {
    return manualOverride;
  }
  return services.reduce((sum, service) => sum + (service.price ?? 0), 0);
}

export function computeDiscountAmount(base: number, discount: Discount): number {
  if (!discount.enabled || discount.value <= 0) return 0;
  if (discount.type === "EUR") {
    return Math.min(base, discount.value);
  }
  return Math.min(base, base * (discount.value / 100));
}

export function computeFinalTotalPrice(base: number, discount: Discount): number {
  return Math.max(0, base - computeDiscountAmount(base, discount));
}

export function buildStartEndISO(
  startDate: string,
  startTime: string,
  endTime: string
): { start_at: string | null; end_at: string | null } {
  if (!startDate || !startTime || !endTime) {
    return { start_at: null, end_at: null };
  }
  const start = new Date(`${startDate}T${startTime}:00`);
  if (Number.isNaN(start.getTime())) {
    return { start_at: null, end_at: null };
  }
  const endDate =
    endTime < startTime
      ? new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000)
      : new Date(startDate);
  const end = new Date(
    `${endDate.toISOString().slice(0, 10)}T${endTime}:00`
  );
  return {
    start_at: start.toISOString(),
    end_at: Number.isNaN(end.getTime()) ? null : end.toISOString(),
  };
}
