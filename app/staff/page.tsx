'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  MagnifyingGlass,
  X,
  Users,
  UserCirclePlus,
  ChartLineUp,
  ArrowRight,
  Warning,
  CaretDown,
  Briefcase,
  CalendarCheck,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import type { Employee, EmployeeFormData, EmployeeStats, EmployeeSchedule } from '@/types/employees';
import type { Service } from '@/types/services';
import {
  fetchEmployees,
  getEmployeeStats,
  detectEmployeeColumns,
  buildEmployeeRow,
  getEmployeeIdentifier,
} from '@/lib/supabase/employees';
import { fetchServices } from '@/lib/supabase/services';
import EmployeeGrid from '@/components/employees/EmployeeGrid';
import EmployeeModal from '@/components/employees/EmployeeModal';
import DeleteEmployeeModal from '@/components/employees/DeleteEmployeeModal';
import EmployeeSettingsModal from '@/components/employees/EmployeeSettingsModal';
import ConnectEmployeeModal from '@/components/employees/ConnectEmployeeModal';
import { getUserPersonId } from '@/lib/supabase/companyMembers';
import { defaultWorkingHoursDay } from '@/types/settings';
import type { WorkingHoursDay, TimeInterval } from '@/types/settings';
import { loadCompanyRow } from '@/lib/settingsStore';
import { callN8nAction } from '@/src/lib/n8nClient';
import {
  buildPartnerActivityData,
  buildPartnerCreateData,
  buildPartnerDeleteData,
  buildPartnerUpdateData,
  getPodatkiPodjetja,
} from '@/lib/webhookPayloadBuilders';
import {
  generatePartnerId,
  getNextPersonHumanId,
  getNextStaffId,
} from '@/src/lib/idGenerators';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { useRolePermissions } from '@/app/role-permission-context';

type FilterType = 'all' | 'active' | 'inactive';

// Gradient border colors for stat cards
const STAT_GRADIENTS = [
  'linear-gradient(135deg, #EC4899 0%, #F97316 100%)', // Pink-Orange
  'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)', // Violet-Cyan
  'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)', // Emerald-Blue
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)', // Amber-Red
];

// Stats Card Component - matches Storitve page style
function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  trend?: { value: number; positive: boolean };
  gradientIndex?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-gray-200"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          <p className="text-sm font-medium text-gray-600">{label}</p>
        </div>
        <div className="text-black flex-shrink-0">
          <Icon className="h-6 w-6" weight="bold" />
        </div>
      </div>
    </motion.div>
  );
}

