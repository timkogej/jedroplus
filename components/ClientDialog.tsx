"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "./Modal";
import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";
import { getCompanyColumnForTable } from "@/lib/companyScope";
import {
  checkColumnExists,
  detectIdColumn,
  getNextPrefixedId,
} from "@/lib/tableIntrospection";
import { getRandomGradient } from "@/lib/constants/serviceGradients";

type ClientDialogProps = {
  client?: Record<string, unknown> | null;
  companyId: string;
  tableName: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  isLoading: boolean;
};

type ColumnMap = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  status?: string;
  notes?: string;
  lastInteraction?: string;
  tags?: string;
  custom?: string;
  barva?: string; // Client color (gradient CSS string)
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ClientDialog({
  client,
  companyId,
  tableName,
  onClose,
  onSave,
  isLoading,
}: ClientDialogProps) {
  const [columns, setColumns] = useState<ColumnMap>({});
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const [firstName, setFirstName] = useState(
    client && columns.firstName ? String(client[columns.firstName] ?? "") : ""
  );
  const [lastName, setLastName] = useState(
    client && columns.lastName ? String(client[columns.lastName] ?? "") : ""
  );
  const [fullName, setFullName] = useState(
    client && columns.fullName ? String(client[columns.fullName] ?? "") : ""
  );
  const [email, setEmail] = useState(
    client && columns.email ? String(client[columns.email] ?? "") : ""
  );
  const [phone, setPhone] = useState(
    client && columns.phone ? String(client[columns.phone] ?? "") : ""
  );
  const [gender, setGender] = useState(
    client && columns.gender ? String(client[columns.gender] ?? "") : ""
  );
  const [status, setStatus] = useState(
    client && columns.status ? String(client[columns.status] ?? "") : "Aktiven"
  );
  const [notes, setNotes] = useState(
    client && columns.notes ? String(client[columns.notes] ?? "") : ""
  );
  const [tags, setTags] = useState(
    client && columns.tags ? String(client[columns.tags] ?? "") : ""
  );
  const [custom, setCustom] = useState(
    client && columns.custom ? JSON.stringify(client[columns.custom], null, 2) : ""
  );

  useEffect(() => {
    const loadColumns = async () => {
      const exists = async (name: string) => checkColumnExists(tableName, name);
      const map: ColumnMap = {};
      if (await exists("Ime")) map.firstName = "Ime";
      if (await exists("Priimek")) map.lastName = "Priimek";
      if (await exists("Stranka")) map.fullName = "Stranka";
      if (!map.fullName && (await exists("Naziv"))) map.fullName = "Naziv";
      map.email = (await exists("Email stranke"))
        ? "Email stranke"
        : (await exists("to_email"))
        ? "to_email"
        : (await exists("Email"))
        ? "Email"
        : undefined;
      map.phone = (await exists("Telefonska šte"))
        ? "Telefonska šte"
        : (await exists("Telefon"))
        ? "Telefon"
        : (await exists("phone"))
        ? "phone"
        : undefined;
      map.gender = (await exists("Spol"))
        ? "Spol"
        : (await exists("gender"))
        ? "gender"
        : undefined;
      map.status = (await exists("Status"))
        ? "Status"
        : (await exists("status"))
        ? "status"
        : undefined;
      map.notes = (await exists("Opombe strank"))
        ? "Opombe strank"
        : (await exists("notes"))
        ? "notes"
        : undefined;
      map.lastInteraction = (await exists("Zadnja interakc"))
        ? "Zadnja interakc"
        : (await exists("last_interaction"))
        ? "last_interaction"
        : undefined;
      map.tags = (await exists("tags"))
        ? "tags"
        : (await exists("Tags"))
        ? "Tags"
        : undefined;
      map.custom = (await exists("custom"))
        ? "custom"
        : (await exists("Custom"))
        ? "Custom"
        : undefined;
      map.barva = (await exists("Barva"))
        ? "Barva"
        : (await exists("barva"))
        ? "barva"
        : undefined;
      setColumns(map);
    };
    loadColumns();
  }, [tableName]);

  useEffect(() => {
    if (!client) return;
    if (columns.firstName) {
      setFirstName(String(client[columns.firstName] ?? ""));
    }
    if (columns.lastName) {
      setLastName(String(client[columns.lastName] ?? ""));
    }
    if (columns.fullName) {
      setFullName(String(client[columns.fullName] ?? ""));
    }
    if (columns.email) {
      setEmail(String(client[columns.email] ?? ""));
    }
    if (columns.phone) {
      setPhone(String(client[columns.phone] ?? ""));
    }
    if (columns.gender) {
      setGender(String(client[columns.gender] ?? ""));
    }
    if (columns.status) {
      setStatus(String(client[columns.status] ?? "Aktiven"));
    }
    if (columns.notes) {
      setNotes(String(client[columns.notes] ?? ""));
    }
    if (columns.tags) {
      setTags(String(client[columns.tags] ?? ""));
    }
    if (columns.custom) {
      setCustom(JSON.stringify(client[columns.custom], null, 2));
    }
  }, [client, columns]);

  const statusOptions = useMemo(
    () => ["Aktiven", "Neaktiven", "VIP", "Lead"],
    []
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || localLoading) return;
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (email && !emailRegex.test(email)) {
      setError("Email format is invalid.");
      return;
    }

    if (!client && columns.email && email) {
      const companyColumn = await getCompanyColumnForTable(tableName, companyId);
      const { data } = await supabaseReadOnly
        .from(tableName)
        .select(columns.email)
        .eq(columns.email, email)
        .eq(companyColumn, companyId)
        .limit(1);
      if (data && data.length > 0) {
        setError("Client with this email already exists.");
        return;
      }
    }

    if (custom && columns.custom) {
      try {
        JSON.parse(custom);
      } catch {
        setError("Custom JSON is invalid.");
        return;
      }
    }

    setLocalLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      const companyColumn = await getCompanyColumnForTable(tableName, companyId);
      payload[companyColumn] = companyId;

      if (!client) {
        const idColumn = await detectIdColumn(tableName, [
          "client_id",
          "ID stranke",
        ]);
        if (idColumn) {
          payload[idColumn] = await getNextPrefixedId(tableName, idColumn, "CLI");
        }
      }

      if (columns.firstName) payload[columns.firstName] = firstName.trim();
      if (columns.lastName) payload[columns.lastName] = lastName.trim();
      if (columns.fullName) {
        payload[columns.fullName] =
          fullName.trim() || `${firstName} ${lastName}`.trim();
      }
      if (columns.email && email) payload[columns.email] = email.trim();
      if (columns.phone && phone) payload[columns.phone] = phone.trim();
      if (columns.gender && gender) payload[columns.gender] = gender;
      if (columns.status) payload[columns.status] = status || "Aktiven";
      if (columns.notes && notes) payload[columns.notes] = notes.trim();
      if (columns.tags && tags) payload[columns.tags] = tags.trim();
      if (columns.lastInteraction && !client) {
        payload[columns.lastInteraction] = new Date().toISOString();
      }
      if (columns.custom && custom) {
        payload[columns.custom] = JSON.parse(custom);
      }
      // Assign random gradient color to new clients
      if (columns.barva && !client) {
        payload[columns.barva] = getRandomGradient();
      }

      await onSave(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <Modal
      open
      title={client ? "Edit client" : "Add client"}
      onClose={onClose}
    >
      <form className="flex flex-col gap-3 text-xs uppercase" onSubmit={handleSubmit}>
        {error ? (
          <p className="border border-black px-3 py-2 text-xs uppercase text-red-600">
            {error}
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border border-black px-3 py-2"
            placeholder="First name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <input
            className="border border-black px-3 py-2"
            placeholder="Last name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
        <input
          className="border border-black px-3 py-2"
          placeholder="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <div className="grid gap-3 md:grid-cols-2">
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
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="border border-black px-3 py-2"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
          >
            <option value="">Gender</option>
            <option value="moški">moški</option>
            <option value="ženska">ženska</option>
            <option value="drugo">drugo</option>
          </select>
          <select
            className="border border-black px-3 py-2"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {statusOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <input
          className="border border-black px-3 py-2"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
        <textarea
          className="border border-black px-3 py-2"
          placeholder="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
        />
        {columns.custom ? (
          <textarea
            className="border border-black px-3 py-2"
            placeholder="Custom JSON"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
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
