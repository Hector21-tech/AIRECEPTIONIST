'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DateRangePicker, { DateRange } from '@/components/date-range-picker';
import DashboardCharts from '@/components/dashboard-charts';
import DashboardMetricsCards from '@/components/dashboard-metrics-cards';
import ActivityLog from '@/components/activity-log';
import AIReceptionistLayout from '../ai-layout';
import useSWR from 'swr';
import { Suspense } from 'react';
import { Play, Pause, User, Clock, DollarSign } from 'lucide-react';
import { getAudioUrl } from '@/lib/supabase';

interface TranscriptTurn {
  speaker: 'agent' | 'user';
  message: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

type DashboardData = {
  activeCustomers: number;
  rangeMetrics: {
    totalMinutes: string | null;
    totalCost: string | null;
    totalRevenue: string | null;
    totalMargin: string | null;
  };
  recentCalls: Array<{
    id: number;
    callSid: string;
    fromNumber: string;
    toNumber: string;
    datetime: string;
    outcome: string;
    duration: string | null;
    customerName: string;
    transcript: string | null;
    elevenlabsCost: string | null;
    audioData?: string;
    audioFileName?: string;
  }>;
  chartData: {
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
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function OverviewContent() {
  // Initialize date range to today only
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate())
    };
  });

  // Audio playback states
  const [playingCall, setPlayingCall] = useState<number | null>(null);
  const [expandedCall, setExpandedCall] = useState<number | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  // Fetch dashboard data with date range
  const { data, error, isLoading } = useSWR<DashboardData>(
    `/api/dashboard-metrics?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );

  // Format transcript
  const formatTranscript = (transcript: string | null): TranscriptTurn[] => {
    if (!transcript) return [];
    try {
      const parsed = JSON.parse(transcript);
      if (Array.isArray(parsed)) {
        return parsed.map((turn: any) => ({
          speaker: turn.speaker === 'agent' ? 'agent' : 'user',
          message: turn.message || '',
          start_timestamp: turn.start_timestamp,
          end_timestamp: turn.end_timestamp,
        }));
      }
    } catch (error) {
      console.error('Error parsing transcript:', error);
    }
    return [];
  };

  const formatDuration = (duration: string | null) => {
    if (!duration) return '0:00';
    const seconds = parseInt(duration);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio playback functions
  const togglePlayback = async (callId: number, audioData?: string, audioFileName?: string) => {
    if (playingCall === callId && currentAudio) {
      currentAudio.pause();
      setPlayingCall(null);
      setCurrentAudio(null);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    let audioUrl = '';

    if (audioFileName) {
      audioUrl = getAudioUrl(audioFileName);
    } else if (audioData) {
      const audioBlob = new Blob([Buffer.from(audioData, 'base64')], { type: 'audio/mpeg' });
      audioUrl = URL.createObjectURL(audioBlob);
    } else {
      console.warn('No audio data available for call:', callId);
      return;
    }

    const audio = new Audio(audioUrl);
    audio.onended = () => {
      setPlayingCall(null);
      setCurrentAudio(null);
    };
    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      setPlayingCall(null);
      setCurrentAudio(null);
    };

    try {
      await audio.play();
      setPlayingCall(callId);
      setCurrentAudio(audio);
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  const toggleTranscript = (callId: number) => {
    setExpandedCall(expandedCall === callId ? null : callId);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">Misslyckades att ladda dashboard data</p>
      </div>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="space-y-6">
      {/* Header with date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Översikt över dina samtalsstatistik</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-32 animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard content */}
      {data && (
        <>
          {/* Metrics cards */}
          <DashboardMetricsCards data={data} dateRange={dateRange} />

          {/* Charts */}
          <DashboardCharts data={data.chartData} dateRange={dateRange} />

          {/* Recent calls and activity */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recent Calls */}
            <Card>
              <CardHeader>
                <CardTitle>Senaste Samtal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.recentCalls.map((call) => {
                    const transcriptTurns = formatTranscript(call.transcript);
                    const isExpanded = expandedCall === call.id;
                    const isPlaying = playingCall === call.id;

                    return (
                      <Card key={call.id} className="hover:shadow-sm transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <User className="h-3 w-3" />
                                {call.customerName}
                                <Badge
                                  variant={
                                    call.outcome === 'completed' ? 'default' :
                                    call.outcome === 'failed' ? 'destructive' : 'secondary'
                                  }
                                >
                                  {call.outcome === 'completed' ? 'Lyckad' :
                                   call.outcome === 'failed' ? 'Misslyckad' :
                                   'Pågående'}
                                </Badge>
                              </CardTitle>
                              <CardDescription className="flex items-center gap-4 text-xs mt-1">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {call.fromNumber}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {call.duration ? formatDuration(call.duration) : '0:00'}
                                </div>
                                {call.elevenlabsCost && (
                                  <div className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {call.elevenlabsCost} kr
                                  </div>
                                )}
                              </CardDescription>
                            </div>

                            <div className="flex items-center gap-1">
                              {(call.audioFileName || call.audioData) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => togglePlayback(call.id, call.audioData, call.audioFileName)}
                                  className="h-7 px-2 text-xs"
                                >
                                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                </Button>
                              )}

                              {transcriptTurns.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleTranscript(call.id)}
                                  className="h-7 px-2 text-xs"
                                >
                                  {isExpanded ? 'Dölj' : 'Visa'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        {isExpanded && transcriptTurns.length > 0 && (
                          <CardContent className="pt-0">
                            <div className="border-t pt-3">
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {transcriptTurns.slice(0, 3).map((turn, index) => (
                                  <div key={index} className={`flex gap-2 p-2 rounded text-xs ${
                                    turn.speaker === 'agent'
                                      ? 'bg-blue-50 text-blue-900'
                                      : 'bg-gray-50 text-gray-900'
                                  }`}>
                                    <span className="font-medium min-w-[60px]">
                                      {turn.speaker === 'agent' ? 'Agent:' : 'Kund:'}
                                    </span>
                                    <span>{turn.message}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Suspense fallback={<div>Laddar aktiviteter...</div>}>
              <ActivityLog />
            </Suspense>
          </div>
        </>
      )}
      </div>
    </section>
  );
}

export default function OverviewPage() {
  return (
    <AIReceptionistLayout>
      <OverviewContent />
    </AIReceptionistLayout>
  );
}