// Search Input Component
function SearchInput({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative">
      <MagnifyingGlass
        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
        weight="regular"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Išči zaposlene..."
        className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-12 pr-10 text-sm
                   text-[#1A1F36] placeholder:text-gray-400
                   focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" weight="bold" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// Filter Dropdown Component
function FilterDropdown({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 appearance-none rounded-xl border border-gray-200 bg-white pl-4 pr-10 text-sm
                   font-medium text-[#1A1F36]
                   focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        weight="bold"
      />
    </div>
  );
}

// Toast Notification Component
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
        type === 'success'
          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
          : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
      }`}
    >
      {type === 'error' && <Warning className="h-5 w-5" weight="fill" />}
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20"
      >
        <X className="h-4 w-4" weight="bold" />
      </button>
    </motion.div>
  );
}

export default function OsebjePage() {
  const router = useRouter();
  const { companyId, companySettings, loading: companyLoading } = useCompany();
  const { user } = useAuth();

  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [rawCompanySchedule, setRawCompanySchedule] = useState<Record<string, WorkingHoursDay>>(defaultWorkingHoursDay);

  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Connect user to employee state
  const [userPersonId, setUserPersonId] = useState<string | null | undefined>(undefined); // undefined = not yet loaded
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectEmployee, setConnectEmployee] = useState<Employee | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const { role, personId: rolePersonId, permissions } = useRolePermissions();

  // RBAC: staff permissions
  const canViewAllStaff = role !== 'staff' || (permissions?.can_view_staff ?? true);
  const canEditStaff = role !== 'staff' || (permissions?.can_edit_staff ?? true);
  const canDeleteStaff = role !== 'staff'; // staff can never delete employees

  const actor = user?.email ?? 'unknown';
  const companyProfile = useMemo(
    () => getPodatkiPodjetja(companySettings ?? undefined),
    [companySettings]
  );

  const buildPayload = useCallback(
    (event: string, entity: string, data: Record<string, unknown>) => ({
      event,
      entity,
      data,
      company_id: companyId ?? '',
      actor,
      timestamp: new Date().toISOString(),
      meta: { app: 'Integrate' as const, version: '1.0' as const },
    }),
    [companyId, actor]
  );

  // Helper: convert urnik JSON to WorkingHoursDay format with intervals
  const parseCompanyUrnik = useCallback((urnikData: unknown): Record<string, WorkingHoursDay> => {
    const DAYS = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];
    let parsed = urnikData;
    if (typeof urnikData === 'string') {
      try { parsed = JSON.parse(urnikData); } catch { return defaultWorkingHoursDay; }
    }
    if (!parsed || typeof parsed !== 'object') return defaultWorkingHoursDay;
    const data = parsed as Record<string, unknown>;
    const result: Record<string, WorkingHoursDay> = {};
    for (const day of DAYS) {
      const dayData = data[day];
      if (dayData && typeof dayData === 'object') {
        const d = dayData as Record<string, unknown>;
        if (Array.isArray(d.intervals)) {
          result[day] = { enabled: Boolean(d.enabled), intervals: d.intervals as TimeInterval[] };
        } else {
          result[day] = { enabled: Boolean(d.enabled), intervals: [{ start: String(d.start || '08:00'), end: String(d.end || '17:00') }] };
        }
      } else {
        result[day] = defaultWorkingHoursDay[day];
      }
    }
    return result;
  }, []);

  // Load employees and services
  const loadEmployees = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    try {
      const [employeesResult, statsResult, detectedColumns, servicesResult, companyRow] = await Promise.all([
        fetchEmployees(companyId),
        getEmployeeStats(companyId),
        detectEmployeeColumns(),
        fetchServices(companyId),
        loadCompanyRow(companyId),
      ]);

      if (employeesResult.data) {
        setEmployees(employeesResult.data);
      }
      if (statsResult) {
        setStats(statsResult);
      }
      if (servicesResult.data) {
        setServices(servicesResult.data);
      }
      setColumns(detectedColumns);

      // Load company schedule from "Urnik" column
      if (companyRow.data) {
        const urnikRaw = (companyRow.data as Record<string, unknown>)['Urnik'] ?? (companyRow.data as Record<string, unknown>)['urnik'];
        if (urnikRaw) {
          setRawCompanySchedule(parseCompanyUrnik(urnikRaw));
        }
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      setToast({ message: 'Napaka pri nalaganju zaposlenih', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Check if current user is already connected to a person in company_members
  useEffect(() => {
    if (!user?.id) return;
    getUserPersonId(user.id).then((personId) => {
      setUserPersonId(personId);
    });
  }, [user?.id]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      // RBAC: staff sees only own card when can_view_staff=false
      if (!canViewAllStaff && employee.id !== rolePersonId) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fullName = `${employee.ime} ${employee.priimek}`.toLowerCase();
        const email = (employee.email || '').toLowerCase();
        const position = (employee.pozicija || '').toLowerCase();
        if (
          !fullName.includes(query) &&
          !email.includes(query) &&
          !position.includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'active' && !employee.aktivna) return false;
      if (statusFilter === 'inactive' && employee.aktivna) return false;

      return true;
    });
  }, [employees, searchQuery, statusFilter, canViewAllStaff, rolePersonId]);

  // Handle save (create/update)
  const handleSave = async (data: EmployeeFormData) => {
    if (!companyId) return;

    setIsSaving(true);
    try {
      const rowData = buildEmployeeRow(data, columns, selectedEmployee?.aktivna ?? true);

      if (selectedEmployee) {
        // Update existing employee
        const identifier = await getEmployeeIdentifier(selectedEmployee);
        if (!identifier) {
          setToast({ message: 'Manjka ID zaposlenega', type: 'error' });
          return;
        }

        // Include both row_id (ID vrstice) and employee_id (ID osebe) in the update payload
        const rowDataWithIds: Record<string, unknown> = {
          ...rowData,
          id: selectedEmployee.id, // ID vrstice (database primary key)
          row_id: selectedEmployee.id, // Explicit row_id
          'ID osebe': identifier.value, // ID osebe (person identifier)
          employee_id: identifier.value, // Explicit employee_id
        };

        const result = await callN8nAction(
          buildPayload(
            'POSODOBITEV_PARTNERJA',
            'partners',
            buildPartnerUpdateData({
              companyId,
              userEmail: actor,
              companyProfile,
              partnerRow: rowDataWithIds,
            })
          )
        );

        if (!result.ok) {
          setToast({ message: 'Napaka pri posodabljanju zaposlenega', type: 'error' });
          return;
        }

        setToast({ message: 'Zaposleni uspešno posodobljen', type: 'success' });
      } else {
        // Create new employee with 7-digit unique ID
        const personType = data.pozicija || 'Ekipa';
        const personHumanId = await getNextPersonHumanId(companyId, personType);
        const staffId = await getNextStaffId(companyId);

        // Add default schedule from company and all services
        const defaultUrnik = companySchedule;
        const defaultStoritve = services.map((s) => s.id);

        const payloadWithId: Record<string, unknown> = {
          ...rowData,
          'ID osebe': staffId,
          person_human_id: personHumanId,
          // Add default schedule and services for new employees
          Urnik: JSON.stringify(defaultUrnik),
          urnik: defaultUrnik,
          Storitve: JSON.stringify(defaultStoritve),
          storitve: defaultStoritve,
          // CRITICAL: Boolean flags for n8n webhook
          'Ali opravlja vse': true, // Default to true - performs all services
          ali_opravlja_vse: true,
          'Ali ima urnik podjetja': true, // Default to true - uses company schedule
          ali_ima_urnik_podjetja: true,
        };

        if (columns.personHumanId) {
          payloadWithId[columns.personHumanId] = personHumanId;
        }
        if (columns.id === 'partner_id') {
          payloadWithId.partner_id = generatePartnerId();
        }

        const result = await callN8nAction(
          buildPayload(
            'NOV_PARTNER',
            'partners',
            buildPartnerCreateData({
              companyId,
              userEmail: actor,
              companyProfile,
              partnerRow: payloadWithId,
            })
          )
        );

        if (!result.ok) {
          setToast({ message: 'Napaka pri ustvarjanju zaposlenega', type: 'error' });
          return;
        }

        setToast({ message: 'Zaposleni uspešno ustvarjen', type: 'success' });
      }

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsModalOpen(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      setToast({ message: 'Napaka pri shranjevanju', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!companyId || !selectedEmployee) return;

    try {
      const identifier = await getEmployeeIdentifier(selectedEmployee);
      if (!identifier) {
        setToast({ message: 'Manjka ID zaposlenega', type: 'error' });
        return;
      }

      const result = await callN8nAction(
        buildPayload(
          'IZBRIS_PARTNERJA',
          'partners',
          buildPartnerDeleteData({
            companyId,
            userEmail: actor,
            companyProfile,
            partnerId: identifier.value as string,
          })
        )
      );

      if (!result.ok) {
        setToast({ message: 'Napaka pri brisanju zaposlenega', type: 'error' });
        return;
      }

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setToast({ message: 'Zaposleni uspešno izbrisan', type: 'success' });
      setIsDeleteModalOpen(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      setToast({ message: 'Napaka pri brisanju', type: 'error' });
    }
  };

  // Handle toggle active
  const handleToggleActive = async (employee: Employee) => {
    if (!companyId) return;

    const newActive = !employee.aktivna;
    const newStatus = newActive ? 'active' : 'inactive';

    // Optimistic update — immediately reflect in UI
    setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, aktivna: newActive } : e));

    try {
      const identifier = await getEmployeeIdentifier(employee);
      if (!identifier) {
        setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, aktivna: employee.aktivna } : e));
        setToast({ message: 'Manjka ID zaposlenega', type: 'error' });
        return;
      }

      const result = await callN8nAction(
        buildPayload(
          'SPREMEMBA_STATUS_OSEBJE',
          'partners',
          {
            partner_id: identifier.value,
            id: employee.id,
            status: newStatus,
          }
        )
      );

      if (!result.ok) {
        setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, aktivna: employee.aktivna } : e));
        setToast({ message: 'Napaka pri spreminjanju statusa', type: 'error' });
        return;
      }

      setToast({
        message: newActive ? 'Zaposleni aktiviran' : 'Zaposleni deaktiviran',
        type: 'success',
      });
    } catch (error) {
      console.error('Error toggling active:', error);
      setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, aktivna: employee.aktivna } : e));
      setToast({ message: 'Napaka pri spreminjanju statusa', type: 'error' });
    }
  };

  // Open edit modal
  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  // Open delete modal
  const handleDeleteClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDeleteModalOpen(true);
  };

  // Open settings modal
  const handleSettings = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsSettingsModalOpen(true);
  };

  // Open connect modal
  const handleConnectClick = (employee: Employee) => {
    setConnectEmployee(employee);
    setIsConnectModalOpen(true);
  };

  // Confirm connect — call webhook
  const handleConnectConfirm = async (employee: Employee) => {
    if (!user?.id) return;

    setIsConnecting(true);
    try {
      const response = await fetch('https://tikej.app.n8n.cloud/webhook/connect-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          person_id: employee.id,
        }),
      });

      if (!response.ok) {
        setToast({ message: 'Napaka pri povezovanju računa', type: 'error' });
        return;
      }

      setUserPersonId(employee.id);
      setIsConnectModalOpen(false);
      setConnectEmployee(null);
      setToast({ message: 'Račun uspešno povezan z zaposlenim', type: 'success' });
    } catch {
      setToast({ message: 'Napaka pri povezovanju računa', type: 'error' });
    } finally {
      setIsConnecting(false);
    }
  };

  // Save employee settings (schedule and services)
  const handleSaveSettings = async (data: { urnik: EmployeeSchedule | Record<string, { enabled: boolean; intervals: { start: string; end: string }[] }>; storitve: string[]; aliImaUrnikPodjetja?: boolean }) => {
    if (!companyId || !selectedEmployee) return;

    setIsSaving(true);
    try {
      const identifier = await getEmployeeIdentifier(selectedEmployee);
      if (!identifier) {
        setToast({ message: 'Manjka ID zaposlenega', type: 'error' });
        return;
      }

      // Build row data with schedule and services
      const rowData = buildEmployeeRow(
        {
          ime: selectedEmployee.ime,
          priimek: selectedEmployee.priimek,
          email: selectedEmployee.email,
          telefon: selectedEmployee.telefon,
          pozicija: selectedEmployee.pozicija,
          barva: selectedEmployee.barva,
          opombe: selectedEmployee.opombe,
          urnik: data.urnik,
          storitve: data.storitve,
        },
        columns,
        selectedEmployee.aktivna
      );

      // Include IDs and boolean flags in the update payload
      const rowDataWithIds: Record<string, unknown> = {
        ...rowData,
        id: selectedEmployee.id,
        row_id: selectedEmployee.id,
        'ID osebe': identifier.value,
        employee_id: identifier.value,
        // CRITICAL: Boolean flags for n8n webhook
        'Ali ima urnik podjetja': data.aliImaUrnikPodjetja ?? true,
        ali_ima_urnik_podjetja: data.aliImaUrnikPodjetja ?? true,
        'Ali opravlja vse': data.storitve.length === services.length,
        ali_opravlja_vse: data.storitve.length === services.length,
      };

      const result = await callN8nAction(
        buildPayload(
          'POSODOBITEV_PARTNERJA',
          'partners',
          buildPartnerUpdateData({
            companyId,
            userEmail: actor,
            companyProfile,
            partnerRow: rowDataWithIds,
          })
        )
      );

      if (!result.ok) {
        setToast({ message: 'Napaka pri shranjevanju nastavitev', type: 'error' });
        return;
      }

      setToast({ message: 'Nastavitve uspešno shranjene', type: 'success' });

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsSettingsModalOpen(false);
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ message: 'Napaka pri shranjevanju nastavitev', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Company schedule with intervals — loaded directly from "Urnik" column
  const companySchedule = rawCompanySchedule;

  if (!companyId) return null;

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#1A1F36]">Osebje</h1>
              <p className="mt-1 text-gray-500">
                Upravljajte z vašimi zaposlenimi in njihovimi termini
              </p>
            </div>
            {role !== 'staff' && (
              <motion.button
                type="button"
                onClick={() => {
                  setSelectedEmployee(null);
                  setIsModalOpen(true);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30"
              >
                <Plus className="h-5 w-5" weight="bold" />
                Dodaj zaposlenega
              </motion.button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Skupaj zaposlenih"
              value={stats?.total || 0}
              gradientIndex={0}
            />
            <StatCard
              icon={UserCirclePlus}
              label="Aktivni"
              value={stats?.active || 0}
              gradientIndex={1}
            />
            <StatCard
              icon={Briefcase}
              label="Neaktivni"
              value={stats?.inactive || 0}
              gradientIndex={2}
            />
            <StatCard
              icon={CalendarCheck}
              label="Termini danes"
              value={stats?.appointmentsToday || 0}
              trend={stats?.weeklyGrowth ? { value: stats.weeklyGrowth, positive: stats.weeklyGrowth > 0 } : undefined}
              gradientIndex={3}
            />
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onClear={() => setSearchQuery('')}
              />
            </div>
            {/* Status filter using animated select like Termini page */}
            <div className="w-40">
              <Select
                value={statusFilter}
                setValue={(value) => setStatusFilter(value as FilterType)}
                placeholder="Vsi"
              >
                <SelectOption value="all">Vsi</SelectOption>
                <SelectOption value="active">Aktivni</SelectOption>
                <SelectOption value="inactive">Neaktivni</SelectOption>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="mb-4">
            <p className="text-sm text-gray-500">
              {filteredEmployees.length}{' '}
              {filteredEmployees.length === 1 ? 'zaposleni' : 'zaposlenih'}
              {searchQuery && ` za "${searchQuery}"`}
            </p>
          </div>

          {/* Employee Grid */}
          <EmployeeGrid
            employees={filteredEmployees}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleActive}
            onSettings={handleSettings}
            onConnect={handleConnectClick}
            showConnectButton={userPersonId === null}
            canEdit={canEditStaff}
            canDelete={canDeleteStaff}
          />
        </div>
      </main>

      {/* Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        employee={selectedEmployee}
        mode={selectedEmployee ? 'edit' : 'create'}
        companyId={companyId}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEmployee(null);
        }}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete Modal */}
      <DeleteEmployeeModal
        isOpen={isDeleteModalOpen}
        employee={selectedEmployee}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedEmployee(null);
        }}
        onConfirm={handleDelete}
      />

      {/* Settings Modal (Schedule and Services) */}
      <EmployeeSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => {
          setIsSettingsModalOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        companySchedule={companySchedule}
        allServices={services}
        onSave={handleSaveSettings}
        isSaving={isSaving}
      />

      {/* Connect Employee Modal */}
      <ConnectEmployeeModal
        isOpen={isConnectModalOpen}
        employee={connectEmployee}
        isConnecting={isConnecting}
        onClose={() => {
          setIsConnectModalOpen(false);
          setConnectEmployee(null);
        }}
        onConfirm={handleConnectConfirm}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </ProtectedLayout>
  );
}
