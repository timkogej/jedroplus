"use client";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
};

export default function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="border border-black p-4">
      <p className="text-xs uppercase tracking-widest">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {subtitle ? (
        <p className="mt-2 text-xs uppercase tracking-widest">{subtitle}</p>
      ) : null}
    </div>
  );
}
