// TODO(i18n-review): confirm if this dev page should be removed, kept English-only, or included in i18n.
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useCompany } from "@/app/company-context";
import { useAuth } from "@/app/auth-context";
import { checkColumnExists } from "@/lib/tableIntrospection";
import {
  loadCompanyRow,
} from "@/lib/settingsStore";
import { callN8nAction } from "@/src/lib/n8nClient";
import {
  buildBookingsSettingsData,
  buildChatbotSettingsData,
  buildCompanyProfileData,
  buildGeneralSettingsData,
  buildLostLeadsSettingsData,
  buildRemindersSettingsData,
  getPodatkiPodjetja,
} from "@/lib/webhookPayloadBuilders";

type CompanyRow = Record<string, unknown>;

type ScheduleSegment = { from: string; to: string };
type ScheduleDay = { enabled: boolean; segments: ScheduleSegment[] };
type WorkSchedule = Record<string, ScheduleDay>;

const TAB_KEYS = [
  "general",
  "company",
  "bookings",
  "chatbot",
  "kpis",
  "reminders",
  "lost-leads",
] as const;

type TabKey = (typeof TAB_KEYS)[number];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const createEmptySchedule = (): WorkSchedule =>
  DAYS.reduce((acc, day) => {
    acc[day] = { enabled: false, segments: [] };
    return acc;
  }, {} as WorkSchedule);

