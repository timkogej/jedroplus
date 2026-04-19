"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { SpinnerGap } from "@phosphor-icons/react";

type QuickBookingModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    client: string;
    date: string;
    startTime: string;
    endTime: string;
    service: string;
    notes: string;
  }) => Promise<void>;
};

export default function QuickBookingModal({
  open,
  onClose,
  onSubmit,
}: QuickBookingModalProps) {
  const [client, setClient] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    await onSubmit({ client, date, startTime, endTime, service, notes });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-4">
      <div className="w-full max-w-lg border border-black bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            New booking
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
            placeholder="Client"
            value={client}
            onChange={(event) => setClient(event.target.value)}
          />
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
            placeholder="Service"
            value={service}
            onChange={(event) => setService(event.target.value)}
          />
          <textarea
            className="border border-black px-3 py-2 text-sm uppercase"
            placeholder="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
          >
            {loading && <SpinnerGap className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Saving..." : "Create booking"}
          </button>
        </form>
      </div>
    </div>
  );
}
