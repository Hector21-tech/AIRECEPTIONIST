'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Phone, DollarSign, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Component for REAL call metrics only
function RealCallMetrics({ dateRange }: { dateRange: { from: Date; to: Date } }) {
  // Default date range if not provided
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultTo.getDate() - 30);

  const fromDate = dateRange?.from || defaultFrom;
  const toDate = dateRange?.to || defaultTo;

  const { data: realData, error } = useSWR(
    `/api/real-dashboard-metrics?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-red-500">Fel vid laddning av riktig data</p>
      </div>
    );
  }

  if (!realData) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-gray-500">Laddar riktig data...</p>
      </div>
    );
  }

  const formatMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    if (hours > 0) {
      return `${hours}t ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-32 items-center">
      <div className="text-center">
        <div className="text-3xl font-bold text-blue-600 mb-1">
          {realData.callsToday}
        </div>
        <div className="text-sm text-gray-600">Samtal idag</div>
      </div>

      <div className="text-center">
        <div className="text-3xl font-bold text-green-600 mb-1">
          {realData.totalCalls}
        </div>
        <div className="text-sm text-gray-600">Totalt period</div>
      </div>

      <div className="text-center">
        <div className="text-3xl font-bold text-purple-600 mb-1">
          {formatMinutes(realData.totalMinutes)}
        </div>
        <div className="text-sm text-gray-600">Total tid</div>
      </div>

      <div className="text-center">
        <div className="text-3xl font-bold text-orange-600 mb-1">
          {realData.averageCallLength.toFixed(1)}m
        </div>
        <div className="text-sm text-gray-600">Ø per samtal</div>
      </div>
    </div>
  );
}

interface DashboardChartsProps {
  data: {
    dailyStats: Array<{
      date: string;
      calls: number;
      cost: number;
      revenue: number;
      duration: number;
    }>;
    hourlyStats: Array<{
      hour: number;
      calls: number;
    }>;
    outcomeStats: Array<{
      name: string;
      value: number;
      color: string;
    }>;
  };
  dateRange: { from: Date; to: Date };
}

export default function DashboardCharts({ data, dateRange }: DashboardChartsProps) {
  const [dataType, setDataType] = useState<'calls' | 'cost' | 'duration'>('calls');

  // Auto-detect if we should show hourly or daily based on date range
  const isOneDay = () => {
    const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  };

  const viewMode = isOneDay() ? 'hourly' : 'daily';

  const formatCurrency = (value: number) => `${value.toFixed(2)} kr`;
  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  // Prepare chart data based on view mode
  const getChartData = () => {
    if (viewMode === 'daily') {
      return data.dailyStats;
    } else {
      // For hourly view, filter data for the specific selected day
      const selectedDate = dateRange.from.toISOString().split('T')[0];

      // Debug logging
      console.log('🔍 Debug hourly data:');
      console.log('Selected date:', selectedDate);
      console.log('Available hourlyStats:', data.hourlyStats);

      // Generate 24 hours (0-23) with data from hourlyStats for the specific day
      return Array.from({ length: 24 }, (_, hour) => {
        const hourData = data.hourlyStats.find(h =>
          h.hour === hour
        );

        if (hour <= 2) { // Log first few hours for debugging
          console.log(`Hour ${hour}: Found data:`, hourData);
        }

        return {
          hour: hour,
          calls: hourData?.calls || 0,
          cost: 0,
          duration: 0
        };
      });
    }
  };

  // Get data for cost vs revenue chart (filtered by date range and view mode)
  const getCostRevenueChartData = () => {
    if (viewMode === 'hourly') {
      // When showing single day, create a single data point for the whole day
      const selectedDate = dateRange.from.toISOString().split('T')[0];
      const dayData = {
        date: selectedDate,
        cost: chartData.reduce((sum, item) => sum + (item.cost || 0), 0),
        revenue: chartData.reduce((sum, item) => sum + (item.revenue || 0), 0)
      };
      return [dayData];
    } else {
      return data.dailyStats;
    }
  };

  // Get data for hourly activity chart (filtered by date range and view mode)
  const getHourlyActivityData = () => {
    if (viewMode === 'hourly') {
      // Use the same filtered hourly data as main chart
      return chartData.map(item => ({
        hour: item.hour,
        calls: item.calls
      }));
    } else {
      // For daily view, show aggregated hourly data across all days
      return data.hourlyStats;
    }
  };

  const chartData = getChartData();

  // Get the data key and formatting function based on selected type
  const getDataConfig = () => {
    switch (dataType) {
      case 'calls':
        return { key: 'calls', color: '#3b82f6', label: 'Samtal', format: (v: number) => v.toString() };
      case 'cost':
        return { key: 'cost', color: '#ef4444', label: 'Kostnad', format: formatCurrency };
      case 'duration':
        return { key: 'duration', color: '#8b5cf6', label: 'Tid', format: formatDuration };
      default:
        return { key: 'calls', color: '#3b82f6', label: 'Samtal', format: (v: number) => v.toString() };
    }
  };

  const { key: dataKey, color, label, format } = getDataConfig();

  // Calculate total for the day when in hourly view
  const getDayTotal = () => {
    if (viewMode !== 'hourly') return null;

    const total = chartData.reduce((sum, item) => sum + (item[dataKey] || 0), 0);
    return format(total);
  };

  const dayTotal = getDayTotal();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Samtalsvolym över tid */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {label} över {viewMode === 'hourly' ? 'timme' : 'tid'}
              </CardTitle>
              {dayTotal && (
                <p className="text-sm text-gray-600 mt-1">
                  Totalt för dagen: <span className="font-semibold">{dayTotal}</span>
                </p>
              )}
            </div>

            {/* Data Type Dropdown */}
            <Select value={dataType} onValueChange={(value: 'calls' | 'cost' | 'duration') => setDataType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calls">Samtal</SelectItem>
                <SelectItem value="cost">Kostnad</SelectItem>
                <SelectItem value="duration">Tid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={viewMode === 'daily' ? 'date' : 'hour'}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    viewMode === 'daily'
                      ? new Date(value).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
                      : `${value}:00`
                  }
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) =>
                    viewMode === 'daily'
                      ? new Date(value).toLocaleDateString('sv-SE')
                      : `Kl ${value}:00`
                  }
                  formatter={(value) => [format(Number(value)), label]}
                />
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Kostnad vs Intäkt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Kostnad vs Intäkt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getCostRevenueChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString('sv-SE')}
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    name === 'cost' ? 'Kostnad' : 'Intäkt'
                  ]}
                />
                <Bar dataKey="cost" fill="#ef4444" />
                <Bar dataKey="revenue" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Timbaserad aktivitet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Aktivitet per timme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getHourlyActivityData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(hour) => `${hour}:00`}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(hour) => `${hour}:00`}
                  formatter={(value) => [value, 'Samtal']}
                />
                <Line
                  type="monotone"
                  dataKey="calls"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Riktig Data från callLogs */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Riktig Samtalsdata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RealCallMetrics dateRange={dateRange} />
        </CardContent>
      </Card>
    </div>
  );
}