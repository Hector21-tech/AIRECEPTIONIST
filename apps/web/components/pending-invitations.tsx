'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, X, Mail } from 'lucide-react';
import useSWR from 'swr';
import { acceptInvitation, declineInvitation } from '@/app/(login)/actions';

type Invitation = {
  id: number;
  teamId: number;
  teamName: string | null;
  role: string;
  invitedAt: string;
  status: string;
};

type InvitationsResponse = {
  invitations: Invitation[];
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PendingInvitationsProps {
  userEmail: string;
}

export default function PendingInvitations({ userEmail }: PendingInvitationsProps) {
  const { data, error, mutate } = useSWR<InvitationsResponse>(
    `/api/invitations?email=${encodeURIComponent(userEmail)}`,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );

  const [isPending, startTransition] = useTransition();
  const [processingInvitation, setProcessingInvitation] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string
  } | null>(null);

  if (error) {
    return null; // Fail silently if we can't load invitations
  }

  if (!data || !data.invitations || data.invitations.length === 0) {
    return null; // Don't show component if no pending invitations
  }

  const handleAccept = (invitationId: number) => {
    setProcessingInvitation(invitationId);
    setActionFeedback(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('invitationId', invitationId.toString());

        const result = await acceptInvitation({}, formData);

        if ('error' in result && result.error) {
          setActionFeedback({ type: 'error', message: result.error });
        } else if ('success' in result && result.success) {
          setActionFeedback({ type: 'success', message: result.success });
          await mutate(); // Refresh the invitations list
        }
      } catch (error) {
        setActionFeedback({ type: 'error', message: 'Ett fel uppstod vid acceptering av inbjudan' });
      } finally {
        setProcessingInvitation(null);
      }
    });
  };

  const handleDecline = (invitationId: number) => {
    setProcessingInvitation(invitationId);
    setActionFeedback(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('invitationId', invitationId.toString());

        const result = await declineInvitation({}, formData);

        if ('error' in result && result.error) {
          setActionFeedback({ type: 'error', message: result.error });
        } else if ('success' in result && result.success) {
          setActionFeedback({ type: 'success', message: result.success });
          await mutate(); // Refresh the invitations list
        }
      } catch (error) {
        setActionFeedback({ type: 'error', message: 'Ett fel uppstod vid avböjning av inbjudan' });
      } finally {
        setProcessingInvitation(null);
      }
    });
  };

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Mail className="h-5 w-5" />
          Väntande Inbjudningar
          <Badge variant="secondary" className="bg-orange-200 text-orange-800">
            {data.invitations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg border border-orange-200"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">
                    Inbjudan till {invitation.teamName || 'Okänt team'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Roll: <span className="capitalize font-medium">{invitation.role}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Inbjuden: {new Date(invitation.invitedAt).toLocaleDateString('sv-SE')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleAccept(invitation.id)}
                  disabled={isPending || processingInvitation === invitation.id}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {processingInvitation === invitation.id ? 'Accepterar...' : 'Acceptera'}
                </Button>
                <Button
                  onClick={() => handleDecline(invitation.id)}
                  disabled={isPending || processingInvitation === invitation.id}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  {processingInvitation === invitation.id ? 'Avböjer...' : 'Avböj'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {actionFeedback && (
          <p className={`mt-4 text-sm ${
            actionFeedback.type === 'error'
              ? 'text-red-600'
              : 'text-green-600'
          }`}>
            {actionFeedback.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}