'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useSWR from 'swr';
import { Suspense, useState, useEffect } from 'react';
import { ArrowLeft, Phone, Settings, DollarSign, Clock, Activity, Edit, Trash2, Zap, CheckCircle, XCircle, AlertCircle, Play, Pause, User, Loader2, Globe, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { useRouter } from 'next/navigation';

interface TranscriptTurn {
  speaker: 'agent' | 'user';
  message: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

type CustomerData = {
  customer: {
    id: number;
    name: string;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    websiteUrl: string | null;
    restaurantSlug: string | null;
    knowledgeBaseId: string | null;
    twilioNumber: string | null;
    agentId: string | null;
    elevenlabsApiKey: string | null;
    planType: string;
    webhookTwilioStatus: string | null;
    webhookElevenlabsStatus: string | null;
    webhookTwilioUrl: string | null;
    webhookElevenlabsUrl: string | null;
    // Auto-Update Settings
    updateFrequency: string | null;
    hasDailySpecial: string | null;
    dailyUpdateTime: string | null;
    lastDailyHash: string | null;
    lastUpdateDate: string | null;
    createdAt: string;
  };
  monthUsage: {
    totalMinutes: string | null;
    totalCost: string | null;
    totalRevenue: string | null;
    totalMargin: string | null;
  } | null;
  recentCalls: Array<{
    id: number;
    callSid: string;
    fromNumber: string;
    toNumber: string;
    outcome: string;
    duration: string;
    datetime: Date;
    transcript: string | null;
    elevenlabsCost: string | null;
    cost: string | null;
    audioData?: string; // Legacy Base64 audio
    audioFileName?: string; // Supabase Storage filename
  }>;
  integrations: Array<{
    id: number;
    type: string;
    method: string;
    status: string;
    config: string | null;
  }>;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CustomerDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-[200px]">
            <CardHeader>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CustomerDetails({ customerId }: { customerId: number }) {
  const { data, error, mutate } = useSWR<CustomerData>(`/api/customers/${customerId}`, fetcher);
  const [isDeleting, setIsDeleting] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [playingCall, setPlayingCall] = useState<number | null>(null);
  const [expandedCall, setExpandedCall] = useState<number | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [editData, setEditData] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    twilioNumber: '',
    agentId: '',
    elevenlabsApiKey: '',
    websiteUrl: '',
    restaurantSlug: '',
    knowledgeBaseId: '',
    updateFrequency: 'none',
    hasDailySpecial: 'false',
    dailyUpdateTime: ''
  });
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<{ type: 'idle' | 'success' | 'error', message?: string }>({ type: 'idle' });
  const [isUpdatingKB, setIsUpdatingKB] = useState(false);
  const [kbUpdateStatus, setKbUpdateStatus] = useState<{ type: 'idle' | 'success' | 'error', message?: string }>({ type: 'idle' });
  const router = useRouter();

  // Initialize edit data when customer data loads
  useEffect(() => {
    if (data?.customer) {
      setEditData({
        contactName: data.customer.contactName || '',
        contactPhone: data.customer.contactPhone || '',
        contactEmail: data.customer.contactEmail || '',
        twilioNumber: data.customer.twilioNumber || '',
        agentId: data.customer.agentId || '',
        elevenlabsApiKey: data.customer.elevenlabsApiKey || '',
        websiteUrl: data.customer.websiteUrl || '',
        restaurantSlug: data.customer.restaurantSlug || '',
        knowledgeBaseId: data.customer.knowledgeBaseId || '',
        updateFrequency: data.customer.updateFrequency || 'none',
        hasDailySpecial: data.customer.hasDailySpecial || 'false',
        dailyUpdateTime: data.customer.dailyUpdateTime || ''
      });
    }
  }, [data?.customer]);

  const deleteCustomer = async () => {
    if (!data?.customer) return;

    if (!confirm(`Är du säker på att du vill ta bort kunden "${data.customer.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Customer deleted:', result);
        router.push('/customers');
      } else {
        console.error('Delete error:', result);
        alert(`Fel: ${result.error}`);
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Nätverksfel vid borttagning');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleWebhookAction = async (action: 'configure' | 'test', webhookType: 'twilio' | 'elevenlabs') => {
    setWebhookLoading(`${action}-${webhookType}`);
    try {
      const response = await fetch(`/api/customers/${customerId}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, webhookType }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`${webhookType} webhook ${action}:`, result);
        if (action === 'configure') {
          mutate(); // Refresh customer data
        }
        alert(result.message);
      } else {
        alert(`${webhookType} webhook ${action} misslyckades: ${result.message}`);
      }
    } catch (error) {
      console.error(`${webhookType} webhook ${action} error:`, error);
      alert('Nätverksfel');
    } finally {
      setWebhookLoading(null);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'inactive':
      default:
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'Aktiv';
      case 'error':
        return 'Fel';
      case 'inactive':
      default:
        return 'Inaktiv';
    }
  };

  if (error) return <div>Failed to load customer details</div>;
  if (!data || !data.customer) return <CustomerDetailsSkeleton />;

  const { customer, monthUsage, recentCalls, integrations } = data;

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset data
      setEditData({
        contactName: customer.contactName || '',
        contactPhone: customer.contactPhone || '',
        contactEmail: customer.contactEmail || '',
        twilioNumber: customer.twilioNumber || '',
        agentId: customer.agentId || '',
        elevenlabsApiKey: customer.elevenlabsApiKey || '',
        websiteUrl: customer.websiteUrl || '',
        restaurantSlug: customer.restaurantSlug || '',
        knowledgeBaseId: customer.knowledgeBaseId || '',
        updateFrequency: customer.updateFrequency || 'none',
        hasDailySpecial: customer.hasDailySpecial || 'false',
        dailyUpdateTime: customer.dailyUpdateTime || ''
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        // Refresh data
        mutate();
        setIsEditing(false);
      } else {
        const error = await response.json();
        alert(`Fel: ${error.error}`);
      }
    } catch (error) {
      alert('Fel vid uppdatering');
      console.error('Update error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleScrapeWebsite = async () => {
    if (!customer.websiteUrl) {
      alert('Ingen Website URL konfigurerad');
      return;
    }

    setIsScraping(true);
    setScrapeStatus({ type: 'idle' });

    try {
      const response = await fetch(`/api/customers/${customerId}/scrape`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setScrapeStatus({
          type: 'success',
          message: `Scraping lyckades! Slug: ${result.slug || 'N/A'}, KB ID: ${result.knowledgeBaseId || 'synkas...'}`
        });
        // Refresh customer data
        mutate();
      } else {
        setScrapeStatus({
          type: 'error',
          message: result.error || 'Scraping misslyckades'
        });
      }
    } catch (error) {
      setScrapeStatus({
        type: 'error',
        message: 'Nätverksfel vid scraping'
      });
      console.error('Scrape error:', error);
    } finally {
      setIsScraping(false);
    }
  };

  const handleUpdateKB = async () => {
    if (!customer.knowledgeBaseId) {
      alert('Ingen Knowledge Base ID konfigurerad. Kör initial scraping först.');
      return;
    }

    setIsUpdatingKB(true);
    setKbUpdateStatus({ type: 'idle' });

    try {
      const response = await fetch(`/api/customers/${customerId}/update-kb`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        if (result.contentChanged) {
          setKbUpdateStatus({
            type: 'success',
            message: `KB uppdaterad! Nytt dokument: ${result.documentName || 'N/A'}`
          });
        } else {
          setKbUpdateStatus({
            type: 'success',
            message: 'Inget har ändrats - ingen uppdatering behövdes'
          });
        }
        // Refresh customer data to show new hash and timestamp
        mutate();
      } else {
        setKbUpdateStatus({
          type: 'error',
          message: result.error || 'KB-uppdatering misslyckades'
        });
      }
    } catch (error) {
      setKbUpdateStatus({
        type: 'error',
        message: 'Nätverksfel vid KB-uppdatering'
      });
      console.error('KB update error:', error);
    } finally {
      setIsUpdatingKB(false);
    }
  };

  const handleCreateElevenlabsIntegration = async () => {
    if (!customer.agentId) {
      alert('Du måste först lägga till Agent ID för kunden');
      return;
    }

    if (!customer.elevenlabsApiKey) {
      alert('Du måste först lägga till ElevenLabs API-nyckel för kunden');
      return;
    }

    setWebhookLoading('create-integration');
    try {
      const response = await fetch(`/api/customers/${customerId}/integrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'elevenlabs',
          name: 'ElevenLabs Webhook',
          method: 'webhook',
          config: {
            agentId: customer.agentId,
            webhookUrl: `${window.location.origin}/api/elevenlabs/agent-callback?customerId=${customerId}`
          }
        }),
      });

      if (response.ok) {
        mutate(); // Refresh data
        alert('ElevenLabs integration skapad! Webhook konfigureras automatiskt.');
      } else {
        const error = await response.json();
        alert(`Fel: ${error.error}`);
      }
    } catch (error) {
      alert('Fel vid skapande av integration');
      console.error('Create integration error:', error);
    } finally {
      setWebhookLoading(null);
    }
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return '0 kr';
    return `${parseFloat(value).toFixed(0)} kr`;
  };

  const formatMinutes = (value: string | null | undefined) => {
    if (!value) return '0';
    return parseFloat(value).toFixed(1);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm">
            {customer.planType}
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={deleteCustomer}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {isDeleting ? 'Tar bort...' : 'Ta bort'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Månadsminuter</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(monthUsage?.totalMinutes)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kostnad</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(monthUsage?.totalCost)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intäkt</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(monthUsage?.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marginal</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(monthUsage?.totalMargin)}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Restaurant Scraping Info */}
      <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Restaurant Scraping Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  value={isEditing ? editData.websiteUrl : (customer.websiteUrl || 'Ej angiven')}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  readOnly={!isEditing}
                  className={isEditing ? "" : "bg-gray-50"}
                  placeholder="https://restaurang.se"
                />
              </div>
              <div>
                <Label htmlFor="restaurantSlug">Restaurant Slug</Label>
                <Input
                  id="restaurantSlug"
                  value={isEditing ? editData.restaurantSlug : (customer.restaurantSlug || 'Ej scrapad')}
                  onChange={(e) => handleInputChange('restaurantSlug', e.target.value)}
                  readOnly={!isEditing}
                  className={isEditing ? "font-mono" : "bg-gray-50 font-mono"}
                  placeholder="restaurang-namn"
                />
              </div>
              <div>
                <Label htmlFor="knowledgeBaseId">Knowledge Base ID</Label>
                <Input
                  id="knowledgeBaseId"
                  value={isEditing ? editData.knowledgeBaseId : (customer.knowledgeBaseId || 'Ej synkad')}
                  onChange={(e) => handleInputChange('knowledgeBaseId', e.target.value)}
                  readOnly={!isEditing}
                  className={isEditing ? "font-mono" : "bg-gray-50 font-mono"}
                  placeholder="kb_..."
                />
              </div>
            </div>

            {/* Scrape Button and Status */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {scrapeStatus.type === 'success' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">{scrapeStatus.message}</span>
                    </div>
                  )}
                  {scrapeStatus.type === 'error' && (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span className="text-sm">{scrapeStatus.message}</span>
                    </div>
                  )}
                  {isScraping && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Scraping website...</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleScrapeWebsite}
                  disabled={isScraping || !customer.websiteUrl}
                  className="flex items-center gap-2"
                >
                  {isScraping ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      Scrape Website
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Auto-Update Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Automatiska Uppdateringar
          </CardTitle>
          <CardDescription>
            Konfigurera automatisk scraping och uppdatering av Knowledge Base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Update Frequency */}
            <div className="space-y-2">
              <Label htmlFor="updateFrequency">Uppdateringsfrekvens</Label>
              {isEditing ? (
                <Select
                  value={editData.updateFrequency}
                  onValueChange={(value) => handleInputChange('updateFrequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj frekvens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen automatisk uppdatering</SelectItem>
                    <SelectItem value="daily">Daglig</SelectItem>
                    <SelectItem value="weekly">Veckovis</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={
                    customer.updateFrequency === 'daily' ? 'Daglig' :
                    customer.updateFrequency === 'weekly' ? 'Veckovis' :
                    'Ingen automatisk uppdatering'
                  }
                  readOnly
                  className="bg-gray-50"
                />
              )}
            </div>

            {/* Has Daily Special */}
            <div className="space-y-2">
              <Label htmlFor="hasDailySpecial">Har dagens special</Label>
              {isEditing ? (
                <Select
                  value={editData.hasDailySpecial}
                  onValueChange={(value) => handleInputChange('hasDailySpecial', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Nej</SelectItem>
                    <SelectItem value="true">Ja</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={customer.hasDailySpecial === 'true' ? 'Ja' : 'Nej'}
                  readOnly
                  className="bg-gray-50"
                />
              )}
            </div>

            {/* Daily Update Time */}
            <div className="space-y-2">
              <Label htmlFor="dailyUpdateTime">Daglig uppdateringstid</Label>
              <Input
                id="dailyUpdateTime"
                type="time"
                value={isEditing ? editData.dailyUpdateTime : (customer.dailyUpdateTime || '')}
                onChange={(e) => handleInputChange('dailyUpdateTime', e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? "" : "bg-gray-50"}
                placeholder="06:00"
              />
            </div>
          </div>

          {/* Last Update Status */}
          {customer.lastUpdateDate && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Senaste uppdatering:</span>
                <span className="font-medium">
                  {new Date(customer.lastUpdateDate).toLocaleString('sv-SE')}
                </span>
              </div>
              {customer.lastDailyHash && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">Innehålls-hash:</span>
                  <span className="font-mono text-xs text-gray-500">
                    {customer.lastDailyHash.substring(0, 16)}...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Manual Update Button */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {kbUpdateStatus.type === 'success' && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">{kbUpdateStatus.message}</span>
                  </div>
                )}
                {kbUpdateStatus.type === 'error' && (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">{kbUpdateStatus.message}</span>
                  </div>
                )}
                {isUpdatingKB && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Uppdaterar Knowledge Base...</span>
                  </div>
                )}
              </div>
              <Button
                onClick={handleUpdateKB}
                disabled={isUpdatingKB || !customer.knowledgeBaseId || !customer.restaurantSlug}
                className="flex items-center gap-2"
              >
                {isUpdatingKB ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uppdaterar...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Uppdatera KB Nu
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Kundinställningar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="contactName">Kontaktperson</Label>
              <Input
                id="contactName"
                value={isEditing ? editData.contactName : (customer.contactName || '')}
                onChange={(e) => handleInputChange('contactName', e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? "" : "bg-gray-50"}
                placeholder="Kontaktperson"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactPhone">Telefon</Label>
              <Input
                id="contactPhone"
                value={isEditing ? editData.contactPhone : (customer.contactPhone || '')}
                onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? "" : "bg-gray-50"}
                placeholder="+46 70 123 45 67"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">E-post</Label>
              <Input
                id="contactEmail"
                value={isEditing ? editData.contactEmail : (customer.contactEmail || '')}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? "" : "bg-gray-50"}
                placeholder="kontakt@företag.se"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="twilioNumber">Twilio Nummer</Label>
              <Input
                id="twilioNumber"
                value={isEditing ? editData.twilioNumber : (customer.twilioNumber || 'Ej kopplat')}
                onChange={(e) => handleInputChange('twilioNumber', e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? "" : "bg-gray-50"}
                placeholder="+1 762 228 2381"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="agentId">Agent ID (ElevenLabs)</Label>
              <Input
                id="agentId"
                value={isEditing ? editData.agentId : (customer.agentId || 'Inte konfigurerat')}
                onChange={(e) => handleInputChange('agentId', e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? "" : "bg-gray-50"}
                placeholder="agent_1A2B3C4D5E6F"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="elevenlabsApiKey">ElevenLabs API-nyckel</Label>
              <Input
                id="elevenlabsApiKey"
                type="password"
                value={isEditing ? editData.elevenlabsApiKey : (customer.elevenlabsApiKey ? '••••••••••••••••' : 'Inte konfigurerat')}
                onChange={(e) => handleInputChange('elevenlabsApiKey', e.target.value)}
                readOnly={!isEditing}
                className={isEditing ? "" : "bg-gray-50"}
                placeholder="sk_..."
              />
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Sparar...' : 'Spara'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleEditToggle}
                    disabled={isUpdating}
                  >
                    Avbryt
                  </Button>
                </>
              ) : (
                <Button onClick={handleEditToggle}>
                  <Edit className="h-4 w-4 mr-2" />
                  Redigera inställningar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Integrationer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integrations.length === 0 ? (
                <p className="text-muted-foreground">Inga integrationer konfigurerade</p>
              ) : (
                integrations.map((integration) => (
                  <div key={integration.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium capitalize">{integration.type}</p>
                      <p className="text-sm text-muted-foreground">
                        Metod: {integration.method}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      integration.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {integration.status === 'active' ? 'Aktiv' : integration.status}
                    </span>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                onClick={() => handleCreateElevenlabsIntegration()}
                disabled={webhookLoading === 'create-integration'}
              >
                <Settings className="h-4 w-4 mr-2" />
                {webhookLoading === 'create-integration' ? 'Skapar...' : 'Skapa ElevenLabs Integration'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Webhook Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(customer.webhookTwilioStatus)}
                    <span className="font-medium">Twilio</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {getStatusText(customer.webhookTwilioStatus)}
                  </span>
                </div>
                {customer.webhookTwilioUrl && (
                  <p className="text-xs text-gray-400 font-mono mb-2 break-all">
                    {customer.webhookTwilioUrl}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWebhookAction('configure', 'twilio')}
                    disabled={webhookLoading === 'configure-twilio' || !customer.twilioNumber}
                  >
                    {webhookLoading === 'configure-twilio' ? 'Konfigurerar...' : 'Konfigurera'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWebhookAction('test', 'twilio')}
                    disabled={webhookLoading === 'test-twilio'}
                  >
                    {webhookLoading === 'test-twilio' ? 'Testar...' : 'Testa'}
                  </Button>
                </div>
              </div>

              <div className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(customer.webhookElevenlabsStatus)}
                    <span className="font-medium">ElevenLabs</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {getStatusText(customer.webhookElevenlabsStatus)}
                  </span>
                </div>
                {customer.webhookElevenlabsUrl && (
                  <p className="text-xs text-gray-400 font-mono mb-2 break-all">
                    {customer.webhookElevenlabsUrl}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWebhookAction('configure', 'elevenlabs')}
                    disabled={webhookLoading === 'configure-elevenlabs' || !customer.agentId}
                  >
                    {webhookLoading === 'configure-elevenlabs' ? 'Konfigurerar...' : 'Konfigurera'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWebhookAction('test', 'elevenlabs')}
                    disabled={webhookLoading === 'test-elevenlabs'}
                  >
                    {webhookLoading === 'test-elevenlabs' ? 'Testar...' : 'Testa'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Senaste Samtal</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCalls.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Inga samtal än</h3>
              <p className="text-gray-600">Samtal kommer att visas här när de kommer in</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentCalls.map((call) => {
                const transcriptTurns = formatTranscript(call.transcript);
                const isExpanded = expandedCall === call.id;
                const isPlaying = playingCall === call.id;

                return (
                  <Card key={call.id} className="transition-all duration-200 hover:shadow-md">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Samtal från {call.fromNumber}</CardTitle>
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
        </CardContent>
      </Card>
    </div>
  );
}

import AIReceptionistLayout from '../../ai-layout';

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const customerId = parseInt(id, 10);

  if (isNaN(customerId)) {
    return <div>Invalid customer ID</div>;
  }

  return (
    <AIReceptionistLayout>
      <section className="flex-1 p-4 lg:p-8">
        <Suspense fallback={<CustomerDetailsSkeleton />}>
          <CustomerDetails customerId={customerId} />
        </Suspense>
      </section>
    </AIReceptionistLayout>
  );
}