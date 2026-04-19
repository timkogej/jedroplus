"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "./Modal";
import {
  buildBookingCreateData,
  buildBookingUpdateData,
  buildClientCreateData,
  buildClientUpdateData,
  getCustomerAppointmentsCount,
  getPodatkiPodjetja,
} from "@/lib/webhookPayloadBuilders";
import { callN8nAction } from "@/src/lib/n8nClient";
import {
  computeBaseTotalPrice,
  computeDiscountAmount,
  computeFinalTotalPrice,
  computeTotalDurationMin,
  buildStartEndISO,
} from "@/src/lib/bookingCalculations";
import { getNextBookingId, getNextClientId } from "@/src/lib/idGenerators";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[+\d\s().-]{6,}$/;

type BookingDialogProps = {
  booking?: Record<string, unknown> | null;
  clients: Record<string, unknown>[];
  services: Record<string, unknown>[];
  teamMembers: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
  companyProfile: Record<string, unknown> | null;
  generalSettings?: Record<string, unknown> | null;
  companyId: string;
  actor: string;
  prefillData?: {
    start_date?: string;
    start_time?: string;
    location_id?: string;
    assigned_person_id?: string;
  };
  onClose: () => void;
  onSaved: () => void;
  mode?: "create" | "edit";
  isLoading?: boolean;
};

type ServiceOption = {
  id: string;
  name: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  totalDurationMin: number;
  price: number | null;
  priceType: "fixed" | "agreement";
};

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  raw: Record<string, unknown>;
};

type TeamOption = {
  id: string;
  name: string;
  humanId: string;
  initials: string;
  services: string[];
  raw: Record<string, unknown>;
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const normalizeLocations = (companyProfile: Record<string, unknown> | null) => {
  const raw =
    companyProfile?.locations ??
    (companyProfile ? (companyProfile as Record<string, unknown>)["Lokacije"] : undefined);
  if (!raw) return [] as { id: string; name: string }[];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") {
          return { id: item, name: item };
        }
        if (item && typeof item === "object") {
          const id = String((item as Record<string, unknown>).id ?? "").trim();
          const name = String((item as Record<string, unknown>).name ?? id).trim();
          return { id: id || name, name: name || id };
        }
        return null;
      })
      .filter(Boolean) as { id: string; name: string }[];
  }
  if (typeof raw === "string") {
    const text = raw.trim();
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        return normalizeLocations({ locations: parsed } as Record<string, unknown>);
      } catch {
        return text ? [{ id: text, name: text }] : [];
      }
    }
    return [{ id: text, name: text }];
  }
  return [];
};

const buildClientName = (first: string, last: string) =>
  `${first} ${last}`.trim();

