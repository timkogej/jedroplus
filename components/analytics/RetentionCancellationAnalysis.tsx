'use client';

import { memo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Users, CalendarCheck, Star, Trophy } from '@phosphor-icons/react';
import {
  fetchRetentionData,
  fetchClientAppointmentDistribution,
  type StatusData,
  type ClientAppointmentDistribution,
} from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';

interface RetentionCancellationAnalysisProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function RetentionCancellationAnalysis({
  companyId,
  timePeriod,
  customRange,
}: RetentionCancellationAnalysisProps) {
  const [distributionData, setDistributionData] = useState<ClientAppointmentDistribution>({
    totalClients: 0,
    clientsWithOneAppointment: 0,
    clientsWithThreeAppointments: 0,
    clientsWithFivePlusAppointments: 0,
  });
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const [retentionResult, distributionResult] = await Promise.all([
          fetchRetentionData(companyId, dateRange),
          fetchClientAppointmentDistribution(companyId),
        ]);
        console.log('[RetentionAnalysis] Data received:', { retentionResult, distributionResult });
        setStatusData(retentionResult.statuses);
        setDistributionData(distributionResult);
      } catch (error) {
        console.error('Error fetching retention data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      fetchData();
    }
  }, [companyId, timePeriod, customRange]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-6 h-6 w-40 animate-pulse rounded bg-gray-200" />
          <div className="space-y-4">
            <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-6 h-6 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-[200px] animate-pulse rounded-full bg-gray-100" />
        </div>
      </div>
    );
  }

  const totalStatuses = statusData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Client Appointment Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h3 className="mb-6 text-lg font-semibold text-gray-900">Porazdelitev Strank po Terminih</h3>

        <div className="space-y-3">
          {/* Total Clients */}
          <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
            <div>
              <div className="text-sm text-gray-600">Vse stranke</div>
              <div className="text-2xl font-bold text-gray-900">
                {distributionData.totalClients}
              </div>
            </div>
            <Users className="h-8 w-8 text-blue-600" weight="duotone" />
          </div>

          {/* Clients with 1 appointment */}
          <div className="flex items-center justify-between rounded-lg bg-amber-50 p-4">
            <div>
              <div className="text-sm text-gray-600">Stranke z 1 terminom</div>
              <div className="text-2xl font-bold text-gray-900">
                {distributionData.clientsWithOneAppointment}
              </div>
            </div>
            <CalendarCheck className="h-8 w-8 text-amber-600" weight="duotone" />
          </div>

          {/* Clients with 3 appointments */}
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-4">
            <div>
              <div className="text-sm text-gray-600">Stranke s 3 termini</div>
              <div className="text-2xl font-bold text-gray-900">
                {distributionData.clientsWithThreeAppointments}
              </div>
            </div>
            <Star className="h-8 w-8 text-emerald-600" weight="duotone" />
          </div>

          {/* Clients with 5+ appointments */}
          <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 p-4">
            <div>
              <div className="text-sm text-white/90">Stranke s 5+ termini</div>
              <div className="text-2xl font-bold text-white">
                {distributionData.clientsWithFivePlusAppointments}
              </div>
            </div>
            <Trophy className="h-8 w-8 text-white" weight="duotone" />
          </div>
        </div>
      </motion.div>

      {/* Appointment Status Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h3 className="mb-6 text-lg font-semibold text-gray-900">Analiza Statusov</h3>

        {totalStatuses === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-gray-500">
            Ni podatkov za izbrano obdobje
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData as any[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 space-y-3">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                    <span className="text-xs text-gray-500">
                      {totalStatuses > 0 ? ((item.value / totalStatuses) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default memo(RetentionCancellationAnalysis);
