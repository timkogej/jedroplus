"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Modal from "./Modal";
import { checkColumnExists, detectIdColumn } from "@/lib/tableIntrospection";
import { getCompanyColumnForTable } from "@/lib/companyScope";

type PartnerDialogProps = {
  partner?: Record<string, unknown> | null;
  companyId: string;
  tableName: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  isLoading: boolean;
};

type ColumnMap = {
  id?: string;
  name?: string;
  type?: string;
  email?: string;
  phone?: string;
  notes?: string;
  active?: string;
  roles?: string;
};

export default function PartnerDialog({
  partner,
  companyId,
  tableName,
  onClose,
  onSave,
  isLoading,
}: PartnerDialogProps) {
  const [columns, setColumns] = useState<ColumnMap>({});
  const [name, setName] = useState("");
  const [type, setType] = useState("Ekipa");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [roles, setRoles] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const loadColumns = async () => {
      const exists = async (col: string) => checkColumnExists(tableName, col);
      const map: ColumnMap = {};
      map.id = (await detectIdColumn(tableName, [
        "partner_id",
        "person_id",
        "ID osebe",
        "ID Osebe",
        "oseba_id",
      ])) ?? undefined;
      map.name = (await exists("name"))
        ? "name"
        : (await exists("Ime"))
        ? "Ime"
        : (await exists("Oseba"))
        ? "Oseba"
        : undefined;
      map.type = (await exists("person_type"))
        ? "person_type"
        : (await exists("Tip"))
        ? "Tip"
        : (await exists("Vrsta"))
        ? "Vrsta"
        : undefined;
      map.email = (await exists("email"))
        ? "email"
        : (await exists("Email"))
        ? "Email"
        : undefined;
      map.phone = (await exists("phone"))
        ? "phone"
        : (await exists("Telefon"))
        ? "Telefon"
        : undefined;
      map.notes = (await exists("notes"))
        ? "notes"
        : (await exists("Opombe"))
        ? "Opombe"
        : undefined;
      map.active = (await exists("active"))
        ? "active"
        : (await exists("Aktivno"))
        ? "Aktivno"
        : undefined;
      map.roles = (await exists("roles"))
        ? "roles"
        : (await exists("Vloge"))
        ? "Vloge"
        : undefined;
      setColumns(map);
    };
    loadColumns();
  }, [tableName]);

  useEffect(() => {
    if (!partner) return;
    if (columns.name) setName(String(partner[columns.name] ?? ""));
    if (columns.type) setType(String(partner[columns.type] ?? "Ekipa"));
    if (columns.email) setEmail(String(partner[columns.email] ?? ""));
    if (columns.phone) setPhone(String(partner[columns.phone] ?? ""));
    if (columns.notes) setNotes(String(partner[columns.notes] ?? ""));
    else if (partner.notes) setNotes(String(partner.notes ?? ""));
    if (columns.roles) setRoles(String(partner[columns.roles] ?? ""));
    if (columns.active) setActive(Boolean(partner[columns.active]));
  }, [partner, columns]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (localLoading || isLoading) return;
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setLocalLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      payload[await getCompanyColumnForTable(tableName, companyId)] = companyId;
      if (columns.name) payload[columns.name] = name.trim();
      if (columns.type) payload[columns.type] = type;
      payload.person_type = type;
      if (columns.email && email) payload[columns.email] = email.trim();
      if (columns.phone && phone) payload[columns.phone] = phone.trim();
      payload.phone = phone.trim() || null;
      if (columns.notes) payload[columns.notes] = notes.trim();
      payload.notes = notes.trim() || null;
      if (columns.roles && roles) payload[columns.roles] = roles.trim();
      if (columns.active) payload[columns.active] = active;
      await onSave(payload);
    } catch (err) {
      setError("Prišlo je do napake pri shranjevanju.");
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <Modal
      open
      title={partner ? "Edit person" : "Add person"}
      onClose={onClose}
    >
      <form className="flex flex-col gap-3 text-xs uppercase" onSubmit={handleSubmit}>
        {error ? (
          <p className="border border-black px-3 py-2 text-xs uppercase text-red-600">
            {error}
          </p>
        ) : null}
        <input
          className="border border-black px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <select
          className="border border-black px-3 py-2"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="Ekipa">Ekipa</option>
          <option value="Zunanji">Zunanji</option>
          <option value="Dobavitelj">Dobavitelj</option>
          <option value="Ostalo">Ostalo</option>
        </select>
        <input
          className="border border-black px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="border border-black px-3 py-2"
          placeholder="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <textarea
          className="border border-black px-3 py-2"
          placeholder="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
        />
        <input
          className="border border-black px-3 py-2"
          placeholder="Roles (comma separated)"
          value={roles}
          onChange={(event) => setRoles(event.target.value)}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>
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
