'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Building2, Phone, Volume2, Link as LinkIcon, Save, Plus, Trash2, Globe, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import AIReceptionistLayout from '../../ai-layout';
import { swedishToUTC, getSwedishTimeDescription } from '@/lib/utils/timezone';

type Integration = {
  id: string;
  name: string;
  type: 'api' | 'webhook' | 'sms' | 'email' | 'booking' | 'pos' | 'other';
  method: string;
  config: Record<string, string>;
};

type CustomerFormData = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  twilioNumber: string;
  elevenlabsAgentId: string;
  planType: string;
  planPricePerMinute: string;
  planSetupFee: string;
  fallbackSms: string;
  description: string;
  updateFrequency: string;
  hasDailySpecial: string;
  dailyUpdateTime: string;
  integrations: Integration[];
};

const initialFormData: CustomerFormData = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  websiteUrl: '',
  twilioNumber: '',
  elevenlabsAgentId: '',
  planType: 'standard',
  planPricePerMinute: '5.00',
  planSetupFee: '5000.00',
  fallbackSms: '',
  description: '',
  updateFrequency: 'none',
  hasDailySpecial: 'false',
  dailyUpdateTime: '',
  integrations: [],
};

function NewCustomerContent() {
  const router = useRouter();
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addIntegration = () => {
    const newIntegration: Integration = {
      id: crypto.randomUUID(),
      name: '',
      type: 'api',
      method: '',
      config: {},
    };
    setFormData(prev => ({
      ...prev,
      integrations: [...prev.integrations, newIntegration]
    }));
  };

  const removeIntegration = (id: string) => {
    setFormData(prev => ({
      ...prev,
      integrations: prev.integrations.filter(integration => integration.id !== id)
    }));
  };

  const updateIntegration = (id: string, updates: Partial<Integration>) => {
    setFormData(prev => ({
      ...prev,
      integrations: prev.integrations.map(integration =>
        integration.id === id ? { ...integration, ...updates } : integration
      )
    }));
  };

  const updateIntegrationConfig = (id: string, key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      integrations: prev.integrations.map(integration =>
        integration.id === id
          ? { ...integration, config: { ...integration.config, [key]: value } }
          : integration
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Convert Swedish time to UTC before sending
      const dailyUpdateTimeUTC = formData.dailyUpdateTime
        ? swedishToUTC(formData.dailyUpdateTime)
        : '';

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          contactPhone: formData.contactPhone,
          websiteUrl: formData.websiteUrl,
          twilioNumber: formData.twilioNumber,
          agentId: formData.elevenlabsAgentId,
          planType: formData.planType,
          fallbackSms: formData.fallbackSms,
          description: formData.description,
          updateFrequency: formData.updateFrequency,
          hasDailySpecial: formData.hasDailySpecial,
          dailyUpdateTime: dailyUpdateTimeUTC, // Send UTC time to backend
          integrations: formData.integrations,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create customer');
      }

      // Redirect back to customers list
      router.push('/customers');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till kunder
          </Button>
        </Link>
        <div>
          <h1 className="text-lg lg:text-2xl font-medium">Lägg till ny kund</h1>
          <p className="text-muted-foreground">
            Konfigurera en ny AI-receptionist för din kund
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* Grundinformation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Grundinformation
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label htmlFor="name">Företagsnamn *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                placeholder="Företagsnamn"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="contactName">Kontaktperson</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
                placeholder="Kontaktperson"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="contactEmail">E-post</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="info@foretag.se"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="contactPhone">Telefon</Label>
              <Input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                placeholder="+46 431 123 456"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Webbplats URL
              </Label>
              <Input
                id="websiteUrl"
                type="url"
                value={formData.websiteUrl}
                onChange={(e) => handleChange('websiteUrl', e.target.value)}
                placeholder="https://restaurang.se"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ange restaurangens webbplats för automatisk scraping och kunskapsbas-sync
              </p>
            </div>

            <div>
              <Label htmlFor="description">Beskrivning</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Beskrivning av verksamheten..."
                rows={3}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* AI-inställningar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              AI-inställningar
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="twilioNumber">Twilio-nummer</Label>
              <Input
                id="twilioNumber"
                value={formData.twilioNumber}
                onChange={(e) => handleChange('twilioNumber', e.target.value)}
                placeholder="+46 8 555 0123"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="elevenlabsAgentId">ElevenLabs Agent-ID</Label>
              <Input
                id="elevenlabsAgentId"
                value={formData.elevenlabsAgentId}
                onChange={(e) => handleChange('elevenlabsAgentId', e.target.value)}
                placeholder="agent_1A2B3C4D5E6F"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fallbackSms">Fallback SMS-nummer</Label>
              <Input
                id="fallbackSms"
                value={formData.fallbackSms}
                onChange={(e) => handleChange('fallbackSms', e.target.value)}
                placeholder="+46 70 123 45 67"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Prisplan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Prisplan
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="planType">Plan</Label>
              <Select
                value={formData.planType}
                onValueChange={(value) => handleChange('planType', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="custom">Anpassad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="planPricePerMinute">Pris per minut (kr)</Label>
              <Input
                id="planPricePerMinute"
                type="number"
                step="0.01"
                value={formData.planPricePerMinute}
                onChange={(e) => handleChange('planPricePerMinute', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="planSetupFee">Startavgift (kr)</Label>
              <Input
                id="planSetupFee"
                type="number"
                step="0.01"
                value={formData.planSetupFee}
                onChange={(e) => handleChange('planSetupFee', e.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Automatiska Uppdateringar */}
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
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Update Frequency */}
            <div>
              <Label htmlFor="updateFrequency">Uppdateringsfrekvens</Label>
              <Select
                value={formData.updateFrequency}
                onValueChange={(value) => handleChange('updateFrequency', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Välj frekvens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen automatisk uppdatering</SelectItem>
                  <SelectItem value="daily">Daglig</SelectItem>
                  <SelectItem value="weekly">Veckovis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Has Daily Special */}
            <div>
              <Label htmlFor="hasDailySpecial">Har dagens special</Label>
              <Select
                value={formData.hasDailySpecial}
                onValueChange={(value) => handleChange('hasDailySpecial', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Välj" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Nej</SelectItem>
                  <SelectItem value="true">Ja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Daily Update Time */}
            <div>
              <Label htmlFor="dailyUpdateTime">
                Daglig uppdateringstid (svensk tid)
              </Label>
              <Input
                id="dailyUpdateTime"
                type="time"
                value={formData.dailyUpdateTime}
                onChange={(e) => handleChange('dailyUpdateTime', e.target.value)}
                placeholder="10:00"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sparas som {getSwedishTimeDescription()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Integrationer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Integrationer
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addIntegration}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Lägg till integration
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {formData.integrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Inga integrationer tillagda än</p>
                <p className="text-sm">Klicka på "Lägg till integration" för att börja</p>
              </div>
            ) : (
              <div className="space-y-6">
                {formData.integrations.map((integration, index) => (
                  <Card key={integration.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Integration {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIntegration(integration.id)}
                          className="text-red-600 hover:text-red-700 gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Ta bort
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Namn *</Label>
                        <Input
                          value={integration.name}
                          onChange={(e) => updateIntegration(integration.id, { name: e.target.value })}
                          placeholder="t.ex. Bordsbokaren, TruePOS"
                          className="mt-1"
                          required
                        />
                      </div>

                      <div>
                        <Label>Typ</Label>
                        <Select
                          value={integration.type}
                          onValueChange={(value: Integration['type']) =>
                            updateIntegration(integration.id, { type: value })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="email">E-post</SelectItem>
                            <SelectItem value="booking">Bokning</SelectItem>
                            <SelectItem value="pos">Kassasystem</SelectItem>
                            <SelectItem value="other">Annat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Metod</Label>
                        <Input
                          value={integration.method}
                          onChange={(e) => updateIntegration(integration.id, { method: e.target.value })}
                          placeholder="t.ex. REST API, Puppeteer, SMTP"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>URL/Endpoint</Label>
                        <Input
                          value={integration.config.url || ''}
                          onChange={(e) => updateIntegrationConfig(integration.id, 'url', e.target.value)}
                          placeholder="https://api.example.com"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>API Nyckel</Label>
                        <Input
                          type="password"
                          value={integration.config.apiKey || ''}
                          onChange={(e) => updateIntegrationConfig(integration.id, 'apiKey', e.target.value)}
                          placeholder="API nyckel (valfri)"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>Telefonnummer</Label>
                        <Input
                          value={integration.config.phone || ''}
                          onChange={(e) => updateIntegrationConfig(integration.id, 'phone', e.target.value)}
                          placeholder="+46 70 123 45 67"
                          className="mt-1"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-red-800">{error}</div>
            </CardContent>
          </Card>
        )}

        {/* Åtgärder */}
        <div className="flex justify-between">
          <Link href="/customers">
            <Button variant="outline" disabled={isLoading}>
              Avbryt
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading} className="gap-2">
            <Save className="h-4 w-4" />
            {isLoading ? 'Skapar...' : 'Skapa kund'}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function NewCustomerPage() {
  return (
    <AIReceptionistLayout>
      <NewCustomerContent />
    </AIReceptionistLayout>
  );
}