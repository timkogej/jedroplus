'use client';

import { memo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Medal, Star } from '@phosphor-icons/react';
import { fetchTopPerformers, type TopPerformer } from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';

interface TopPerformersTableProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function getRankBadge(index: number): React.ReactNode {
  switch (index) {
    case 0:
      return <Trophy className="h-4 w-4 text-yellow-500" weight="fill" />;
    case 1:
      return <Medal className="h-4 w-4 text-gray-400" weight="fill" />;
    case 2:
      return <Star className="h-4 w-4 text-orange-400" weight="fill" />;
    default:
      return null;
  }
}

function TopPerformersTable({ companyId, timePeriod, customRange }: TopPerformersTableProps) {
  const [topServices, setTopServices] = useState<TopPerformer[]>([]);
  const [topEmployees, setTopEmployees] = useState<TopPerformer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const data = await fetchTopPerformers(companyId, dateRange);
        console.log('[TopPerformers] Data received:', data);
        setTopServices(data.services);
        setTopEmployees(data.employees);
      } catch (error) {
        console.error('Error fetching top performers:', error);
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
        <div className="mb-6 h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <h3 className="mb-6 text-lg font-semibold text-gray-900">Top Performerji</h3>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Top Services - with service colors */}
        <div>
          <h4 className="mb-4 text-sm font-semibold text-gray-700">Storitve</h4>
          {topServices.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-4 text-center text-gray-500">
              Ni podatkov za izbrano obdobje
            </div>
          ) : (
            <div className="space-y-3">
              {topServices.map((service, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="text-2xl font-bold text-gray-300">
                    {index + 1}
                  </div>
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: service.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{service.name}</div>
                    <div className="text-sm text-gray-600">
                      {service.count} terminov
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getRankBadge(index)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Top Employees - with employee colors and initials */}
        <div>
          <h4 className="mb-4 text-sm font-semibold text-gray-700">Osebje</h4>
          {topEmployees.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-4 text-center text-gray-500">
              Ni podatkov za izbrano obdobje
            </div>
          ) : (
            <div className="space-y-3">
              {topEmployees.map((employee, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="text-2xl font-bold text-gray-300">
                    {index + 1}
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                    style={{ backgroundColor: employee.color }}
                  >
                    {employee.initials || employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{employee.name}</div>
                    <div className="text-sm text-gray-600">
                      {employee.count} terminov
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getRankBadge(index)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default memo(TopPerformersTable);
