'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Phone, DollarSign, TrendingUp, Clock, Target } from 'lucide-react';
import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MetricsData {
  activeCustomers: number;
  rangeMetrics: {
    totalMinutes: string | null;
    totalCost: string | null;
    totalRevenue: string | null;
    totalMargin: string | null;
  };
  chartData: {
    dailyStats: Array<{
      calls: number;
      cost: number;
      revenue: number;
    }>;
  };
}

interface DashboardMetricsCardsProps {
  data: MetricsData;
  dateRange: { from: Date; to: Date };
}

export default function DashboardMetricsCards({ data, dateRange }: DashboardMetricsCardsProps) {
  // Fetch real cost data
  const { data: realData } = useSWR(
    `/api/real-dashboard-metrics?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );
  const formatCurrency = (value: string | null) => {
    if (!value) return '0.00';
    const num = parseFloat(value);
    return num.toFixed(2);
  };

  const formatMinutes = (value: string | null) => {
    if (!value) return '0:00';
    const totalMinutes = parseFloat(value);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    if (hours > 0) {
      return `${hours}t ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const calculateTotalCalls = () => {
    // Use real data instead of fake dailyStats
    return realData ? realData.totalCalls : 0;
  };

  const calculateAvgCallsPerDay = () => {
    if (!realData) return '0.0';

    const totalCalls = realData.totalCalls;
    const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return (totalCalls / diffDays).toFixed(1);
  };

  const calculateConversionRate = () => {
    const totalRevenue = parseFloat(data.rangeMetrics?.totalRevenue || '0');
    const totalCalls = calculateTotalCalls();
    if (totalCalls === 0) return '0.0';
    return ((totalRevenue / totalCalls) * 100).toFixed(1);
  };

  // Only show REAL metrics - remove fake revenue, margin, costs
  const cards = [
    {
      title: 'Aktiva Kunder',
      value: data.activeCustomers.toString(),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Totalt antal kunder'
    },
    {
      title: 'Totala Samtal',
      value: calculateTotalCalls().toString(),
      icon: Phone,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: `⌀ ${calculateAvgCallsPerDay()} per dag`
    },
    {
      title: 'Samtalstid',
      value: formatMinutes(data.rangeMetrics?.totalMinutes),
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Total tid för period'
    },
    {
      title: 'Total Kostnad',
      value: realData ? `${realData.totalCost.toFixed(2)} kr` : '0.00 kr',
      icon: DollarSign,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Verklig kostnad för period'
    }
  ];

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {card.value}
            </div>
            <p className="text-xs text-gray-500">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}