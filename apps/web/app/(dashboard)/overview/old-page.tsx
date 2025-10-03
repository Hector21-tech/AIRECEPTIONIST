'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';
import { Suspense, useState } from 'react';
import { Phone, Clock, DollarSign, TrendingUp, TrendingDown, Activity, Play, Pause, User } from 'lucide-react';

interface TranscriptTurn {
  speaker: 'agent' | 'user';
  message: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

type DashboardMetrics = {
  activeCustomers: number;
  monthlyMetrics: {
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
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function MetricsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MetricsCards() {
  const { data: metrics, error } = useSWR<DashboardMetrics>('/api/dashboard/metrics', fetcher);

  if (error) return <div>Failed to load metrics</div>;
  if (!metrics) return <MetricsSkeleton />;

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return '0 kr';
    return `${parseFloat(value).toFixed(0)} kr`;
  };

  const formatMinutes = (value: string | null | undefined) => {
    if (!value) return '0';
    return parseFloat(value).toFixed(1);
  };

  const totalMargin = parseFloat(metrics.monthlyMetrics.totalMargin || '0');
  const totalRevenue = parseFloat(metrics.monthlyMetrics.totalRevenue || '0');
  const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Row - Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva Kunder</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Totalt konfigurerade
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Samtalstid</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(metrics.monthlyMetrics.totalMinutes)} min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Denna månad
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intäkter</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(metrics.monthlyMetrics.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fakturerat belopp
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kostnader</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(metrics.monthlyMetrics.totalCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Twilio + ElevenLabs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marginal</CardTitle>
            {totalMargin > 0 ? (
              <TrendingUp className="h-4 w-4 text-blue-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalMargin > 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {formatCurrency(metrics.monthlyMetrics.totalMargin)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {marginPercentage.toFixed(1)}% marginal
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecentCallsSkeleton() {
  return (
    <Card className="h-[400px]">
      <CardHeader>
        <CardTitle>Senaste Samtal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4 animate-pulse">
              <div className="h-4 w-4 rounded bg-gray-200" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentCalls() {
  const { data: metrics, error } = useSWR<DashboardMetrics>('/api/dashboard/metrics', fetcher);
  const [playingCall, setPlayingCall] = useState<number | null>(null);
  const [expandedCall, setExpandedCall] = useState<number | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  if (error) return <div>Failed to load recent calls</div>;
  if (!metrics) return <RecentCallsSkeleton />;

  const formatDuration = (seconds: string) => {
    const secs = parseInt(seconds, 10);
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTranscript = (transcript: string | null): TranscriptTurn[] => {
    if (!transcript) return [];

    try {
      const parsed = JSON.parse(transcript);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return [{ speaker: 'agent', message: transcript }];
    }

    return [];
  };

  const togglePlayback = (callId: number, audioData?: string, audioFileName?: string) => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    if (playingCall === callId) {
      setPlayingCall(null);
      return;
    }

    let audioUrl: string;
    let needsCleanup = false;

    if (audioFileName) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      audioUrl = `${supabaseUrl}/storage/v1/object/public/call-recordings/${audioFileName}`;
    } else if (audioData) {
      try {
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        audioUrl = URL.createObjectURL(audioBlob);
        needsCleanup = true;
      } catch (error) {
        console.error('Failed to process Base64 audio:', error);
        return;
      }
    } else {
      console.warn('No audio available for this call');
      return;
    }

    try {
      setPlayingCall(callId);
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);

      audio.onended = () => {
        setPlayingCall(null);
        setCurrentAudio(null);
        if (needsCleanup) URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPlayingCall(null);
        setCurrentAudio(null);
        if (needsCleanup) URL.revokeObjectURL(audioUrl);
      };

      audio.play().catch((error) => {
        console.error('Failed to start audio playback:', error);
        setPlayingCall(null);
        setCurrentAudio(null);
        if (needsCleanup) URL.revokeObjectURL(audioUrl);
      });
    } catch (error) {
      console.error('Failed to process audio:', error);
      setPlayingCall(null);
    }
  };

  const toggleTranscript = (callId: number) => {
    setExpandedCall(expandedCall === callId ? null : callId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Senaste Samtal</CardTitle>
      </CardHeader>
      <CardContent>
        {metrics.recentCalls.length === 0 ? (
          <div className="text-center py-8">
            <Phone className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-muted-foreground">Inga samtal än</p>
          </div>
        ) : (
          <div className="space-y-3">
            {metrics.recentCalls.map((call) => {
              const transcriptTurns = formatTranscript(call.transcript);
              const isExpanded = expandedCall === call.id;
              const isPlaying = playingCall === call.id;

              return (
                <Card key={call.id} className="border border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm">{call.customerName}</CardTitle>
                          <Badge variant={call.outcome === 'completed' ? 'default' : 'secondary'} className="text-xs">
                            {call.outcome}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          <div className="flex items-center gap-3">
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
                          </div>
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
                                ? 'bg-blue-50 border-l-2 border-blue-400'
                                : 'bg-green-50 border-l-2 border-green-400'
                            }`}>
                              <div className="flex-shrink-0">
                                {turn.speaker === 'agent' ? (
                                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                    🤖
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                                    👤
                                  </div>
                                )}
                              </div>
                              <div className="flex-grow">
                                <div className="font-medium text-xs">
                                  {turn.speaker === 'agent' ? 'AI' : 'Kund'}
                                </div>
                                <div className="text-gray-700">{turn.message}</div>
                              </div>
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
        )}
      </CardContent>
    </Card>
  );
}

import AIReceptionistLayout from '../ai-layout';
import PendingInvitations from '@/components/pending-invitations';
import ActivityLog from '@/components/activity-log';

type User = {
  id: number;
  email: string;
  name?: string | null;
};

function PendingInvitationsSkeleton() {
  return (
    <div className="mb-6 h-[100px] bg-gray-100 rounded-lg animate-pulse"></div>
  );
}

function ActivityLogSkeleton() {
  return (
    <Card className="h-[400px]">
      <CardHeader>
        <CardTitle>Senaste Aktiviteter</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
      </CardContent>
    </Card>
  );
}

function PendingInvitationsWrapper() {
  const { data: user, error } = useSWR<User>('/api/user', fetcher);

  if (error || !user?.email) {
    return null;
  }

  return <PendingInvitations userEmail={user.email} />;
}

function OverviewContent() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">AI-Receptionist Dashboard</h1>

      <div className="space-y-6">
        <Suspense fallback={<PendingInvitationsSkeleton />}>
          <PendingInvitationsWrapper />
        </Suspense>

        <Suspense fallback={<MetricsSkeleton />}>
          <MetricsCards />
        </Suspense>

        <div className="grid gap-6 md:grid-cols-2">
          <Suspense fallback={<RecentCallsSkeleton />}>
            <RecentCalls />
          </Suspense>

          <Suspense fallback={<ActivityLogSkeleton />}>
            <ActivityLog />
          </Suspense>
        </div>
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