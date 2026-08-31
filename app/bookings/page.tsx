// TODO(i18n-review): confirm if this dev page should be removed, kept English-only, or included in i18n.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import CompleteBookingDialog from "@/components/CompleteBookingDialog";
import BookingDialog from "@/components/BookingDialog";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useCompany } from "@/app/company-context";
import { useAuth } from "@/app/auth-context";
import {
  fetchTableRows,
  resolveCompanyTables,
} from "@/lib/companyScope";
import {
  combineDateAndTime,
  detectBookingSchema,
  pickFirst,
  safeDate,
  safeFormat,
} from "@/lib/dashboardHelpers";
import {
  TABLES,
  fetchBookings,
  fetchClients,
  getBookingIdentifier,
} from "@/lib/data";
import { callN8nAction } from "@/src/lib/n8nClient";
import { getNextBookingId } from "@/src/lib/idGenerators";
import {
  buildAppointmentSlimData,
  buildBookingCompleteData,
  buildBookingCreateData,
  buildBookingDeleteData,
  buildBookingUpdateData,
  getCustomerAppointmentsCount,
  getPodatkiPodjetja,
} from "@/lib/webhookPayloadBuilders";

type Row = Record<string, unknown>;

type DataState<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
};

const emptyState = <T,>(): DataState<T> => ({
  data: [],
  loading: false,
  error: null,
});

const getStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return getStartOfDay(addDays(date, diff));
};

