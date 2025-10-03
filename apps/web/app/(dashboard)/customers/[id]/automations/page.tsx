'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Play, Pause, Edit, Trash2, Workflow, GitBranch, Clock, Activity, Phone, MessageSquare, Target, Users, Settings, ExternalLink, Copy, CheckCircle, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import useSWR from 'swr';
import AIReceptionistLayout from '../../../ai-layout';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function BookingProxySection({ customerName }: { customerName: string }) {
  const [copied, setCopied] = useState(false);

  const proxyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/booking-proxy`
    : '/api/booking-proxy';

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
      <CardHeader>
        <CardTitle className="text-blue-900 flex items-center gap-2">
          <Settings className="h-5 w-5" />
          🍽️ Bordsbokaren Integration
        </CardTitle>
        <CardDescription className="text-blue-700">
          ElevenLabs Voice Agent → Bordsbokaren API för {customerName}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-blue-800">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Booking Proxy URL:</h4>
            <div className="flex items-center gap-2 p-3 bg-white/60 rounded-md border">
              <code className="flex-1 text-sm font-mono text-gray-800">{proxyUrl}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(proxyUrl)}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Kopierad!' : 'Kopiera'}
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Status:</h4>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Aktiv och redo</span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Format:</h4>
              <span className="text-sm">JSON → Form-urlencoded</span>
            </div>
          </div>

          <div className="border-t border-blue-200 pt-4">
            <h4 className="font-semibold mb-2">Så här fungerar det:</h4>
            <ul className="space-y-1 text-sm">
              <li>• ElevenLabs skickar JSON till proxy URL:en</li>
              <li>• Proxy konverterar till Bordsbokarens format</li>
              <li>• Bokning skapas automatiskt på Torstens</li>
              <li>• Booking ID returneras till ElevenLabs</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateAutomationModal({
  isOpen,
  onClose,
  customerId,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerType: 'call_completed',
    actions: [{ type: 'Send Email', config: {} }]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/customers/${customerId}/automations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          status: 'draft'
        }),
      });

      if (response.ok) {
        onSuccess();
        onClose();
        setFormData({
          name: '',
          description: '',
          triggerType: 'call_completed',
          actions: [{ type: 'Send Email', config: {} }]
        });
      } else {
        console.error('Failed to create automation');
      }
    } catch (error) {
      console.error('Error creating automation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Skapa Ny Automation</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Namn</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="T.ex. Bokningsbekräftelse"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Beskrivning</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
              rows={3}
              placeholder="Beskriv vad denna automation gör..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Trigger</label>
            <select
              value={formData.triggerType}
              onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="call_completed">Samtal avslutat</option>
              <option value="call_missed">Missat samtal</option>
              <option value="scheduled">Schemalagd</option>
              <option value="call_keyword">Nyckelord upptäckt</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Skapar...' : 'Skapa'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aktiv</Badge>;
    case 'paused':
      return <Badge variant="secondary">Pausad</Badge>;
    case 'draft':
      return <Badge variant="outline">Utkast</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getTriggerIcon = (triggerType: string) => {
  switch (triggerType) {
    case 'call_completed':
      return <Phone className="h-3 w-3" />;
    case 'call_missed':
      return <Phone className="h-3 w-3" />;
    case 'scheduled':
      return <Clock className="h-3 w-3" />;
    case 'call_keyword':
      return <MessageSquare className="h-3 w-3" />;
    default:
      return <Zap className="h-3 w-3" />;
  }
};

function AutomationsContent({ customerId }: { customerId: number }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: customerData } = useSWR(`/api/customers/${customerId}`, fetcher);
  const { data: automationsData, mutate: refreshAutomations } = useSWR(`/api/customers/${customerId}/automations`, fetcher);

  if (!customerData) {
    return <div>Laddar...</div>;
  }

  const customer = customerData.customer;
  const automations = automationsData?.automations || [];

  const activeAutomations = automations.filter((a: any) => a.status === 'active').length;
  const totalRuns = automations.reduce((sum: number, a: any) => sum + (a.runs || 0), 0);
  const avgSuccessRate = automations.length > 0 ? Math.round((automations.filter((a: any) => a.status === 'active').length / automations.length) * 100) : 0;

  const handleToggleAutomation = async (automationId: number, currentStatus: string) => {
    try {
      const action = currentStatus === 'active' ? 'pause' : 'play';
      const response = await fetch(`/api/customers/${customerId}/automations/${automationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        refreshAutomations();
      }
    } catch (error) {
      console.error('Error toggling automation:', error);
    }
  };

  const handleDeleteAutomation = async (automationId: number) => {
    if (!confirm('Är du säker på att du vill ta bort denna automation?')) {
      return;
    }

    try {
      const response = await fetch(`/api/customers/${customerId}/automations/${automationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        refreshAutomations();
      }
    } catch (error) {
      console.error('Error deleting automation:', error);
    }
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/customers">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tillbaka till kunder
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Automations för {customer.name}</h1>
              <p className="text-gray-600">Hantera automatiserade processer för denna kund</p>
            </div>
          </div>
          <Button
            className="flex items-center gap-2"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4" />
            Ny Automation
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktiva Automations</CardTitle>
              <Workflow className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAutomations}</div>
              <p className="text-xs text-muted-foreground">av {automations.length} totalt</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totala Körningar</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRuns}</div>
              <p className="text-xs text-muted-foreground">totala körningar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktiva</CardTitle>
              <Target className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgSuccessRate}%</div>
              <p className="text-xs text-muted-foreground">av totala automations</p>
            </CardContent>
          </Card>
        </div>

        {/* Automations List */}
        <Card>
          <CardHeader>
            <CardTitle>Automations för {customer.name}</CardTitle>
            <CardDescription>
              Hantera och övervaka automatiserade processer för denna kund
            </CardDescription>
          </CardHeader>
          <CardContent>
            {automations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Inga automations än</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Skapa din första automation för att komma igång med automatiserade processer.
                </p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Skapa automation
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {automations.map((automation: any) => (
                  <div
                    key={automation.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900">{automation.name}</h3>
                        {getStatusBadge(automation.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{automation.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          {getTriggerIcon(automation.triggerType)}
                          {automation.triggers} trigger{automation.triggers !== 1 ? 's' : ''}
                        </div>
                        <div className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {automation.actions} action{automation.actions !== 1 ? 's' : ''}
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {automation.runs || 0} körningar
                        </div>
                        {automation.lastRun && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Senast: {automation.lastRun}
                          </div>
                        )}
                      </div>
                      {automation.actions_list && (
                        <div className="flex gap-1 mt-2">
                          {automation.actions_list.map((action: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {action}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleAutomation(automation.id, automation.status)}
                        title={automation.status === 'active' ? 'Pausa automation' : 'Aktivera automation'}
                      >
                        {automation.status === 'active' ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Redigera automation"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAutomation(automation.id)}
                        title="Ta bort automation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Proxy Integration */}
        <BookingProxySection customerName={customer.name} />

        {/* Create Automation Modal */}
        <CreateAutomationModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          customerId={customerId}
          onSuccess={refreshAutomations}
        />

      </div>
    </section>
  );
}

export default function CustomerAutomationsPage({
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
      <AutomationsContent customerId={customerId} />
    </AIReceptionistLayout>
  );
}