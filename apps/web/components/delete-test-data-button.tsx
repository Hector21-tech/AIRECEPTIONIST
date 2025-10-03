'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteTestDataButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const deleteTestData = async () => {
    if (!confirm('Är du säker på att du vill ta bort all test-data?')) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/delete-test-data', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`✅ ${data.message}`);
        console.log('Delete test data results:', data);
        setTimeout(() => setResult(null), 3000);
      } else {
        setResult(`❌ Fel: ${data.error}`);
        console.error('Delete test data error:', data);
        setTimeout(() => setResult(null), 4000);
      }
    } catch (error) {
      setResult('❌ Nätverksfel');
      console.error('Network error:', error);
      setTimeout(() => setResult(null), 4000);
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={deleteTestData}
        disabled={isLoading}
        variant="destructive"
        size="sm"
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Tar bort...
          </>
        ) : (
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            Ta Bort Test-data
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