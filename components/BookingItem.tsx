"use client";

type BookingItemProps = {
  timeLabel: string;
  clientLabel: string;
  serviceLabel: string;
  statusLabel: string;
  onComplete: () => void;
  onNoShow: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function BookingItem({
  timeLabel,
  clientLabel,
  serviceLabel,
  statusLabel,
  onComplete,
  onNoShow,
  onCancel,
  onEdit,
  onDelete,
}: BookingItemProps) {
  return (
    <div className="flex flex-col gap-3 border border-black p-4 text-xs uppercase">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{timeLabel}</span>
        <span>{statusLabel}</span>
      </div>
      <div className="flex flex-wrap gap-4">
        <span>Stranka: {clientLabel}</span>
        <span>Storitev: {serviceLabel}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="border border-black px-2 py-1"
          onClick={onComplete}
        >
          Complete
        </button>
        <button
          type="button"
          className="border border-black px-2 py-1"
          onClick={onNoShow}
        >
          No show
        </button>
        <button
          type="button"
          className="border border-black px-2 py-1"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="border border-black px-2 py-1"
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="border border-black px-2 py-1"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
