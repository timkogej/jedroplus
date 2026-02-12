"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type EditBookingDialogProps = {
  open: boolean;
  initial: {
    date?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    notes?: string;
  };
  onClose: () => void;
  onSubmit: (payload: {
    date?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    notes?: string;
  }) => Promise<void>;
};

export default function EditBookingDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: EditBookingDialogProps) {
  const [date, setDate] = useState(initial.date ?? "");
  const [startTime, setStartTime] = useState(initial.startTime ?? "");
  const [endTime, setEndTime] = useState(initial.endTime ?? "");
  const [status, setStatus] = useState(initial.status ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    await onSubmit({ date, startTime, endTime, status, notes });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-4">
      <div className="w-full max-w-md border border-black bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            Edit booking
          </h2>
          <button
            type="button"
            className="border border-black px-2 py-1 text-xs uppercase"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            className="border border-black px-3 py-2 text-sm uppercase"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <input
            className="border border-black px-3 py-2 text-sm uppercase"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
          <input
            className="border border-black px-3 py-2 text-sm uppercase"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
          <input
            className="border border-black px-3 py-2 text-sm uppercase"
            placeholder="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
          <textarea
            className="border border-black px-3 py-2 text-sm uppercase"
            placeholder="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
          />
          <button
            type="submit"
            disabled={loading}
            className="border border-black px-3 py-2 text-xs uppercase tracking-widest"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
