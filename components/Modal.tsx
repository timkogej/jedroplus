"use client";

import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-4">
      <div className="w-full max-w-2xl border border-black bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            {title}
          </h2>
          <button
            type="button"
            className="border border-black px-2 py-1 text-xs uppercase"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
