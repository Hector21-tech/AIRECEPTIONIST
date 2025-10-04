'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import AIReceptionistLayout from '../ai-layout';

type ScrapeStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ScraperPage() {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ScrapeStatus>('idle');
  const [result, setResult] = useState<{ slug?: string; message?: string; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url || !name) {
      return;
    }

    setStatus('loading');
    setResult(null);

    try {
      // Call scraper API - adjust URL based on your setup
      const scraperApiUrl = process.env.NEXT_PUBLIC_SCRAPER_API_URL || 'http://localhost:3001';
      const response = await fetch(`${scraperApiUrl}/api/scrape-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          name,
          syncToElevenLabs: true
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setResult(data);
        setUrl('');
        setName('');
      } else {
        setStatus('error');
        setResult({ error: data.error || 'Ett fel uppstod' });
      }
    } catch (error) {
      setStatus('error');
      setResult({ error: 'Kunde inte ansluta till scraper API' });
    }
  };

  return (
    <AIReceptionistLayout>
      <section className="flex-1 p-4 lg:p-8">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Restaurant Scraper</h1>
            <p className="text-gray-600">Scrapa restaurangdata från webbplatser och synka till ElevenLabs</p>
          </div>

          {/* Scrape Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Scrapa Ny Restaurang
              </CardTitle>
              <CardDescription>
                Ange restaurangens webbplats och namn för att börja scrapa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Restaurang URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    disabled={status === 'loading'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Restaurang Namn *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="T.ex. Torstens Ängelholm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={status === 'loading'}
                  />
                </div>

                <Button type="submit" disabled={status === 'loading'} className="w-full sm:w-auto">
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Startar scraping...
                    </>
                  ) : (
                    <>
                      <Globe className="mr-2 h-4 w-4" />
                      Starta Scraping
                    </>
                  )}
                </Button>
              </form>

              {/* Status Messages */}
              {status === 'success' && result && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-green-900">Scraping Startad!</h3>
                      <p className="text-sm text-green-700 mt-1">{result.message}</p>
                      {result.slug && (
                        <p className="text-sm text-green-600 mt-2">
                          Slug: <code className="bg-green-100 px-2 py-0.5 rounded">{result.slug}</code>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {status === 'error' && result?.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-red-900">Scraping Misslyckades</h3>
                      <p className="text-sm text-red-700 mt-1">{result.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hur det Fungerar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Ange URL och Namn</p>
                  <p className="text-sm text-gray-600">Mata in restaurangens webbplats och ett beskrivande namn</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Automatisk Scraping</p>
                  <p className="text-sm text-gray-600">Systemet hittar och extraherar öppettider, meny, kontaktinfo automatiskt</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">ElevenLabs Sync</p>
                  <p className="text-sm text-gray-600">Data synkas automatiskt till ElevenLabs för AI-receptionist</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </AIReceptionistLayout>
  );
}
