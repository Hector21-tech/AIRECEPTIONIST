'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import useSWR from 'swr';
import { Activity, Phone, DollarSign, Clock, User } from 'lucide-react';

type ActivityItem = {
  id: number;
  type: string;
  timestamp: string;
  description: string;
  customer: string;
  callSid: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  duration: string | null;
  cost: string | null;
  elevenlabsCost: string | null;
  outcome: string;
  metadata: {
    customer: string;
    duration: string | null;
    cost: string | null;
    elevenlabsCost: string | null;
    callSid: string | null;
  };
};

type ActivityResponse = {
  activities: ActivityItem[];
  totalCount: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start space-x-3 animate-pulse">
          <div className="h-8 w-8 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-1/2 bg-gray-200 rounded" />
          </div>
          <div className="h-3 w-12 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'call':
      return <Phone className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function getActivityColor(outcome: string) {
  switch (outcome) {
    case 'completed':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'failed':
      return 'text-red-700 bg-red-50 border-red-200';
    default:
      return 'text-orange-700 bg-orange-50 border-orange-200';
  }
}

function getOutcomeBadgeVariant(outcome: string): "default" | "secondary" | "destructive" | "outline" {
  switch (outcome) {
    case 'completed':
      return 'default';
    case 'failed':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function formatCurrency(value: string | null) {
  if (!value) return '0.00 kr';
  const num = parseFloat(value);
  return `${num.toFixed(2)} kr`;
}

export default function ActivityLog() {
  const { data, error } = useSWR<ActivityResponse>('/api/activity-logs', fetcher, {
    refreshInterval: 5000, // Uppdatera var 5:e sekund för snabbare respons
    revalidateOnFocus: false,
  });

  if (error) return <div>Failed to load activity logs</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Senaste Aktiviteter
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || !data.activities ? (
          <ActivitySkeleton />
        ) : data.activities.length === 0 ? (
          <p className="text-muted-foreground text-sm">Inga aktiviteter än</p>
        ) : (
          <div className="space-y-3">
            {data.activities.map((activity) => (
              <div key={activity.id} className="group relative rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full border ${getActivityColor(activity.outcome)}`}>
                      {getActivityIcon(activity.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3 w-3 text-gray-400" />
                        <h4 className="text-sm font-medium text-gray-900">
                          {activity.customer}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(activity.timestamp).toLocaleString('sv-SE')}
                        </span>
                        {activity.fromNumber && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {activity.fromNumber}
                          </span>
                        )}
                        {activity.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {activity.duration}s
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                        <DollarSign className="h-3 w-3" />
                        <span>
                          Twilio: {formatCurrency(activity.cost)}
                          <span className="ml-2">ElevenLabs: {formatCurrency(activity.elevenlabsCost)}</span>
                        </span>
                      </div>

                      {activity.callSid && (
                        <div className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded border">
                          {activity.callSid}
                        </div>
                      )}
                    </div>
                  </div>

                  <Badge variant={getOutcomeBadgeVariant(activity.outcome)}>
                    {activity.outcome === 'completed' ? 'Lyckad' :
                     activity.outcome === 'failed' ? 'Misslyckad' :
                     activity.outcome === 'fallback' ? 'Lyckad' :
                     'Pågående'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}