"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { CalendarBlank } from "@phosphor-icons/react";
import { format } from "date-fns";
import { intlLocale } from "@/lib/format";
import type { AppointmentItem } from "@/lib/dashboard/fetchDashboardData";
import { Section } from "./Section";
import { initialsStyle } from "./initialsStyle";

interface NextAppointmentCardProps {
  /** Next (or currently running) appointment, or null when nothing is booked. */
  appointment: AppointmentItem | null;
  onSelect: (appointment: AppointmentItem) => void;
  locale: string;
}

const toLocalDate = (datum: string, time: string) => new Date(`${datum}T${time}:00`);

/**
 * "Naslednji termin" — the first thing a desk wants on opening the app. Shows a
 * live countdown and links on to the calendar.
 */
export function NextAppointmentCard({ appointment, onSelect, locale }: NextAppointmentCardProps) {
  const t = useTranslations("dashboard.nextAppointment");
  const [now, setNow] = useState(() => new Date());

  // Keep the countdown honest without re-rendering the whole dashboard.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  let countdown = "";
  let dayLabel = "";
  const datum = appointment?.datum;
  if (appointment && datum) {
    const start = toLocalDate(datum, appointment.time);
    const end = appointment.endTime ? toLocalDate(datum, appointment.endTime) : start;
    const minutes = Math.ceil((start.getTime() - now.getTime()) / 60000);

    if (minutes <= 0 && end.getTime() > now.getTime()) {
      countdown = t("inProgress");
    } else if (minutes <= 0) {
      countdown = t("now");
    } else if (minutes < 60) {
      countdown = t("inMinutes", { minutes });
    } else if (minutes < 24 * 60) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      countdown = rest === 0 ? t("inHoursExact", { hours }) : t("inHours", { hours, minutes: rest });
    }

    const todayStr = format(now, "yyyy-MM-dd");
    const tomorrowStr = format(new Date(now.getTime() + 86400000), "yyyy-MM-dd");
    dayLabel =
      datum === todayStr
        ? t("today")
        : datum === tomorrowStr
          ? t("tomorrow")
          : toLocalDate(datum, "12:00").toLocaleDateString(intlLocale(locale), {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
  }

  const extras = appointment
    ? (appointment.serviceId2 ? 1 : 0) + (appointment.serviceId3 ? 1 : 0) + (appointment.addOnName ? 1 : 0)
    : 0;

  return (
    <Section
      className="mb-0"
      title={t("title")}
      actionHref="/koledar"
      actionLabel={t("openCalendar")}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
      >
        {appointment ? (
          <button
            type="button"
            onClick={() => onSelect(appointment)}
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <div className="w-14 flex-shrink-0">
              <div className="tnum text-xl font-semibold text-gray-900">{appointment.time}</div>
              {appointment.endTime && (
                <div className="tnum text-xs text-gray-400">{appointment.endTime}</div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-medium text-gray-900">{appointment.clientName}</div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <span className="truncate">{appointment.serviceName}</span>
                {extras > 0 && (
                  <span className="tnum flex-shrink-0 rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                    +{extras}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col items-end gap-1">
              {countdown && (
                <span className="tnum text-sm font-semibold text-[#6D5EF7]">{countdown}</span>
              )}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {dayLabel}
              </span>
            </div>

            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-lg font-bold"
              style={initialsStyle(appointment.employeeColor)}
            >
              {appointment.employeeInitials}
            </div>
          </button>
        ) : (
          <div className="px-5 py-10 text-center">
            <CalendarBlank className="mx-auto mb-2 h-6 w-6 text-gray-300" weight="regular" />
            <p className="text-sm text-gray-400">{t("empty")}</p>
          </div>
        )}
      </motion.div>
    </Section>
  );
}
