"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Modal from "./Modal";
import { checkColumnExists } from "@/lib/tableIntrospection";

type PersonSettingsDialogProps = {
  partner: Record<string, unknown>;
  tableName: string;
  services: Record<string, unknown>[];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  isLoading: boolean;
};

type ColumnMap = {
  schedule?: string;
  services?: string;
  permissions?: string;
};

export default function PersonSettingsDialog({
  partner,
  tableName,
  services,
  onClose,
  onSave,
  isLoading,
}: PersonSettingsDialogProps) {
  const [columns, setColumns] = useState<ColumnMap>({});
  const [schedule, setSchedule] = useState("");
  const [servicesValue, setServicesValue] = useState("");
  const [permissions, setPermissions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const loadColumns = async () => {
      const exists = async (col: string) => checkColumnExists(tableName, col);
      const map: ColumnMap = {};
      map.schedule = (await exists("person_schedule"))
        ? "person_schedule"
        : (await exists("Urnik"))
        ? "Urnik"
        : undefined;
      map.services = (await exists("person_services"))
        ? "person_services"
        : (await exists("Storitve"))
        ? "Storitve"
        : undefined;
      map.permissions = (await exists("person_permissions"))
        ? "person_permissions"
        : undefined;
      setColumns(map);
    };
    loadColumns();
  }, [tableName]);

  useEffect(() => {
    if (columns.schedule) {
      setSchedule(String(partner[columns.schedule] ?? ""));
    }
    if (columns.services) {
      setServicesValue(String(partner[columns.services] ?? ""));
    }
    if (columns.permissions) {
      setPermissions(String(partner[columns.permissions] ?? ""));
    }
  }, [partner, columns]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (localLoading || isLoading) return;
    setError(null);
    setLocalLoading(true);
    try {
      const parsedServices = servicesValue
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {};
      if (columns.schedule) payload[columns.schedule] = schedule;
      if (columns.services)
        payload[columns.services] = parsedServices.length
          ? parsedServices.join(",")
          : "";
      if (columns.permissions) payload[columns.permissions] = permissions;
      payload.person_schedule = schedule || null;
      payload.person_services = parsedServices.length ? parsedServices : null;
      payload.person_permissions = permissions || null;
      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLocalLoading(false);
    }
  };

  const serviceOptions = services
    .map((row) => {
      const label = String(
        row["Naziv"] ?? row["Storitev"] ?? row["name"] ?? ""
      ).trim();
      const value = String(
        row.service_id ?? row["ID storitve"] ?? row["ID_storitve"] ?? row.id ?? ""
      ).trim();
      return { label, value: value || label };
    })
    .filter((option) => option.label);

  return (
    <Modal open title="Person settings" onClose={onClose}>
      <form className="flex flex-col gap-3 text-xs uppercase" onSubmit={handleSubmit}>
        {error ? (
          <p className="border border-black px-3 py-2 text-xs uppercase text-red-600">
            {error}
          </p>
        ) : null}
        {columns.schedule ? (
          <textarea
            className="border border-black px-3 py-2"
            placeholder="Schedule"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
            rows={4}
          />
        ) : null}
        {columns.services ? (
          <>
            <select
              className="border border-black px-3 py-2"
              value={servicesValue}
              onChange={(event) => setServicesValue(event.target.value)}
            >
              <option value="">Services (select)</option>
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="border border-black px-3 py-2"
              placeholder="Services (IDs comma separated)"
              value={servicesValue}
              onChange={(event) => setServicesValue(event.target.value)}
            />
          </>
        ) : null}
        {columns.permissions ? (
          <textarea
            className="border border-black px-3 py-2"
            placeholder="Permissions"
            value={permissions}
            onChange={(event) => setPermissions(event.target.value)}
            rows={3}
          />
        ) : null}
        <button
          type="submit"
          disabled={isLoading || localLoading}
          className="border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
        >
          {isLoading || localLoading ? "Saving..." : "Save"}
        </button>
      </form>
    </Modal>
  );
}
