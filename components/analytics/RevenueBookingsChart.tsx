'use client';

import { memo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchRevenueChartData, type ChartDataPoint } from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';

interface RevenueBookingsChartProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function RevenueBookingsChart({ companyId, timePeriod, customRange }: RevenueBookingsChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const data = await fetchRevenueChartData(companyId, dateRange);
        setChartData(data);
      } catch (error) {
        console.error('Error fetching chart data:', error);
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
      <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="h-[350px] animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Prihodki & Termini Skozi Čas</h3>
        <p className="mt-1 text-sm text-gray-500">
          Dnevni pregled zaključenih terminov in prihodkov
        </p>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-[350px] items-center justify-center text-gray-500">
          Ni podatkov za izbrano obdobje
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              stroke="#9CA3AF"
              tickFormatter={(value) => `€${value}`}
            />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value, name) => {
                const numValue = Number(value) || 0;
                if (name === 'Prihodki (€)') return [`€${numValue.toFixed(2)}`, name];
                return [numValue, name];
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="prihodki"
              stroke="url(#revenueGradient)"
              strokeWidth={3}
              dot={{ fill: '#8B5CF6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Prihodki (€)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="termini"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ fill: '#10B981', r: 4 }}
              activeDot={{ r: 6 }}
              name="Zaključeni Termini"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}

export default memo(RevenueBookingsChart);
