"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Modal from "./Modal";
import { checkColumnExists } from "@/lib/tableIntrospection";
import { getCompanyColumnForTable } from "@/lib/companyScope";
import { detectIdColumn } from "@/lib/tableIntrospection";

type ServiceDialogProps = {
  service?: Record<string, unknown> | null;
  companyId: string;
  tableName: string;
  defaultCurrency: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  isLoading: boolean;
};

type ColumnMap = {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  duration?: string;
  price?: string;
  priceType?: string;
  currency?: string;
  active?: string;
  showInWidget?: string;
  bufferBefore?: string;
  bufferAfter?: string;
  color?: string;
  colorFrom?: string;
  colorTo?: string;
};

const parseNumber = (value: string) => {
  if (!value) return null;
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function ServiceDialog({
  service,
  companyId,
  tableName,
  defaultCurrency,
  onClose,
  onSave,
  isLoading,
}: ServiceDialogProps) {
  const [columns, setColumns] = useState<ColumnMap>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<"fixed" | "agreement">("fixed");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [active, setActive] = useState(true);
  const [showInWidget, setShowInWidget] = useState(true);
  const [bufferBefore, setBufferBefore] = useState("");
  const [bufferAfter, setBufferAfter] = useState("");
  const [color, setColor] = useState("");
  const [colorFrom, setColorFrom] = useState("");
  const [colorTo, setColorTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const loadColumns = async () => {
      const exists = async (col: string) => checkColumnExists(tableName, col);
      const map: ColumnMap = {};
      map.id = (await detectIdColumn(tableName, [
        "service_id",
        "ID storitve",
        "ID_storitve",
      ])) ?? undefined;
      map.name = (await exists("name"))
        ? "name"
        : (await exists("Naziv"))
        ? "Naziv"
        : (await exists("Storitev"))
        ? "Storitev"
        : undefined;
      map.description = (await exists("description"))
        ? "description"
        : (await exists("Opis"))
        ? "Opis"
        : undefined;
      map.category = (await exists("category"))
        ? "category"
        : (await exists("Kategorija"))
        ? "Kategorija"
        : undefined;
      map.duration = (await exists("duration_min"))
        ? "duration_min"
        : (await exists("Trajanje"))
        ? "Trajanje"
        : (await exists("Trajanje (min)"))
        ? "Trajanje (min)"
        : undefined;
      map.price = (await exists("price"))
        ? "price"
        : (await exists("Cena"))
        ? "Cena"
        : undefined;
      map.priceType = (await exists("price_type"))
        ? "price_type"
        : undefined;
      map.currency = (await exists("currency"))
        ? "currency"
        : undefined;
      map.active = (await exists("active"))
        ? "active"
        : (await exists("Aktivno"))
        ? "Aktivno"
        : (await exists("Active"))
        ? "Active"
        : undefined;
      map.showInWidget = (await exists("show_in_widget"))
        ? "show_in_widget"
        : (await exists("Prikaži v widgetu"))
        ? "Prikaži v widgetu"
        : undefined;
      map.bufferBefore = (await exists("buffer_before_min"))
        ? "buffer_before_min"
        : undefined;
      map.bufferAfter = (await exists("buffer_after_min"))
        ? "buffer_after_min"
        : undefined;
      map.color = (await exists("service_color"))
        ? "service_color"
        : undefined;
      map.colorFrom = (await exists("service_color_from"))
        ? "service_color_from"
        : undefined;
      map.colorTo = (await exists("service_color_to"))
        ? "service_color_to"
        : undefined;
      setColumns(map);
    };
    loadColumns();
  }, [tableName]);

  useEffect(() => {
    if (!service) return;
    if (columns.name) setName(String(service[columns.name] ?? ""));
    if (columns.description)
      setDescription(String(service[columns.description] ?? ""));
    if (columns.category) setCategory(String(service[columns.category] ?? ""));
    if (columns.duration) setDuration(String(service[columns.duration] ?? ""));
    if (columns.price) setPrice(String(service[columns.price] ?? ""));
    if (columns.priceType) {
      const value = String(service[columns.priceType] ?? "");
      if (value === "agreement") setPriceType("agreement");
      if (value === "fixed") setPriceType("fixed");
    } else if (service.price_type) {
      const value = String(service.price_type);
      if (value === "agreement") setPriceType("agreement");
      if (value === "fixed") setPriceType("fixed");
    } else if (columns.price && String(service[columns.price] ?? "") === "Po dogovoru") {
      setPriceType("agreement");
    }
    if (columns.currency) {
      setCurrency(String(service[columns.currency] ?? defaultCurrency));
    } else if (service.currency) {
      setCurrency(String(service.currency));
    }
    if (columns.active) setActive(Boolean(service[columns.active]));
    if (columns.showInWidget)
      setShowInWidget(Boolean(service[columns.showInWidget]));
    if (columns.bufferBefore)
      setBufferBefore(String(service[columns.bufferBefore] ?? ""));
    if (columns.bufferAfter)
      setBufferAfter(String(service[columns.bufferAfter] ?? ""));
    if (columns.color) setColor(String(service[columns.color] ?? ""));
    else if (service.service_color) setColor(String(service.service_color));
    if (columns.colorFrom) setColorFrom(String(service[columns.colorFrom] ?? ""));
    if (columns.colorTo) setColorTo(String(service[columns.colorTo] ?? ""));
  }, [service, columns, defaultCurrency]);

  useEffect(() => {
    if (!service) {
      setCurrency(defaultCurrency);
    }
  }, [defaultCurrency, service]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (localLoading || isLoading) return;
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (duration && parseNumber(duration) === null) {
      setError("Duration must be numeric.");
      return;
    }
    if (priceType === "fixed" && price && parseNumber(price) === null) {
      setError("Price must be numeric.");
      return;
    }
    setLocalLoading(true);
    try {
      const durationValue = duration ? parseNumber(duration) : null;
      const bufferBeforeValue = bufferBefore ? parseNumber(bufferBefore) : null;
      const bufferAfterValue = bufferAfter ? parseNumber(bufferAfter) : null;
      const totalDuration =
        (durationValue ?? 0) +
        (bufferBeforeValue ?? 0) +
        (bufferAfterValue ?? 0);
      const payload: Record<string, unknown> = {};
      payload[await getCompanyColumnForTable(tableName, companyId)] = companyId;
      if (columns.name) payload[columns.name] = name.trim();
      if (columns.description && description)
        payload[columns.description] = description.trim();
      if (columns.category && category)
        payload[columns.category] = category.trim();
      if (columns.duration && duration) payload[columns.duration] = durationValue;
      payload.duration_min = durationValue;
      if (columns.price) {
        payload[columns.price] =
          priceType === "agreement"
            ? "Po dogovoru"
            : price
            ? parseNumber(price)
            : null;
      }
      payload.price =
        priceType === "agreement"
          ? "Po dogovoru"
          : price
          ? parseNumber(price)
          : null;
      payload.price_type = priceType;
      payload.currency = currency || defaultCurrency;
      payload.total_duration_min = Number.isFinite(totalDuration)
        ? totalDuration
        : null;
      if (columns.active) payload[columns.active] = active;
      if (columns.showInWidget) payload[columns.showInWidget] = showInWidget;
      payload.buffer_before_min = bufferBeforeValue ?? 0;
      payload.buffer_after_min = bufferAfterValue ?? 0;
      if (columns.bufferBefore)
        payload[columns.bufferBefore] = bufferBeforeValue ?? 0;
      if (columns.bufferAfter)
        payload[columns.bufferAfter] = bufferAfterValue ?? 0;
      payload.service_color = color.trim() || null;
      payload.service_color_from = colorFrom.trim() || null;
      payload.service_color_to = colorTo.trim() || null;
      if (columns.color) payload[columns.color] = color.trim();
      if (columns.colorFrom) payload[columns.colorFrom] = colorFrom.trim();
      if (columns.colorTo) payload[columns.colorTo] = colorTo.trim();
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
      title={service ? "Edit service" : "Add service"}
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-3 text-xs uppercase"
        onSubmit={handleSubmit}
      >
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
        <input
          className="border border-black px-3 py-2"
          placeholder="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <textarea
          className="border border-black px-3 py-2"
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border border-black px-3 py-2"
            placeholder="Duration (min)"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
          <div className="flex gap-2">
            <select
              className="border border-black px-2 py-2 uppercase"
              value={priceType}
              onChange={(event) =>
                setPriceType(event.target.value as "fixed" | "agreement")
              }
            >
              <option value="fixed">Fiksna</option>
              <option value="agreement">Po dogovoru</option>
            </select>
            <input
              className="border border-black px-3 py-2"
              placeholder="Price"
              value={priceType === "agreement" ? "Po dogovoru" : price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={priceType === "agreement"}
            />
          </div>
        </div>
        <input
          className="border border-black px-3 py-2"
          placeholder="Currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border border-black px-3 py-2"
            placeholder="Buffer before (min)"
            value={bufferBefore}
            onChange={(event) => setBufferBefore(event.target.value)}
          />
          <input
            className="border border-black px-3 py-2"
            placeholder="Buffer after (min)"
            value={bufferAfter}
            onChange={(event) => setBufferAfter(event.target.value)}
          />
        </div>
        {columns.colorFrom || columns.colorTo ? (
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="border border-black px-3 py-2"
              placeholder="Color from"
              value={colorFrom}
              onChange={(event) => setColorFrom(event.target.value)}
            />
            <input
              className="border border-black px-3 py-2"
              placeholder="Color to"
              value={colorTo}
              onChange={(event) => setColorTo(event.target.value)}
            />
          </div>
        ) : (
          <input
            className="border border-black px-3 py-2"
            placeholder="Color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showInWidget}
            onChange={(event) => setShowInWidget(event.target.checked)}
          />
          Show in widget
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