export default function BookingDialog({
  booking,
  clients,
  services,
  teamMembers,
  bookings,
  companyProfile,
  generalSettings,
  companyId,
  actor,
  prefillData,
  onClose,
  onSaved,
  mode,
  isLoading,
}: BookingDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [addNewClient, setAddNewClient] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [manualPriceOverride, setManualPriceOverride] = useState(false);
  const [manualBaseTotal, setManualBaseTotal] = useState("");

  const [assignedPersonId, setAssignedPersonId] = useState("");
  const [startDate, setStartDate] = useState(prefillData?.start_date ?? "");
  const [startTime, setStartTime] = useState(prefillData?.start_time ?? "");
  const [endTime, setEndTime] = useState("");
  const [endTimeTouched, setEndTimeTouched] = useState(false);
  const [locationId, setLocationId] = useState(prefillData?.location_id ?? "");

  const [status, setStatus] = useState("scheduled");
  const [notes, setNotes] = useState("");
  const [notesInternal, setNotesInternal] = useState("");
  const [prepaid, setPrepaid] = useState(false);

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<"EUR" | "PERCENT">("EUR");
  const [discountValue, setDiscountValue] = useState("");

  const [customJson, setCustomJson] = useState("{}");

  const currency = useMemo(() => {
    const settingsCurrency =
      (generalSettings?.default_currency as string | undefined) ??
      (companyProfile?.default_currency as string | undefined) ??
      (companyProfile?.currency as string | undefined) ??
      (companyProfile?.valuta as string | undefined);
    return settingsCurrency && settingsCurrency.trim() ? settingsCurrency : "EUR";
  }, [generalSettings, companyProfile]);

  const companyPayload = useMemo(
    () => getPodatkiPodjetja(companyProfile ?? undefined),
    [companyProfile]
  );

  const locationOptions = useMemo(
    () => normalizeLocations(companyProfile),
    [companyProfile]
  );

  const serviceOptions: ServiceOption[] = useMemo(() => {
    return services
      .map((row) => {
        const activeValue =
          row.active ?? row.Aktivno ?? row.Active ?? row.active_flag;
        if (
          activeValue !== undefined &&
          activeValue !== null &&
          activeValue !== true &&
          activeValue !== 1
        ) {
          return null;
        }
        const id = String(
          row.service_id ?? row["ID storitve"] ?? row["ID_storitve"] ?? row.id ?? ""
        ).trim();
        const name = String(
          row["Naziv"] ?? row["Storitev"] ?? row.name ?? row.service_name ?? ""
        ).trim();
        if (!id || !name) return null;
        const totalDuration = parseNumber(row.total_duration_min);
        const duration = parseNumber(row.duration_min ?? row["Trajanje"]);
        const bufferBefore = parseNumber(row.buffer_before_min);
        const bufferAfter = parseNumber(row.buffer_after_min);
        const fallbackTotal = duration + bufferBefore + bufferAfter;
        const rawPrice = row.price ?? row["Cena"];
        const priceType =
          row.price_type === "agreement" || String(rawPrice) === "Po dogovoru"
            ? "agreement"
            : "fixed";
        const price = priceType === "agreement" ? null : parseNumber(rawPrice);
        return {
          id,
          name,
          durationMin: duration,
          bufferBeforeMin: bufferBefore,
          bufferAfterMin: bufferAfter,
          totalDurationMin: totalDuration || fallbackTotal,
          price,
          priceType,
        };
      })
      .filter(Boolean) as ServiceOption[];
  }, [services]);

  const clientOptions: ClientOption[] = useMemo(() => {
    return clients
      .map((row) => {
        const id = String(row.client_id ?? row["ID stranke"] ?? "").trim();
        const first = String(row.Ime ?? row.first_name ?? "").trim();
        const last = String(row.Priimek ?? row.last_name ?? "").trim();
        const name = String(row["Stranka"] ?? row["Naziv"] ?? buildClientName(first, last)).trim();
        if (!id || !name) return null;
        return {
          id,
          firstName: first,
          lastName: last,
          name,
          email: String(
            row["Email stranke"] ?? row.to_email ?? row.Email ?? row.email ?? ""
          ).trim(),
          phone: String(row["Telefonska šte"] ?? row.Telefon ?? row.phone ?? "").trim(),
          notes: String(row["Opombe strank"] ?? row.notes ?? row.Opombe ?? "").trim(),
          raw: row,
        };
      })
      .filter(Boolean) as ClientOption[];
  }, [clients]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clientOptions;
    return clientOptions.filter((client) =>
      [client.name, client.email, client.phone].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [clientOptions, clientSearch]);

  const teamOptions: TeamOption[] = useMemo(() => {
    return teamMembers
      .filter((row) => {
        const type = String(row.person_type ?? row.Tip ?? row.Vrsta ?? "").toLowerCase();
        return type.includes("ekipa") || type.includes("team") || !type;
      })
      .map((row) => {
        const id = String(
          row.partner_id ?? row.person_id ?? row["ID osebe"] ?? row["ID Osebe"] ?? row.id ?? ""
        ).trim();
        const name = String(row.name ?? row["Naziv"] ?? row["Oseba"] ?? row.Ime ?? "").trim();
        if (!id || !name) return null;
        const servicesValue = row.person_services ?? row["Storitve"] ?? "";
        const servicesList = Array.isArray(servicesValue)
          ? servicesValue.map((value) => String(value))
          : String(servicesValue)
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean);
        return {
          id,
          name,
          humanId: String(row.person_human_id ?? "").trim(),
          initials: String(row.initials ?? "").trim(),
          services: servicesList,
          raw: row,
        };
      })
      .filter(Boolean) as TeamOption[];
  }, [teamMembers]);

  const selectedServices = useMemo(
    () => serviceOptions.filter((service) => selectedServiceIds.includes(service.id)),
    [serviceOptions, selectedServiceIds]
  );

  const hasAgreementPrice = selectedServices.some(
    (service) => service.priceType === "agreement"
  );

  const totalDurationMin = useMemo(
    () => computeTotalDurationMin(selectedServices),
    [selectedServices]
  );

  const baseTotal = useMemo(() => {
    const manual = manualPriceOverride ? parseNumber(manualBaseTotal) : null;
    return computeBaseTotalPrice(selectedServices, manual);
  }, [selectedServices, manualPriceOverride, manualBaseTotal]);

  const discount = useMemo(
    () => ({
      enabled: discountEnabled,
      type: discountType,
      value: parseNumber(discountValue),
    }),
    [discountEnabled, discountType, discountValue]
  );

  const discountAmount = computeDiscountAmount(baseTotal, discount);
  const finalTotal = computeFinalTotalPrice(baseTotal, discount);

  const filteredTeamOptions = useMemo(() => {
    if (selectedServiceIds.length === 0) return teamOptions;
    const matching = teamOptions.filter((member) =>
      selectedServiceIds.every((id) => member.services.includes(id))
    );
    return matching.length > 0 ? matching : teamOptions;
  }, [teamOptions, selectedServiceIds]);

  const selectedTeamMember = useMemo(
    () => teamOptions.find((member) => member.id === assignedPersonId) ?? null,
    [teamOptions, assignedPersonId]
  );

  useEffect(() => {
    if (locationOptions.length === 1 && !locationId) {
      setLocationId(locationOptions[0].id);
    }
  }, [locationOptions, locationId]);

  useEffect(() => {
    if (hasAgreementPrice) {
      setManualPriceOverride(true);
    }
  }, [hasAgreementPrice]);

  useEffect(() => {
    setEndTimeTouched(false);
  }, [selectedServiceIds]);

  useEffect(() => {
    if (manualPriceOverride && !manualBaseTotal) {
      setManualBaseTotal(String(baseTotal));
    }
  }, [manualPriceOverride, manualBaseTotal, baseTotal]);

  useEffect(() => {
    if (!startTime || totalDurationMin <= 0 || endTimeTouched) return;
    const [hours, minutes] = startTime.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + totalDurationMin;
    const endHours = Math.floor((endMinutes % (24 * 60)) / 60);
    const endMins = endMinutes % 60;
    const formatted = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;
    setEndTime(formatted);
  }, [startTime, totalDurationMin, endTimeTouched]);

  useEffect(() => {
    if (!booking) return;
    const existingClientId = String(booking.client_id ?? booking["ID stranke"] ?? "");
    setSelectedClientId(existingClientId);
    setClientFirstName(String(booking.first_name ?? ""));
    setClientLastName(String(booking.last_name ?? ""));
    setClientEmail(String(booking.email ?? ""));
    setClientPhone(String(booking.phone ?? ""));
    setClientNotes(String(booking.notes ?? ""));
    setAddNewClient(false);

    const serviceIds = Array.isArray(booking.service_ids)
      ? booking.service_ids.map((value: unknown) => String(value))
      : booking.service_ids
      ? String(booking.service_ids)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    if (serviceIds.length > 0) {
      setSelectedServiceIds(serviceIds);
    } else {
      const serviceName = String(booking.service_name ?? booking.Storitev ?? "").trim();
      const match = serviceOptions.find((service) => service.name === serviceName);
      if (match) setSelectedServiceIds([match.id]);
    }

    setAssignedPersonId(
      String(booking.assigned_person_id ?? booking["ID Osebe"] ?? "")
    );
    setStartDate(String(booking.start_date ?? booking.Datum ?? ""));
    setStartTime(String(booking.start_time ?? booking["Čas"] ?? ""));
    setEndTime(String(booking.end_time ?? booking.Konec ?? ""));
    setStatus(String(booking.status ?? booking.Status ?? "scheduled"));
    setNotes(String(booking.notes ?? booking.Opombe ?? ""));
    setNotesInternal(String(booking.notes_internal ?? ""));
    setLocationId(String(booking.location_id ?? ""));
    setPrepaid(Boolean(booking.prepaid));
    setDiscountEnabled(Boolean(booking.discount));
    setCustomJson(JSON.stringify(booking.custom ?? {}, null, 2));
  }, [booking]);

  useEffect(() => {
    const selected = clientOptions.find((client) => client.id === selectedClientId);
    if (!selected || addNewClient) return;
    setClientFirstName(selected.firstName);
    setClientLastName(selected.lastName);
    setClientEmail(selected.email);
    setClientPhone(selected.phone);
    setClientNotes(selected.notes);
  }, [selectedClientId, addNewClient, clientOptions]);

  const handleSelectClient = (client: ClientOption) => {
    setAddNewClient(false);
    setSelectedClientId(client.id);
    setClientFirstName(client.firstName);
    setClientLastName(client.lastName);
    setClientEmail(client.email);
    setClientPhone(client.phone);
    setClientNotes(client.notes);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || localLoading) return;
    setError(null);
    setWarning(null);

    if (!clientFirstName.trim() || !clientLastName.trim()) {
      setError("Client first and last name are required.");
      return;
    }
    if (clientEmail && !emailRegex.test(clientEmail)) {
      setError("Client email is invalid.");
      return;
    }
    if (clientPhone && !phoneRegex.test(clientPhone)) {
      setError("Client phone is invalid.");
      return;
    }
    if (selectedServiceIds.length === 0) {
      setError("Select at least one service.");
      return;
    }
    if (!assignedPersonId) {
      setError("Assigned person is required.");
      return;
    }
    if (!startDate || !startTime || !endTime) {
      setError("Date and time are required.");
      return;
    }
    if (!locationId) {
      setError("Location is required.");
      return;
    }
    if (startTime === endTime && totalDurationMin > 0) {
      setError("End time must be after start time.");
      return;
    }

    let customObject: Record<string, unknown> = {};
    try {
      customObject = customJson ? JSON.parse(customJson) : {};
    } catch {
      setError("Custom JSON is invalid.");
      return;
    }

    const bookingIdFromRow = String(
      booking?.booking_id ?? booking?.["ID termina"] ?? booking?.appointment_id ?? ""
    );

    const { start_at, end_at } = buildStartEndISO(startDate, startTime, endTime);

    const overlap = bookings.filter((row) => {
      const rowPersonId = String(
        row.assigned_person_id ?? row["ID Osebe"] ?? ""
      );
      if (!rowPersonId || rowPersonId !== assignedPersonId) return false;
      const rowStatus = String(row.status ?? row.Status ?? "").toLowerCase();
      if (rowStatus.includes("cancel") || rowStatus.includes("odpoved") || rowStatus.includes("no_show") || rowStatus.includes("ni_prisel")) {
        return false;
      }
      const rowDate = String(row.start_date ?? row.Datum ?? "").slice(0, 10);
      if (rowDate && rowDate !== startDate) return false;
      const rowStart = row.start_at ?? (row.Datum && row["Čas"] ? `${row.Datum}T${row["Čas"]}` : null);
      const rowEnd = row.end_at ?? (row.Datum && row.Konec ? `${row.Datum}T${row.Konec}` : null);
      const start = rowStart ? new Date(String(rowStart)) : null;
      const end = rowEnd ? new Date(String(rowEnd)) : null;
      if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      if (!start_at || !end_at) return false;
      const startDateObj = new Date(start_at);
      const endDateObj = new Date(end_at);
      if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) return false;
      const overlaps = startDateObj < end && endDateObj > start;
      if (bookingIdFromRow && String(row.booking_id ?? row["ID termina"] ?? row.appointment_id ?? "") === bookingIdFromRow) {
        return false;
      }
      return overlaps;
    });

    if (overlap.length > 0) {
      setWarning("Selected time overlaps an existing booking.");
      const ok = window.confirm("Selected time overlaps another booking. Continue?");
      if (!ok) return;
    }

    setLocalLoading(true);
    try {
      const selectedClient = clientOptions.find((client) => client.id === selectedClientId);
      let finalClientId = selectedClientId;
      let clientRowForPayload: Record<string, unknown> | null = null;

      if (addNewClient || !selectedClientId) {
        finalClientId = await getNextClientId(companyId);
      const clientPayload = {
        client_id: finalClientId,
        first_name: clientFirstName.trim(),
        last_name: clientLastName.trim(),
        email: clientEmail.trim() || null,
          phone: clientPhone.trim() || null,
          notes: clientNotes.trim() || null,
          tags: null,
          status: null,
          last_interaction: null,
      };
      const clientData = buildClientCreateData({
        companyId,
        userEmail: actor,
        companyProfile: companyPayload,
        clientRow: clientPayload,
      });
      const result = await callN8nAction(
        {
            event: "NOVA_STRANKA",
          entity: "clients",
          data: clientData,
          company_id: companyId,
          actor,
          timestamp: new Date().toISOString(),
          meta: { app: "Integrate", version: "1.0" },
        },
        async () => {
          const nextId = await getNextClientId(companyId);
            return {
              event: "NOVA_STRANKA",
              entity: "clients",
              data: buildClientCreateData({
                companyId,
                userEmail: actor,
                companyProfile: companyPayload,
                clientRow: { ...clientPayload, client_id: nextId },
              }),
              company_id: companyId,
              actor,
              timestamp: new Date().toISOString(),
              meta: { app: "Integrate", version: "1.0" },
            };
          }
        );
        if (!result.ok) {
          setError("Workflow failed. Data not saved.");
          return;
        }
        clientRowForPayload = clientPayload;
      } else if (selectedClient) {
        const needsUpdate =
          clientFirstName.trim() !== selectedClient.firstName ||
          clientLastName.trim() !== selectedClient.lastName ||
          clientEmail.trim() !== selectedClient.email ||
          clientPhone.trim() !== selectedClient.phone ||
          clientNotes.trim() !== selectedClient.notes;
        if (needsUpdate) {
          const updatePayload = {
            id: selectedClient.raw.id ?? null,
            client_id: selectedClient.id,
            first_name: clientFirstName.trim(),
            last_name: clientLastName.trim(),
            email: clientEmail.trim() || null,
            phone: clientPhone.trim() || null,
            notes: clientNotes.trim() || null,
            tags: selectedClient.raw.tags ?? null,
            status: selectedClient.raw.status ?? selectedClient.raw.Status ?? null,
            last_interaction:
              selectedClient.raw.last_interaction ??
              selectedClient.raw["Zadnja interakc"] ??
              null,
          };
          const updateData = buildClientUpdateData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            clientRow: updatePayload,
          });
          const updateResult = await callN8nAction({
            event: "POSODOBITEV_STRANKE",
            entity: "clients",
            data: updateData,
            company_id: companyId,
            actor,
            timestamp: new Date().toISOString(),
            meta: { app: "Integrate", version: "1.0" },
          });
          if (!updateResult.ok) {
            setError("Workflow failed. Data not saved.");
            return;
          }
        }
        clientRowForPayload = selectedClient.raw;
      }

      const bookingId =
        mode === "edit" && bookingIdFromRow ? bookingIdFromRow : await getNextBookingId(companyId);

      const primaryServiceName = selectedServices[0]?.name ?? "";
      const assignedPerson = selectedTeamMember;
      const bookingRow: Record<string, unknown> = {
        booking_id: bookingId,
        client_id: finalClientId,
        client_name: buildClientName(clientFirstName.trim(), clientLastName.trim()),
        service_ids: selectedServiceIds,
        service_name: primaryServiceName,
        assigned_person_id: assignedPerson?.id ?? null,
        assigned_person_human_id: assignedPerson?.humanId ?? null,
        assigned_person_name: assignedPerson?.name ?? null,
        assigned_person_initials: assignedPerson?.initials ?? null,
        start_date: startDate,
        start_time: startTime,
        end_time: endTime,
        start_at,
        end_at,
        location_id: locationId,
        base_total_price: baseTotal,
        final_total_price: finalTotal,
        currency,
        discount: discountEnabled
          ? {
              type: discountType,
              value: parseNumber(discountValue),
              amount: discountAmount,
            }
          : null,
        prepaid,
        notes: notes.trim() || null,
        notes_internal: notesInternal.trim() || null,
        custom: customObject,
        status: status || "scheduled",
      };

      const appointmentCount = await getCustomerAppointmentsCount(
        companyId,
        finalClientId
      );

      if (mode === "edit" && bookingIdFromRow) {
        const data = buildBookingUpdateData({
          companyId,
          userEmail: actor,
          companyProfile: companyPayload,
          bookingRow,
          clientRow: clientRowForPayload ?? undefined,
          customerAppointmentsCount: appointmentCount,
        });
        const result = await callN8nAction({
          event: "POSODOBITEV_TERMINA",
          entity: "appointments",
          data,
          company_id: companyId,
          actor,
          timestamp: new Date().toISOString(),
          meta: { app: "Integrate", version: "1.0" },
        });
        if (!result.ok) {
          setError("Workflow failed. Data not saved.");
          return;
        }
      } else {
        const data = buildBookingCreateData({
          companyId,
          userEmail: actor,
          companyProfile: companyPayload,
          bookingRow,
          clientRow: clientRowForPayload ?? undefined,
          customerAppointmentsCount: appointmentCount,
        });
        const result = await callN8nAction(
          {
            event: "NOV_TERMIN",
            entity: "appointments",
          data,
          company_id: companyId,
          actor,
          timestamp: new Date().toISOString(),
          meta: { app: "Integrate", version: "1.0" },
        },
        async () => {
          const nextId = await getNextBookingId(companyId);
          return {
            event: "NOV_TERMIN",
            entity: "appointments",
            data: buildBookingCreateData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              bookingRow: { ...bookingRow, booking_id: nextId },
              clientRow: clientRowForPayload ?? undefined,
              customerAppointmentsCount: appointmentCount,
            }),
            company_id: companyId,
            actor,
            timestamp: new Date().toISOString(),
            meta: { app: "Integrate", version: "1.0" },
          };
        }
        );
        if (!result.ok) {
          setError("Workflow failed. Data not saved.");
          return;
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError("Prišlo je do napake pri shranjevanju.");
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <Modal
      open
      title={mode === "edit" ? "Edit booking" : "New booking"}
      onClose={onClose}
    >
      <form className="flex flex-col gap-4 text-xs uppercase" onSubmit={handleSubmit}>
        {error ? (
          <p className="border border-black px-3 py-2 text-xs uppercase text-red-600">
            {error}
          </p>
        ) : null}
        {warning ? (
          <p className="border border-black px-3 py-2 text-xs uppercase">
            {warning}
          </p>
        ) : null}

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase">Client</h3>
            <input
              className="border border-black px-3 py-2"
              placeholder="Search client"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
            />
          <div className="max-h-32 overflow-auto border border-black">
            {filteredClients.length === 0 ? (
              <p className="px-3 py-2">No clients found.</p>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                    selectedClientId === client.id ? "bg-black text-white" : ""
                  }`}
                  onClick={() => handleSelectClient(client)}
                >
                  <span>{client.name}</span>
                  <span>
                    {client.email || client.phone
                      ? `(${[client.phone, client.email].filter(Boolean).join(" / ")})`
                      : ""}
                  </span>
                </button>
              ))
            )}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={addNewClient}
              onChange={(event) => {
                setAddNewClient(event.target.checked);
                if (event.target.checked) {
                  setSelectedClientId("");
                }
              }}
            />
            Add new client
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="border border-black px-3 py-2"
              placeholder="First name"
              value={clientFirstName}
              onChange={(event) => setClientFirstName(event.target.value)}
            />
            <input
              className="border border-black px-3 py-2"
              placeholder="Last name"
              value={clientLastName}
              onChange={(event) => setClientLastName(event.target.value)}
            />
            <input
              className="border border-black px-3 py-2"
              placeholder="Email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
            />
            <input
              className="border border-black px-3 py-2"
              placeholder="Phone"
              value={clientPhone}
              onChange={(event) => setClientPhone(event.target.value)}
            />
          </div>
          <textarea
            className="border border-black px-3 py-2"
            placeholder="Client notes"
            value={clientNotes}
            onChange={(event) => setClientNotes(event.target.value)}
            rows={2}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase">Services</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {serviceOptions.map((service) => (
              <label key={service.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedServiceIds.includes(service.id)}
                  onChange={(event) => {
                    setSelectedServiceIds((prev) =>
                      event.target.checked
                        ? [...prev, service.id]
                        : prev.filter((id) => id !== service.id)
                    );
                  }}
                />
                <span>
                  {service.name} · {service.totalDurationMin} min ·{" "}
                  {service.priceType === "agreement"
                    ? "Po dogovoru"
                    : service.price ?? 0}
                </span>
              </label>
            ))}
          </div>
          {hasAgreementPrice ? (
            <p className="text-xs">Price is “Po dogovoru” for at least one service.</p>
          ) : null}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={manualPriceOverride}
              onChange={(event) => setManualPriceOverride(event.target.checked)}
            />
            Manual base price
          </label>
          {manualPriceOverride ? (
            <input
              className="border border-black px-3 py-2"
              placeholder="Base total price"
              value={manualBaseTotal}
              onChange={(event) => setManualBaseTotal(event.target.value)}
            />
          ) : null}
          <p className="text-xs">
            Duration: {totalDurationMin} min · Base: {baseTotal} · Final: {finalTotal}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase">Assigned person</h3>
          {selectedServiceIds.length > 0 && filteredTeamOptions.length === teamOptions.length ? (
            <p className="text-xs">No strict match for selected services. Showing all.</p>
          ) : null}
          <select
            className="border border-black px-3 py-2"
            value={assignedPersonId}
            onChange={(event) => setAssignedPersonId(event.target.value)}
          >
            <option value="">Select person</option>
            {filteredTeamOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase">Date & Time</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="border border-black px-3 py-2"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <input
              className="border border-black px-3 py-2"
              type="time"
              value={startTime}
              onChange={(event) => {
                setStartTime(event.target.value);
                setEndTimeTouched(false);
              }}
            />
            <input
              className="border border-black px-3 py-2"
              type="time"
              value={endTime}
              onChange={(event) => {
                setEndTime(event.target.value);
                setEndTimeTouched(true);
              }}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase">Location</h3>
          <select
            className="border border-black px-3 py-2"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
          >
            <option value="">Select location</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase">Price & Payment</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="border border-black px-3 py-2"
              placeholder="Currency"
              value={currency}
              readOnly
            />
            <input
              className="border border-black px-3 py-2"
              placeholder="Base total price"
              value={baseTotal}
              readOnly
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(event) => setDiscountEnabled(event.target.checked)}
            />
            Enable discount
          </label>
          {discountEnabled ? (
            <div className="flex flex-wrap gap-2">
              <select
                className="border border-black px-3 py-2"
                value={discountType}
                onChange={(event) =>
                  setDiscountType(event.target.value as "EUR" | "PERCENT")
                }
              >
                <option value="EUR">EUR</option>
                <option value="PERCENT">%</option>
              </select>
              <input
                className="border border-black px-3 py-2"
                placeholder="Discount value"
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
              />
            </div>
          ) : null}
          <p className="text-xs">
            Discount: {discountAmount} · Final: {finalTotal}
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={prepaid}
              onChange={(event) => setPrepaid(event.target.checked)}
            />
            Prepaid
          </label>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase">Notes</h3>
          <textarea
            className="border border-black px-3 py-2"
            placeholder="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
          <textarea
            className="border border-black px-3 py-2"
            placeholder="Internal notes"
            value={notesInternal}
            onChange={(event) => setNotesInternal(event.target.value)}
            rows={2}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase">Custom</h3>
          <textarea
            className="border border-black px-3 py-2"
            placeholder='{"key":"value"}'
            value={customJson}
            onChange={(event) => setCustomJson(event.target.value)}
            rows={3}
          />
        </section>

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
