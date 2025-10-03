'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, PhoneCall, Clock, DollarSign, User } from 'lucide-react';

interface CallRecord {
  id: number;
  callSid: string;
  fromNumber: string;
  toNumber: string;
  outcome: string;
  duration: string;
  datetime: Date;
  transcript: string | null;
  elevenlabsCost: string | null;
  customerName: string;
  audioData?: string; // Base64 encoded audio (legacy)
  audioFileName?: string; // Supabase Storage filename
}

interface TranscriptTurn {
  speaker: 'agent' | 'user';
  message: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingCall, setPlayingCall] = useState<number | null>(null);
  const [expandedCall, setExpandedCall] = useState<number | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      const response = await fetch('/api/calls');
      if (response.ok) {
        const data = await response.json();
        setCalls(data.calls || []);
      }
    } catch (error) {
      console.error('Failed to fetch calls:', error);
    } finally {
      setLoading(false);
    }
  };

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
      // If parsing fails, return as single turn
      return [{ speaker: 'agent', message: transcript }];
    }

    return [];
  };

  const togglePlayback = (callId: number, audioData?: string, audioFileName?: string) => {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }

    if (playingCall === callId) {
      setPlayingCall(null);
      return;
    }

    // Check if we have audio - prioritize Supabase Storage over legacy Base64
    let audioUrl: string;
    let needsCleanup = false;

    if (audioFileName) {
      // Use Supabase Storage URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      audioUrl = `${supabaseUrl}/storage/v1/object/public/call-recordings/${audioFileName}`;
      console.log('🎧 Using Supabase Storage URL:', audioUrl);
    } else if (audioData) {
      // Fallback to legacy Base64 data
      try {
        console.log('🎧 Using legacy Base64 audio data');
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
      console.log('🎧 Starting audio playback for call', callId);
      setPlayingCall(callId);

      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);

      // Set up event listeners
      audio.onplay = () => {
        console.log('🎵 Audio started playing');
      };

      audio.onended = () => {
        console.log('🎵 Audio playback ended');
        setPlayingCall(null);
        setCurrentAudio(null);
        if (needsCleanup) {
          URL.revokeObjectURL(audioUrl);
        }
      };

      audio.onerror = (e) => {
        console.error('🚨 Audio playback error:', e);
        setPlayingCall(null);
        setCurrentAudio(null);
        if (needsCleanup) {
          URL.revokeObjectURL(audioUrl);
        }
      };

      // Start playback
      audio.play().catch((error) => {
        console.error('Failed to start audio playback:', error);
        setPlayingCall(null);
        setCurrentAudio(null);
        if (needsCleanup) {
          URL.revokeObjectURL(audioUrl);
        }
      });

    } catch (error) {
      console.error('Failed to process audio:', error);
      setPlayingCall(null);
    }
  };

  const toggleTranscript = (callId: number) => {
    setExpandedCall(expandedCall === callId ? null : callId);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Laddar samtalshistorik...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Samtalshistorik</h1>
          <p className="text-muted-foreground mt-2">
            Alla inkommande samtal med transkript och ljuduppspelning
          </p>
        </div>
      </div>

      {calls.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <PhoneCall className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Inga samtal än</h3>
              <p className="text-gray-600">Samtal kommer att visas här när de kommer in</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => {
            const transcriptTurns = formatTranscript(call.transcript);
            const isExpanded = expandedCall === call.id;
            const isPlaying = playingCall === call.id;

            return (
              <Card key={call.id} className="transition-all duration-200 hover:shadow-md">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{call.customerName}</CardTitle>
                        <Badge variant={call.outcome === 'completed' ? 'default' : 'secondary'}>
                          {call.outcome}
                        </Badge>
                      </div>
                      <CardDescription>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {call.fromNumber}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatDuration(call.duration)}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {call.elevenlabsCost ? `${call.elevenlabsCost} kr` : 'Ingen kostnad'}
                          </div>
                        </div>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {(call.audioFileName || call.audioData) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => togglePlayback(call.id, call.audioData, call.audioFileName)}
                          className="flex items-center gap-1"
                        >
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          {isPlaying ? 'Pausa' : 'Spela ljud'}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="flex items-center gap-1 opacity-50"
                        >
                          <Play className="h-4 w-4" />
                          Inget ljud
                        </Button>
                      )}

                      {transcriptTurns.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleTranscript(call.id)}
                        >
                          {isExpanded ? 'Dölj' : 'Visa'} transkript
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && transcriptTurns.length > 0 && (
                  <CardContent>
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3 text-gray-900">Samtalslogg</h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {transcriptTurns.map((turn, index) => (
                          <div key={index} className={`flex gap-3 p-3 rounded-lg ${
                            turn.speaker === 'agent'
                              ? 'bg-blue-50 border-l-4 border-blue-400'
                              : 'bg-green-50 border-l-4 border-green-400'
                          }`}>
                            <div className="flex-shrink-0">
                              {turn.speaker === 'agent' ? (
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                  🤖
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                  👤
                                </div>
                              )}
                            </div>
                            <div className="flex-grow">
                              <div className="font-medium text-sm mb-1">
                                {turn.speaker === 'agent' ? 'AI Receptionist' : 'Kund'}
                                {turn.start_timestamp && (
                                  <span className="text-gray-500 font-normal ml-2">
                                    {Math.floor(turn.start_timestamp / 60)}:{(turn.start_timestamp % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-900">{turn.message}</div>
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
    </div>
  );
}