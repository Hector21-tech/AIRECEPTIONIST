'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Loader2 } from 'lucide-react';

export default function TestWebhookButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const testWebhooks = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult('✅ Klart');
        console.log('🧪 Webhook test results:', data);
        // Auto-hide success message after 2 seconds
        setTimeout(() => setResult(null), 2000);
      } else {
        setResult(`❌ Fel: ${data.error}`);
        console.error('Test webhook error:', data);
        setTimeout(() => setResult(null), 4000);
      }
    } catch (error) {
      setResult('❌ Nätverksfel vid test');
      console.error('Network error:', error);
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={testWebhooks}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Testar webhooks...
          </>
        ) : (
          <>
            <Zap className="mr-2 h-4 w-4" />
            Testa Webhooks
          </>
        )}
      </Button>

      {result && (
        <p className="text-xs text-center text-gray-600">
          {result}
        </p>
      )}
    </div>
  );
}