export default function BookingsPage() {
  const router = useRouter();
  const { companyId, companySettings, loading } = useCompany();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<DataState<Row>>(emptyState);
  const [clients, setClients] = useState<DataState<Row>>(emptyState);
  const [services, setServices] = useState<DataState<Row>>(emptyState);
  const [staff, setStaff] = useState<DataState<Row>>(emptyState);
  const [actionError, setActionError] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState("today");
  const [statusFilter, setStatusFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [staffFilter, setStaffFilter] = useState("All");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Row | null>(null);
  const actor = user?.email ?? "unknown";
  const buildPayload = (
    event: string,
    entity: string,
    data: Record<string, unknown>
  ) => ({
    event,
    entity,
    data,
    company_id: companyId ?? "",
    actor,
    timestamp: new Date().toISOString(),
    meta: { app: "Integrate" as const, version: "1.0" as const },
  });

  const tables = useMemo(() => {
    const resolved = resolveCompanyTables(companySettings);
    return {
      ...resolved,
      strankeTable: TABLES.clients,
      terminiTable: TABLES.bookings,
    };
  }, [companySettings]);
  const companyPayload = useMemo(
    () => getPodatkiPodjetja(companySettings ?? undefined),
    [companySettings]
  );

  useEffect(() => {
    if (loading) return;
    if (!companyId) {
      router.replace("/onboarding");
    }
  }, [companyId, loading, router]);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setBookings((prev) => ({ ...prev, loading: true, error: null }));
      setClients((prev) => ({ ...prev, loading: true, error: null }));
      setServices((prev) => ({ ...prev, loading: true, error: null }));
      setStaff((prev) => ({ ...prev, loading: true, error: null }));

      const [bookingsRes, clientsRes, servicesRes, staffRes] =
        await Promise.all([
          fetchBookings(companyId, 1000),
          fetchClients(companyId, 500),
          fetchTableRows<Row>(tables.storitveTable, companyId, 500),
          fetchTableRows<Row>(tables.osebeTable, companyId, 200),
        ]);

      setBookings({
        data: bookingsRes.data ?? [],
        loading: false,
        error: bookingsRes.error ? String(bookingsRes.error) : null,
      });
      setClients({
        data: clientsRes.data ?? [],
        loading: false,
        error: clientsRes.error ? String(clientsRes.error.message ?? clientsRes.error) : null,
      });
      setServices({
        data: servicesRes.data ?? [],
        loading: false,
        error: servicesRes.error ?? null,
      });
      setStaff({
        data: staffRes.data ?? [],
        loading: false,
        error: staffRes.error ?? null,
      });
    };
    load();
  }, [companyId, tables]);

  const bookingSchema = useMemo(
    () => (bookings.data[0] ? detectBookingSchema(bookings.data[0]) : {}),
    [bookings.data]
  );

  const personSchema = useMemo(() => {
    const sample = bookings.data[0];
    if (!sample) return {};
    const keys = Object.keys(sample);
    const pickField = (candidates: string[]) =>
      candidates.find((candidate) => keys.includes(candidate));
    return {
      personNameField: pickField(["Oseba", "assigned_person_name", "Person"]),
      personIdField: pickField(["ID Osebe", "assigned_person_id", "person_id"]),
      postVisitNoteField: pickField([
        "post_visit_note",
        "post_visit_notes",
        "Opombe po",
      ]),
    };
  }, [bookings.data]);

  const normalizedStart = (row: Row) => {
    if (bookingSchema.startAtField) {
      return safeDate(row[bookingSchema.startAtField]);
    }
    if (bookingSchema.dateField) {
      return combineDateAndTime(
        row[bookingSchema.dateField],
        bookingSchema.startTimeField ? row[bookingSchema.startTimeField] : undefined
      );
    }
    return null;
  };

  const statusValue = (row: Row) => {
    const field = bookingSchema.statusField ?? "status";
    return row[field];
  };

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    bookings.data.forEach((row) => {
      const value = statusValue(row);
      if (typeof value === "string" && value.trim()) {
        set.add(value.trim());
      }
    });
    return ["All", ...Array.from(set)];
  }, [bookings.data]);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    services.data.forEach((row) => {
      const name = pickFirst(row, ["Naziv", "Storitev", "Naziv storitve"]);
      if (name) set.add(String(name));
    });
    return ["All", ...Array.from(set)];
  }, [services.data]);

  const staffOptions = useMemo(() => {
    const set = new Set<string>();
    staff.data.forEach((row) => {
      const name = pickFirst(row, ["Naziv", "Oseba", "Ime", "Priimek"]);
      if (name) set.add(String(name));
    });
    return ["All", ...Array.from(set)];
  }, [staff.data]);

  const filtered = bookings.data.filter((row) => {
    const start = normalizedStart(row);
    const now = getStartOfDay(new Date());
    const tomorrow = getStartOfDay(addDays(now, 1));
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const query = search.trim().toLowerCase();

    if (dateFilter !== "all") {
      if (!start) return false;
      const startDay = getStartOfDay(start);
      if (dateFilter === "today" && startDay.getTime() !== now.getTime())
        return false;
      if (dateFilter === "tomorrow" && startDay.getTime() !== tomorrow.getTime())
        return false;
      if (dateFilter === "this_week") {
        const weekEnd = addDays(weekStart, 7);
        if (startDay < weekStart || startDay >= weekEnd) return false;
      }
      if (dateFilter === "this_month") {
        if (
          startDay.getFullYear() !== monthStart.getFullYear() ||
          startDay.getMonth() !== monthStart.getMonth()
        ) {
          return false;
        }
      }
      if (dateFilter === "upcoming" && startDay < now) return false;
      if (dateFilter === "past" && startDay >= now) return false;
    }

    if (statusFilter !== "All") {
      const value = statusValue(row);
      if (String(value ?? "") !== statusFilter) return false;
    }

    if (serviceFilter !== "All") {
      const service =
        (bookingSchema.serviceNameField
          ? row[bookingSchema.serviceNameField]
          : row["Storitev"]) ?? "";
      if (!String(service).includes(serviceFilter)) return false;
    }

    if (staffFilter !== "All") {
      const person =
        (personSchema.personNameField
          ? row[personSchema.personNameField]
          : row["Oseba"]) ?? "";
      if (!String(person).includes(staffFilter)) return false;
    }

    if (query) {
      const client =
        (bookingSchema.clientNameField
          ? row[bookingSchema.clientNameField]
          : row["Stranka"]) ?? "";
      const notes =
        (bookingSchema.notesField ? row[bookingSchema.notesField] : row["Opombe"]) ??
        "";
      const text = `${client} ${notes}`.toLowerCase();
      if (!text.includes(query)) return false;
    }

    return true;
  });

  const refreshBookings = async () => {
    if (!companyId) return;
    const result = await fetchBookings(companyId, 1000);
    setBookings({
      data: result.data ?? [],
      loading: false,
      error: result.error ? 'Prišlo je do napake pri nalaganju rezervacij.' : null,
    });
  };

  const refreshClients = async () => {
    if (!companyId) return;
    const result = await fetchClients(companyId, 500);
    setClients({
      data: result.data ?? [],
      loading: false,
      error: result.error ? 'Prišlo je do napake pri nalaganju strank.' : null,
    });
  };

  const stripInternalNotes = (row: Record<string, unknown>) => {
    const copy = { ...row };
    if ("notes_internal" in copy) {
      delete copy.notes_internal;
    }
    return copy;
  };

  const getClientIdOrName = (row: Row) => {
    const idField = bookingSchema.clientIdField ?? "ID stranke";
    const idValue = row[idField];
    if (idValue) return String(idValue);
    const nameField = bookingSchema.clientNameField ?? "Stranka";
    const nameValue = row[nameField];
    if (nameValue) return String(nameValue);
    return null;
  };

  const resolveClientForBooking = (row: Row) => {
    const clientIdField = bookingSchema.clientIdField ?? "ID stranke";
    const clientId = row[clientIdField];
    if (clientId) {
      return (
        clients.data.find((client) => client[clientIdField] === clientId) ?? null
      );
    }
    const nameField = bookingSchema.clientNameField ?? "Stranka";
    const nameValue = row[nameField];
    if (nameValue) {
      return (
        clients.data.find(
          (client) => client[nameField] === nameValue
        ) ?? null
      );
    }
    return null;
  };

  const resolveServiceForBooking = (row: Row) => {
    const serviceIdField = bookingSchema.serviceIdField;
    if (serviceIdField) {
      const serviceId = row[serviceIdField];
      if (serviceId) {
        return services.data.find((service) => service[serviceIdField] === serviceId) ?? null;
      }
    }
    const serviceNameField = bookingSchema.serviceNameField ?? "Storitev";
    const serviceName = row[serviceNameField];
    if (serviceName) {
      return services.data.find(
        (service) =>
          String(service[serviceNameField] ?? "") === String(serviceName)
      ) ?? null;
    }
    return null;
  };

  const resolvePersonForBooking = (row: Row) => {
    const personIdField = personSchema.personIdField;
    if (personIdField) {
      const personId = row[personIdField];
      if (personId) {
        return staff.data.find((person) => person[personIdField] === personId) ?? null;
      }
    }
    const personNameField = personSchema.personNameField ?? "Oseba";
    const personName = row[personNameField];
    if (personName) {
      return staff.data.find(
        (person) =>
          String(person[personNameField] ?? "") === String(personName)
      ) ?? null;
    }
    return null;
  };

  const sendBookingWebhook = async (
    event: string,
    bookingRow: Row,
    clientRow?: Row | null,
    computed?: Record<string, unknown>
  ) => {
    if (!companyId) return;
    const count = await getCustomerAppointmentsCount(
      companyId,
      getClientIdOrName(bookingRow)
    );
    const data =
      event === "ZAKLJUČEK_TERMINA"
        ? buildBookingCompleteData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            bookingRowUpdated: {
              ...stripInternalNotes(bookingRow),
              ...computed,
            },
            customerAppointmentsCount: count,
          })
        : event === "POSODOBITEV_TERMINA"
        ? buildBookingUpdateData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            bookingRow: {
              ...stripInternalNotes(bookingRow),
              ...computed,
            },
            clientRow: clientRow ?? undefined,
            customerAppointmentsCount: count,
          })
        : buildBookingCreateData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            bookingRow: {
              ...stripInternalNotes(bookingRow),
              ...computed,
            },
            clientRow: clientRow ?? undefined,
            customerAppointmentsCount: count,
          });
    const result = await callN8nAction(
      buildPayload(event, "appointments", data),
      event === "NOV_TERMIN"
        ? async () => {
            const nextId = await getNextBookingId(companyId);
            const nextRow = { ...bookingRow, booking_id: nextId };
            const nextData = buildBookingCreateData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              bookingRow: {
                ...stripInternalNotes(nextRow),
                ...computed,
              },
              clientRow: clientRow ?? undefined,
              customerAppointmentsCount: count,
            });
            return buildPayload(event, "appointments", nextData);
          }
        : undefined
    );
    if (!result.ok) {
      setActionError("Workflow failed. Data not saved.");
    }
    return result.ok;
  };

  const deleteBooking = async (row: Row) => {
    if (!companyId) return;
    const ok = window.confirm("Delete booking?");
    if (!ok) return;
    setActionError(null);
    const identifier = await getBookingIdentifier(row);
    if (!identifier) {
      setActionError("Missing booking ID.");
      return;
    }
    const appointmentId = identifier.value;
    const result = await callN8nAction(
      buildPayload(
        "IZBRIS_TERMINA",
        "appointments",
        buildBookingDeleteData({
          companyId,
          userEmail: actor,
          companyProfile: companyPayload,
          appointmentId: appointmentId as string,
        })
      )
    );
    if (!result.ok) {
      setActionError("Workflow failed. Data not saved.");
      return;
    }
    refreshBookings();
  };

  const handleComplete = async (row: Row, notes: string) => {
    const updates: Record<string, unknown> = {};
    const statusField = bookingSchema.statusField ?? "status";
    updates[statusField] = "completed";
    const notesField =
      personSchema.postVisitNoteField ?? bookingSchema.notesField ?? "Opombe";
    if (notes) updates[notesField] = notes;
    if (bookingSchema.completedDateField) {
      updates[bookingSchema.completedDateField] = new Date().toISOString();
    }
    const updated = { ...row, ...updates } as Row;
    const ok = await sendBookingWebhook(
      "ZAKLJUČEK_TERMINA",
      updated,
      resolveClientForBooking(updated) ?? undefined
    );
    if (!ok) return;
    refreshBookings();
  };

  const handleStatusUpdate = async (
    row: Row,
    status: string,
    event: "NI_PRISEL_NA_TERMIN" | "PREKLIC_TERMINA",
    payloadStatus: "ni_prisel" | "odpovedal"
  ) => {
    const statusField = bookingSchema.statusField ?? "status";
    const updated = { ...row, [statusField]: status } as Row;
    if (!companyId) return;
    const clientRow = resolveClientForBooking(updated) ?? undefined;
    const serviceRow = resolveServiceForBooking(updated);
    const personRow = resolvePersonForBooking(updated);
    const data = buildAppointmentSlimData({
      companyId,
      userEmail: actor,
      companyProfile: companyPayload,
      bookingRow: updated,
      clientRow,
      serviceRowOrId: serviceRow ?? undefined,
      assignedPersonRow: personRow ?? undefined,
      status: payloadStatus,
    });
    const result = await callN8nAction(
      buildPayload(event, "appointments", data)
    );
    if (!result.ok) {
      setActionError("Workflow failed. Data not saved.");
      return;
    }
    refreshBookings();
  };

  if (!companyId) return null;

  return (
    <ProtectedLayout>
      {dialogOpen ? (
        <BookingDialog
          booking={editing}
          clients={clients.data}
          services={services.data}
          teamMembers={staff.data}
          bookings={bookings.data}
          companyProfile={companySettings ?? null}
          generalSettings={null}
          companyId={companyId}
          actor={actor}
          prefillData={undefined}
          onClose={() => setDialogOpen(false)}
          onSaved={async () => {
            await refreshBookings();
            await refreshClients();
          }}
          mode={editing ? "edit" : "create"}
        />
      ) : null}
      <CompleteBookingDialog
        open={Boolean(completeTarget)}
        summary={
          completeTarget
            ? String(
                pickFirst(completeTarget, [
                  bookingSchema.clientNameField ?? "Stranka",
                ]) ?? ""
              )
            : ""
        }
        onClose={() => setCompleteTarget(null)}
        onSubmit={(notes) =>
          completeTarget ? handleComplete(completeTarget, notes) : Promise.resolve()
        }
      />
      <Modal
        open={Boolean(detail)}
        title="Booking detail"
        onClose={() => setDetail(null)}
      >
        <pre className="border border-black p-3 text-xs uppercase">
          {detail ? JSON.stringify(detail, null, 2) : "-"}
        </pre>
      </Modal>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold uppercase tracking-wide">
              Bookings
            </h1>
            <p className="text-xs uppercase tracking-widest">
              Table: {tables.terminiTable}
            </p>
          </div>
          <button
            type="button"
            className="border border-black px-3 py-2 text-xs uppercase tracking-widest"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            New booking
          </button>
        </div>

        {actionError ? (
          <p className="text-xs uppercase text-red-600">{actionError}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {[
            ["today", "Today"],
            ["tomorrow", "Tomorrow"],
            ["this_week", "This week"],
            ["this_month", "This month"],
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`border border-black px-3 py-2 text-xs uppercase tracking-widest ${
                dateFilter === value ? "bg-black text-white" : ""
              }`}
              onClick={() => setDateFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            className="border border-black px-3 py-2 text-xs uppercase tracking-widest"
            placeholder="Search client/notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="border border-black px-3 py-2 text-xs uppercase tracking-widest"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className="border border-black px-3 py-2 text-xs uppercase tracking-widest"
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value)}
          >
            {serviceOptions.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
          <select
            className="border border-black px-3 py-2 text-xs uppercase tracking-widest"
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
          >
            {staffOptions.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-auto border border-black">
          <table className="w-full border-collapse text-xs uppercase">
            <thead>
              <tr className="border-b border-black">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Client</th>
                <th className="px-3 py-2 text-left">Service</th>
                <th className="px-3 py-2 text-left">Person</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.loading ? (
                <tr>
                  <td className="px-3 py-4" colSpan={7}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-4" colSpan={7}>
                    No bookings found.
                  </td>
                </tr>
              ) : (
                filtered.map((row, index) => {
                  const start = normalizedStart(row);
                  return (
                    <tr
                      key={`booking-${index}`}
                      className="border-t border-black"
                      onClick={() => setDetail(row)}
                    >
                      <td className="px-3 py-2">
                        {start
                          ? safeFormat(start, "sl-SI", { dateStyle: "medium" })
                          : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {bookingSchema.startTimeField
                          ? String(row[bookingSchema.startTimeField] ?? "-")
                          : safeFormat(start, "sl-SI", { timeStyle: "short" })}
                      </td>
                      <td className="px-3 py-2">
                        {String(
                          pickFirst(row, [
                            bookingSchema.clientNameField ?? "Stranka",
                          ]) ?? "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {String(
                          pickFirst(row, [
                            bookingSchema.serviceNameField ?? "Storitev",
                          ]) ?? "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {String(
                          pickFirst(row, [
                            personSchema.personNameField ?? "Oseba",
                          ]) ?? "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {String(statusValue(row) ?? "-")}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="border border-black px-2 py-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCompleteTarget(row);
                            }}
                          >
                            Complete
                          </button>
                          <button
                            className="border border-black px-2 py-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStatusUpdate(
                                row,
                                "no_show",
                                "NI_PRISEL_NA_TERMIN",
                                "ni_prisel"
                              );
                            }}
                          >
                            No show
                          </button>
                          <button
                            className="border border-black px-2 py-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStatusUpdate(
                                row,
                                "cancelled",
                                "PREKLIC_TERMINA",
                                "odpovedal"
                              );
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="border border-black px-2 py-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="border border-black px-2 py-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteBooking(row);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {bookings.error ? (
          <p className="text-xs uppercase text-red-600">{bookings.error}</p>
        ) : null}
      </main>
    </ProtectedLayout>
  );
}
