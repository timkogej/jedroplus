'use client';

import { memo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchClientGrowthData, type ClientGrowthData } from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';

interface ClientGrowthChartProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function ClientGrowthChart({ companyId, timePeriod, customRange }: ClientGrowthChartProps) {
  const [chartData, setChartData] = useState<ClientGrowthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const data = await fetchClientGrowthData(companyId, dateRange);
        setChartData(data);
      } catch (error) {
        console.error('Error fetching client growth data:', error);
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
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="h-[300px] animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  const totalNewClients = chartData.reduce((sum, d) => sum + d.nove, 0);
  const latestTotal = chartData.length > 0 ? chartData[chartData.length - 1].skupaj : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Rast Strank</h3>
          <p className="mt-1 text-sm text-gray-500">Nove stranke skozi čas</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">+{totalNewClients}</div>
          <div className="text-xs text-gray-500">novih strank</div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-[250px] items-center justify-center text-gray-500">
          Ni podatkov za izbrano obdobje
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="clientGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
              formatter={(value, name) => {
                if (name === 'Skupaj Strank') return [value, String(name)];
                return [value, 'Nove Stranke'];
              }}
            />
            <Area
              type="monotone"
              dataKey="skupaj"
              stroke="#8B5CF6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#clientGradient)"
              name="Skupaj Strank"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}

export default memo(ClientGrowthChart);
