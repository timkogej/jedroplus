"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type CompleteBookingDialogProps = {
  open: boolean;
  summary: string;
  onClose: () => void;
  onSubmit: (notes: string) => Promise<void>;
};

export default function CompleteBookingDialog({
  open,
  summary,
  onClose,
  onSubmit,
}: CompleteBookingDialogProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    await onSubmit(notes);
    setLoading(false);
    setNotes("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-4">
      <div className="w-full max-w-md border border-black bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            Complete booking
          </h2>
          <button
            type="button"
            className="border border-black px-2 py-1 text-xs uppercase"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mt-3 text-xs uppercase">{summary}</p>
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
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
            {loading ? "Saving..." : "Complete"}
          </button>
        </form>
      </div>
    </div>
  );
}