const normalizeUrl = (value: string) => {
  if (!value.trim()) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
};

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companyId, reloadSettings } = useCompany();
  const { user } = useAuth();
  const [companyRow, setCompanyRow] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("general");

  const [notificationLanguage, setNotificationLanguage] = useState("sl");
  const [defaultCurrency, setDefaultCurrency] = useState("EUR");
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(
    createEmptySchedule()
  );

  const [displayName, setDisplayName] = useState("");
  const [industry, setIndustry] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [website, setWebsite] = useState("");

  const [bookingUrl, setBookingUrl] = useState("");
  const [bookingPrimary, setBookingPrimary] = useState("");
  const [bookingSecondary, setBookingSecondary] = useState("");
  const [bookingBgFrom, setBookingBgFrom] = useState("");
  const [bookingBgTo, setBookingBgTo] = useState("");

  const [chatInstructions, setChatInstructions] = useState("");
  const [chatTone, setChatTone] = useState("prijazen");
  const [chatbotUrl, setChatbotUrl] = useState("");
  const [chatbotName, setChatbotName] = useState("");
  const [chatBgFrom, setChatBgFrom] = useState("");
  const [chatBgTo, setChatBgTo] = useState("");
  const [chatUserBubbleFrom, setChatUserBubbleFrom] = useState("");
  const [chatUserBubbleTo, setChatUserBubbleTo] = useState("");
  const [chatBotBubbleFrom, setChatBotBubbleFrom] = useState("");
  const [chatBotBubbleTo, setChatBotBubbleTo] = useState("");
  const [chatAccentFrom, setChatAccentFrom] = useState("");
  const [chatAccentTo, setChatAccentTo] = useState("");
  const [chatUserMsgFrom, setChatUserMsgFrom] = useState("");
  const [chatUserMsgTo, setChatUserMsgTo] = useState("");
  const [chatTextColor, setChatTextColor] = useState("");
  const [chatFontFamily, setChatFontFamily] = useState("system");
  const [chatBorderRadius, setChatBorderRadius] = useState("");

  const [kpisWindowDays, setKpisWindowDays] = useState("7");
  const [kpisNewCustomersWindow, setKpisNewCustomersWindow] =
    useState("30_days");
  const [kpisDateFrom, setKpisDateFrom] = useState("");
  const [kpisDateTo, setKpisDateTo] = useState("");

  const [replyToEmail, setReplyToEmail] = useState("");
  const [reminderTone, setReminderTone] = useState("prijazen");
  const [beforeBookingEnabled, setBeforeBookingEnabled] = useState("enabled");
  const [beforeBookingInstructions, setBeforeBookingInstructions] =
    useState("");
  const [afterBookingEnabled, setAfterBookingEnabled] = useState("enabled");
  const [afterBookingHasDiscount, setAfterBookingHasDiscount] = useState("no");
  const [afterBookingDiscountText, setAfterBookingDiscountText] = useState("");
  const [afterBookingInstructions, setAfterBookingInstructions] = useState("");
  const [emailPrimaryColor, setEmailPrimaryColor] = useState("");
  const [emailSecondaryColor, setEmailSecondaryColor] = useState("");

  const [lostLeadsEnabled, setLostLeadsEnabled] = useState("disabled");
  const [inactivityDays, setInactivityDays] = useState("14");
  const [lostLeadsInstructions, setLostLeadsInstructions] = useState("");
  const [lostLeadsHasDiscount, setLostLeadsHasDiscount] = useState("no");
  const [lostLeadsDiscountText, setLostLeadsDiscountText] = useState("");
  const [lostLeadsTone, setLostLeadsTone] = useState("prijazen");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TAB_KEYS.includes(tab as TabKey)) {
      setActiveTab(tab as TabKey);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: loadError } = await loadCompanyRow(companyId);
      if (loadError) {
        setError(loadError.message);
        setCompanyRow(null);
        setLoading(false);
        return;
      }
      setCompanyRow(data ?? null);
      setLoading(false);
    };
    load();
  }, [companyId]);

  useEffect(() => {
    if (!companyRow) return;
    setNotificationLanguage(
      String(companyRow.notification_language ?? "sl")
    );
    setDefaultCurrency(String(companyRow.default_currency ?? "EUR"));
    const scheduleValue = companyRow.work_schedule_json ?? companyRow.koledar_ure;
    if (typeof scheduleValue === "string") {
      try {
        const parsed = JSON.parse(scheduleValue) as WorkSchedule;
        setWorkSchedule(parsed);
      } catch {
        setWorkSchedule(createEmptySchedule());
      }
    }

    setDisplayName(String(companyRow["Naziv Podjetja"] ?? ""));
    setIndustry(String(companyRow.Panoga ?? ""));
    setEmail(String(companyRow.from_email ?? companyRow.email ?? ""));
    setPhone(String(companyRow.phone ?? ""));
    setAddress(String(companyRow.address ?? ""));
    setTaxNumber(String(companyRow.tax_number ?? ""));
    setWebsite(String(companyRow.website ?? ""));

    setBookingUrl(String(companyRow.booking_url ?? ""));
    setBookingPrimary(String(companyRow.booking_primary ?? ""));
    setBookingSecondary(String(companyRow.booking_secondary ?? ""));
    setBookingBgFrom(String(companyRow.booking_bg_from ?? ""));
    setBookingBgTo(String(companyRow.booking_bg_to ?? ""));

    setChatInstructions(String(companyRow.chat_instructions ?? ""));
    setChatTone(String(companyRow.chat_tone ?? "prijazen"));
    setChatbotUrl(String(companyRow.chatbot_url ?? ""));
    setChatbotName(String(companyRow.chatbot_name ?? ""));
    setChatBgFrom(String(companyRow.chat_bg_gradient_from ?? ""));
    setChatBgTo(String(companyRow.chat_bg_gradient_to ?? ""));
    setChatUserBubbleFrom(String(companyRow.chat_user_bubble_gradient_from ?? ""));
    setChatUserBubbleTo(String(companyRow.chat_user_bubble_gradient_to ?? ""));
    setChatBotBubbleFrom(String(companyRow.chat_bot_bubble_gradient_from ?? ""));
    setChatBotBubbleTo(String(companyRow.chat_bot_bubble_gradient_to ?? ""));
    setChatAccentFrom(String(companyRow.chat_accent_gradient_from ?? ""));
    setChatAccentTo(String(companyRow.chat_accent_gradient_to ?? ""));
    setChatUserMsgFrom(String(companyRow.chat_user_msg_gradient_from ?? ""));
    setChatUserMsgTo(String(companyRow.chat_user_msg_gradient_to ?? ""));
    setChatTextColor(String(companyRow.chat_text_color ?? ""));
    setChatFontFamily(String(companyRow.chat_font_family ?? "system"));
    setChatBorderRadius(String(companyRow.chat_border_radius ?? ""));

    setKpisWindowDays(String(companyRow.kpis_windowDays ?? "7"));
    setKpisNewCustomersWindow(
      String(companyRow.kpis_newCustomersWindow ?? "30_days")
    );
    setKpisDateFrom(String(companyRow.kpis_newCustomersDateFrom ?? ""));
    setKpisDateTo(String(companyRow.kpis_newCustomersDateTo ?? ""));

    setReplyToEmail(String(companyRow.reply_to_email ?? ""));
    setReminderTone(String(companyRow.reminder_tone ?? "prijazen"));
    setBeforeBookingEnabled(
      String(companyRow.enabled_before_booking ?? "enabled")
    );
    setBeforeBookingInstructions(
      String(companyRow.before_booking_instructions ?? "")
    );
    setAfterBookingEnabled(
      String(companyRow.enabled_after_booking ?? "enabled")
    );
    setAfterBookingHasDiscount(
      String(companyRow.after_booking_has_discount ?? "no")
    );
    setAfterBookingDiscountText(
      String(companyRow.after_booking_discount_text ?? "")
    );
    setAfterBookingInstructions(
      String(companyRow.after_booking_instructions ?? "")
    );
    setEmailPrimaryColor(String(companyRow.email_primary_color ?? ""));
    setEmailSecondaryColor(String(companyRow.email_secondary_color ?? ""));

    setLostLeadsEnabled(String(companyRow.lost_leads_enabled ?? "disabled"));
    setInactivityDays(String(companyRow.inactivity_days ?? "14"));
    setLostLeadsInstructions(
      String(companyRow.communication_instructions ?? "")
    );
    setLostLeadsHasDiscount(
      String(companyRow.has_discount ?? "no")
    );
    setLostLeadsDiscountText(
      String(companyRow.discount_text ?? "")
    );
    setLostLeadsTone(String(companyRow.lost_leads_tone ?? "prijazen"));
  }, [companyRow]);

  const companyPayload = useMemo(
    () => getPodatkiPodjetja(companyRow ?? undefined),
    [companyRow]
  );
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

  const setTab = (tab: TabKey) => {
    setActiveTab(tab);
    router.replace(`/settings?tab=${tab}`);
  };

  const filterPatch = async (patch: Record<string, unknown>) => {
    const entries = await Promise.all(
      Object.entries(patch).map(async ([key, value]) => {
        const exists = await checkColumnExists("Podatki podjetij", key);
        return exists ? [key, value] as [string, unknown] : null;
      })
    );
    return entries.reduce((acc, entry) => {
      if (!entry) return acc;
      acc[entry[0]] = entry[1];
      return acc;
    }, {} as Record<string, unknown>);
  };

  const handleSave = async (tab: TabKey) => {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      let patch: Record<string, unknown> = {};

      if (tab === "general") {
        for (const day of DAYS) {
          const dayData = workSchedule[day];
          if (!dayData?.enabled) continue;
          for (const segment of dayData.segments) {
            if (!segment.from || !segment.to) {
              throw new Error("All schedule segments must have from/to.");
            }
            if (segment.from >= segment.to) {
              throw new Error("Schedule segment start must be before end.");
            }
          }
        }
        const scheduleJson = JSON.stringify(workSchedule);
        patch = {
          notification_language: notificationLanguage,
          default_currency: defaultCurrency,
          work_schedule_json: scheduleJson,
          koledar_ure: scheduleJson,
        };
        await filterPatch(patch);
        const webhookResult = await callN8nAction(
          buildPayload(
            "GENERAL_SETTINGS_UPDATED",
            "settings",
            buildGeneralSettingsData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              schedule: workSchedule,
            })
          )
        );
        if (!webhookResult.ok) throw new Error("Workflow failed. Data not saved.");
      }

      if (tab === "company") {
        patch = {
          "Naziv Podjetja": displayName,
          Panoga: industry,
          from_email: email,
          phone,
          address,
          tax_number: taxNumber,
          website: normalizeUrl(website),
        };
        const filtered = await filterPatch(patch);
        const webhookResult = await callN8nAction(
          buildPayload(
            "COMPANY_PROFILE_UPDATED",
            "settings",
            buildCompanyProfileData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              updatedProfile: filtered,
            })
          )
        );
        if (!webhookResult.ok) throw new Error("Workflow failed. Data not saved.");
      }

      if (tab === "bookings") {
        if (bookingUrl && !bookingUrl.startsWith("https://")) {
          throw new Error("booking_url must start with https://");
        }
        patch = {
          booking_url: normalizeUrl(bookingUrl),
          booking_primary: bookingPrimary,
          booking_secondary: bookingSecondary,
          booking_bg_from: bookingBgFrom,
          booking_bg_to: bookingBgTo,
        };
        await filterPatch(patch);
        const webhookResult = await callN8nAction(
          buildPayload(
            "SPREMEMBA_REZERVACIJ",
            "settings",
            buildBookingsSettingsData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              bookingUrl: normalizeUrl(bookingUrl),
              colors: {
                Booking_primary: bookingPrimary,
                Booking_secondary: bookingSecondary,
                Booking_bg_from: bookingBgFrom,
                Booking_bg_to: bookingBgTo,
              },
            })
          )
        );
        if (!webhookResult.ok) throw new Error("Workflow failed. Data not saved.");
      }

      if (tab === "chatbot") {
        if (chatbotUrl && !chatbotUrl.startsWith("https://")) {
          throw new Error("chatbot_url must start with https://");
        }
        patch = {
          chat_instructions: chatInstructions,
          chat_tone: chatTone,
          chatbot_url: normalizeUrl(chatbotUrl),
          chatbot_name: chatbotName,
          chat_bg_gradient_from: chatBgFrom,
          chat_bg_gradient_to: chatBgTo,
          chat_user_bubble_gradient_from: chatUserBubbleFrom,
          chat_user_bubble_gradient_to: chatUserBubbleTo,
          chat_bot_bubble_gradient_from: chatBotBubbleFrom,
          chat_bot_bubble_gradient_to: chatBotBubbleTo,
          chat_accent_gradient_from: chatAccentFrom,
          chat_accent_gradient_to: chatAccentTo,
          chat_user_msg_gradient_from: chatUserMsgFrom,
          chat_user_msg_gradient_to: chatUserMsgTo,
          chat_text_color: chatTextColor,
          chat_font_family: chatFontFamily,
          chat_border_radius: chatBorderRadius ? Number(chatBorderRadius) : null,
        };
        await filterPatch(patch);
        const webhookResult = await callN8nAction(
          buildPayload(
            "SPREMEMBA_CHATBOT",
            "settings",
            buildChatbotSettingsData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              chatbot: {
                chatbot_url: normalizeUrl(chatbotUrl),
                chatbot_name: chatbotName,
                chat_instructions: chatInstructions,
                tone: chatTone,
                colors: {
                  chat_bg_gradient_from: chatBgFrom,
                  chat_bg_gradient_to: chatBgTo,
                  chat_user_bubble_gradient_from: chatUserBubbleFrom,
                  chat_user_bubble_gradient_to: chatUserBubbleTo,
                  chat_bot_bubble_gradient_from: chatBotBubbleFrom,
                  chat_bot_bubble_gradient_to: chatBotBubbleTo,
                  chat_accent_gradient_from: chatAccentFrom,
                  chat_accent_gradient_to: chatAccentTo,
                  chat_user_msg_gradient_from: chatUserMsgFrom,
                  chat_user_msg_gradient_to: chatUserMsgTo,
                  chat_text_color: chatTextColor,
                },
                font_family: chatFontFamily,
                border_radius: chatBorderRadius ? Number(chatBorderRadius) : null,
              },
            })
          )
        );
        if (!webhookResult.ok) throw new Error("Workflow failed. Data not saved.");
      }

      if (tab === "kpis") {
        patch = {
          kpis_windowDays: Number(kpisWindowDays),
          kpis_newCustomersWindow: kpisNewCustomersWindow,
          kpis_newCustomersDateFrom: kpisDateFrom,
          kpis_newCustomersDateTo: kpisDateTo,
        };
        const filteredKpis = await filterPatch(patch);
        const webhookResult = await callN8nAction(
          buildPayload(
            "COMPANY_PROFILE_UPDATED",
            "settings",
            buildCompanyProfileData({
              companyId,
              userEmail: "system",
              companyProfile: companyPayload,
              updatedProfile: filteredKpis,
            })
          )
        );
        if (!webhookResult.ok) throw new Error("Workflow failed. Data not saved.");
      }

      if (tab === "reminders") {
        const replyToEffective = replyToEmail || email;
        patch = {
          reply_to_email: replyToEmail,
          reminder_tone: reminderTone,
          enabled_before_booking: beforeBookingEnabled,
          before_booking_instructions: beforeBookingInstructions,
          enabled_after_booking: afterBookingEnabled,
          after_booking_has_discount: afterBookingHasDiscount,
          after_booking_discount_text: afterBookingDiscountText,
          after_booking_instructions: afterBookingInstructions,
          email_primary_color: emailPrimaryColor,
          email_secondary_color: emailSecondaryColor,
        };
        await filterPatch(patch);
        const webhookResult = await callN8nAction(
          buildPayload(
            "SPREMEMBA_OPOMNIKOV",
            "settings",
            buildRemindersSettingsData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              nastavitveOpomnikov: {
                pred_terminom: beforeBookingEnabled,
                navodila_pred_terminom: beforeBookingInstructions,
                po_terminu: afterBookingEnabled,
                navodila_po_terminu: afterBookingInstructions,
                reply_to_email_configured: Boolean(replyToEmail),
                reply_to_email_effective: replyToEffective,
                tone: reminderTone,
                email_primary_color: emailPrimaryColor,
                email_secondary_color: emailSecondaryColor,
                popust: afterBookingHasDiscount,
                opis_popusta: afterBookingDiscountText,
              },
            })
          )
        );
        if (!webhookResult.ok) throw new Error("Workflow failed. Data not saved.");
      }

      if (tab === "lost-leads") {
        patch = {
          lost_leads_enabled: lostLeadsEnabled,
          inactivity_days: Number(inactivityDays),
          communication_instructions: lostLeadsInstructions,
          has_discount: lostLeadsHasDiscount,
          discount_text: lostLeadsDiscountText,
          lost_leads_tone: lostLeadsTone,
        };
        const filteredLostLeads = await filterPatch(patch);
        const webhookResult = await callN8nAction(
          buildPayload(
            "SPREMEMBA_LOST_LEADS",
            "settings",
            buildLostLeadsSettingsData({
              companyId,
              userEmail: actor,
              companyProfile: companyPayload,
              nastavitveLostLeads: filteredLostLeads,
            })
          )
        );
        if (!webhookResult.ok) throw new Error("Workflow failed. Data not saved.");
      }

      const refreshed = await loadCompanyRow(companyId);
      if (!refreshed.error) {
        setCompanyRow(refreshed.data ?? null);
      }
      await reloadSettings();
    } catch (err) {
      setError("Prišlo je do napake pri shranjevanju.");
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (
    day: string,
    update: Partial<ScheduleDay>
  ) => {
    setWorkSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        ...update,
      },
    }));
  };

  const addSegment = (day: string) => {
    setWorkSchedule((prev) => {
      const segments = prev[day].segments;
      if (segments.length >= 3) return prev;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          segments: [...segments, { from: "", to: "" }],
        },
      };
    });
  };

  const removeSegment = (day: string, index: number) => {
    setWorkSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        segments: prev[day].segments.filter((_, i) => i !== index),
      },
    }));
  };

  const setSegment = (day: string, index: number, segment: ScheduleSegment) => {
    setWorkSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        segments: prev[day].segments.map((item, i) =>
          i === index ? segment : item
        ),
      },
    }));
  };

  if (!companyId) return null;

  return (
    <ProtectedLayout>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold uppercase tracking-wide">
            Settings
          </h1>
          <p className="text-xs uppercase tracking-widest">
            Company settings
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs uppercase">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`border border-black px-3 py-2 ${
                activeTab === tab ? "bg-black text-white" : ""
              }`}
              onClick={() => setTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-xs uppercase tracking-widest">Loading...</p>
        ) : error ? (
          <p className="text-xs uppercase text-red-600">{error}</p>
        ) : !companyRow ? (
          <p className="text-xs uppercase tracking-widest">
            This settings section is not configured yet.
          </p>
        ) : null}

        {activeTab === "general" ? (
          <section className="border border-black p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              General
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={notificationLanguage}
                onChange={(event) => setNotificationLanguage(event.target.value)}
              >
                <option value="sl">sl</option>
                <option value="en">en</option>
                <option value="de">de</option>
                <option value="it">it</option>
              </select>
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={defaultCurrency}
                onChange={(event) => setDefaultCurrency(event.target.value)}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            <div className="mt-6 flex flex-col gap-4 text-xs uppercase">
              {DAYS.map((day) => (
                <div key={day} className="border border-black p-3">
                  <div className="flex items-center justify-between">
                    <span>{day}</span>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={workSchedule[day]?.enabled ?? false}
                        onChange={(event) =>
                          updateSchedule(day, {
                            enabled: event.target.checked,
                          })
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  {workSchedule[day]?.enabled ? (
                    <div className="mt-3 flex flex-col gap-2">
                      {workSchedule[day].segments.map((segment, index) => (
                        <div key={`${day}-${index}`} className="flex gap-2">
                          <input
                            className="border border-black px-2 py-1"
                            type="time"
                            value={segment.from}
                            onChange={(event) =>
                              setSegment(day, index, {
                                ...segment,
                                from: event.target.value,
                              })
                            }
                          />
                          <input
                            className="border border-black px-2 py-1"
                            type="time"
                            value={segment.to}
                            onChange={(event) =>
                              setSegment(day, index, {
                                ...segment,
                                to: event.target.value,
                              })
                            }
                          />
                          <button
                            type="button"
                            className="border border-black px-2 py-1"
                            onClick={() => removeSegment(day, index)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="border border-black px-2 py-1"
                        onClick={() => addSegment(day)}
                      >
                        Add segment
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleSave("general")}
              disabled={saving}
              className="mt-6 flex items-center gap-2 border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
            >
              {saving && <SpinnerGap className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save general settings"}
            </button>
          </section>
        ) : null}

        {activeTab === "company" ? (
          <section className="border border-black p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              Company profile
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Tax number"
                value={taxNumber}
                onChange={(event) => setTaxNumber(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>
            <div className="mt-4 border border-black p-3 text-xs uppercase">
              Company ID: {companyId}
            </div>
            <button
              type="button"
              onClick={() => handleSave("company")}
              disabled={saving}
              className="mt-6 flex items-center gap-2 border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
            >
              {saving && <SpinnerGap className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save company settings"}
            </button>
          </section>
        ) : null}

        {activeTab === "bookings" ? (
          <section className="border border-black p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              Bookings
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Booking URL"
                value={bookingUrl}
                onChange={(event) => setBookingUrl(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Primary color"
                value={bookingPrimary}
                onChange={(event) => setBookingPrimary(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Secondary color"
                value={bookingSecondary}
                onChange={(event) => setBookingSecondary(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Background gradient from"
                value={bookingBgFrom}
                onChange={(event) => setBookingBgFrom(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Background gradient to"
                value={bookingBgTo}
                onChange={(event) => setBookingBgTo(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => handleSave("bookings")}
              disabled={saving}
              className="mt-6 flex items-center gap-2 border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
            >
              {saving && <SpinnerGap className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save bookings settings"}
            </button>
          </section>
        ) : null}

        {activeTab === "chatbot" ? (
          <section className="border border-black p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              Chatbot
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Chatbot name"
                value={chatbotName}
                onChange={(event) => setChatbotName(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Chatbot URL"
                value={chatbotUrl}
                onChange={(event) => setChatbotUrl(event.target.value)}
              />
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={chatTone}
                onChange={(event) => setChatTone(event.target.value)}
              >
                <option value="profesionalen">profesionalen</option>
                <option value="prijazen">prijazen</option>
                <option value="prodajno_usmerjen">prodajno_usmerjen</option>
              </select>
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={chatFontFamily}
                onChange={(event) => setChatFontFamily(event.target.value)}
              >
                <option value="system">system</option>
                <option value="Arial">Arial</option>
                <option value="Inter">Inter</option>
              </select>
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Text color"
                value={chatTextColor}
                onChange={(event) => setChatTextColor(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Border radius"
                value={chatBorderRadius}
                onChange={(event) => setChatBorderRadius(event.target.value)}
              />
            </div>
            <textarea
              className="mt-3 w-full border border-black px-3 py-2 text-xs uppercase"
              placeholder="Chat instructions"
              value={chatInstructions}
              onChange={(event) => setChatInstructions(event.target.value)}
              rows={4}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Background gradient from"
                value={chatBgFrom}
                onChange={(event) => setChatBgFrom(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Background gradient to"
                value={chatBgTo}
                onChange={(event) => setChatBgTo(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="User bubble from"
                value={chatUserBubbleFrom}
                onChange={(event) => setChatUserBubbleFrom(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="User bubble to"
                value={chatUserBubbleTo}
                onChange={(event) => setChatUserBubbleTo(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Bot bubble from"
                value={chatBotBubbleFrom}
                onChange={(event) => setChatBotBubbleFrom(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Bot bubble to"
                value={chatBotBubbleTo}
                onChange={(event) => setChatBotBubbleTo(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Accent gradient from"
                value={chatAccentFrom}
                onChange={(event) => setChatAccentFrom(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Accent gradient to"
                value={chatAccentTo}
                onChange={(event) => setChatAccentTo(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="User msg gradient from"
                value={chatUserMsgFrom}
                onChange={(event) => setChatUserMsgFrom(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="User msg gradient to"
                value={chatUserMsgTo}
                onChange={(event) => setChatUserMsgTo(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => handleSave("chatbot")}
              disabled={saving}
              className="mt-6 flex items-center gap-2 border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
            >
              {saving && <SpinnerGap className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save chatbot settings"}
            </button>
          </section>
        ) : null}

        {activeTab === "kpis" ? (
          <section className="border border-black p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              KPIs
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Window days"
                value={kpisWindowDays}
                onChange={(event) => setKpisWindowDays(event.target.value)}
              />
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={kpisNewCustomersWindow}
                onChange={(event) =>
                  setKpisNewCustomersWindow(event.target.value)
                }
              >
                <option value="7_days">7_days</option>
                <option value="30_days">30_days</option>
                <option value="this_month">this_month</option>
                <option value="custom">custom</option>
              </select>
              {kpisNewCustomersWindow === "custom" ? (
                <>
                  <input
                    className="border border-black px-3 py-2 text-xs uppercase"
                    type="date"
                    value={kpisDateFrom}
                    onChange={(event) => setKpisDateFrom(event.target.value)}
                  />
                  <input
                    className="border border-black px-3 py-2 text-xs uppercase"
                    type="date"
                    value={kpisDateTo}
                    onChange={(event) => setKpisDateTo(event.target.value)}
                  />
                </>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => handleSave("kpis")}
              disabled={saving}
              className="mt-6 flex items-center gap-2 border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
            >
              {saving && <SpinnerGap className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save KPI settings"}
            </button>
          </section>
        ) : null}

        {activeTab === "reminders" ? (
          <section className="border border-black p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              Reminders
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Reply-to email"
                value={replyToEmail}
                onChange={(event) => setReplyToEmail(event.target.value)}
              />
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={reminderTone}
                onChange={(event) => setReminderTone(event.target.value)}
              >
                <option value="profesionalen">profesionalen</option>
                <option value="prijazen">prijazen</option>
                <option value="prodajno_usmerjen">prodajno_usmerjen</option>
              </select>
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={beforeBookingEnabled}
                onChange={(event) => setBeforeBookingEnabled(event.target.value)}
              >
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
              <textarea
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Before booking instructions"
                value={beforeBookingInstructions}
                onChange={(event) =>
                  setBeforeBookingInstructions(event.target.value)
                }
                rows={3}
              />
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={afterBookingEnabled}
                onChange={(event) => setAfterBookingEnabled(event.target.value)}
              >
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={afterBookingHasDiscount}
                onChange={(event) =>
                  setAfterBookingHasDiscount(event.target.value)
                }
              >
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
              {afterBookingHasDiscount === "yes" ? (
                <input
                  className="border border-black px-3 py-2 text-xs uppercase"
                  placeholder="Discount text"
                  value={afterBookingDiscountText}
                  onChange={(event) =>
                    setAfterBookingDiscountText(event.target.value)
                  }
                />
              ) : null}
              <textarea
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="After booking instructions"
                value={afterBookingInstructions}
                onChange={(event) =>
                  setAfterBookingInstructions(event.target.value)
                }
                rows={3}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Email primary color"
                value={emailPrimaryColor}
                onChange={(event) => setEmailPrimaryColor(event.target.value)}
              />
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Email secondary color"
                value={emailSecondaryColor}
                onChange={(event) => setEmailSecondaryColor(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => handleSave("reminders")}
              disabled={saving}
              className="mt-6 flex items-center gap-2 border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
            >
              {saving && <SpinnerGap className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save reminders"}
            </button>
          </section>
        ) : null}

        {activeTab === "lost-leads" ? (
          <section className="border border-black p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              Lost leads
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={lostLeadsEnabled}
                onChange={(event) => setLostLeadsEnabled(event.target.value)}
              >
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
              <input
                className="border border-black px-3 py-2 text-xs uppercase"
                placeholder="Inactivity days"
                value={inactivityDays}
                onChange={(event) => setInactivityDays(event.target.value)}
              />
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={lostLeadsHasDiscount}
                onChange={(event) => setLostLeadsHasDiscount(event.target.value)}
              >
                <option value="no">no</option>
                <option value="yes">yes</option>
              </select>
              {lostLeadsHasDiscount === "yes" ? (
                <input
                  className="border border-black px-3 py-2 text-xs uppercase"
                  placeholder="Discount text"
                  value={lostLeadsDiscountText}
                  onChange={(event) =>
                    setLostLeadsDiscountText(event.target.value)
                  }
                />
              ) : null}
              <select
                className="border border-black px-3 py-2 text-xs uppercase"
                value={lostLeadsTone}
                onChange={(event) => setLostLeadsTone(event.target.value)}
              >
                <option value="profesionalen">profesionalen</option>
                <option value="prijazen">prijazen</option>
                <option value="prodajno_usmerjen">prodajno_usmerjen</option>
              </select>
            </div>
            <textarea
              className="mt-3 w-full border border-black px-3 py-2 text-xs uppercase"
              placeholder="Communication instructions"
              value={lostLeadsInstructions}
              onChange={(event) =>
                setLostLeadsInstructions(event.target.value)
              }
              rows={4}
            />
            <button
              type="button"
              onClick={() => handleSave("lost-leads")}
              disabled={saving}
              className="mt-6 flex items-center gap-2 border border-black px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-60"
            >
              {saving && <SpinnerGap className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save lost leads"}
            </button>
          </section>
        ) : null}
      </main>
    </ProtectedLayout>
  );
}

function SettingsLoading() {
  return (
    <ProtectedLayout>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold uppercase tracking-wide">
            Settings
          </h1>
          <p className="text-xs uppercase tracking-widest">Loading...</p>
        </div>
      </main>
    </ProtectedLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}
