'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';
import { Suspense } from 'react';
import { Phone, DollarSign, Users, PhoneCall, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { Customer } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CustomersSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="h-[140px]">
          <CardHeader>
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CustomersList() {
  const { data: customers, error } = useSWR<Customer[]>('/api/customers', fetcher);

  if (error) return <div>Failed to load customers</div>;
  if (!customers) return <CustomersSkeleton />;

  if (customers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Inga kunder än</h3>
          <p className="text-muted-foreground text-center mb-4">
            Lägg till din första kund för att komma igång med AI-receptionist systemet.
          </p>
          <Link href="/customers/new">
            <Button>Lägg till kund</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {customers.map((customer) => (
        <Card key={customer.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{customer.name}</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {customer.planType}
                </span>
                <Link href={`/customers/${customer.id}/automations`}>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    Automations
                  </Button>
                </Link>
                <Link href={`/customers/${customer.id}`}>
                  <Button variant="outline" size="sm">
                    Visa detaljer
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Kontakt</p>
                  <p className="font-medium">
                    {customer.contactName || customer.contactEmail || 'Ej angivet'}
                  </p>
                  {customer.contactPhone && (
                    <p className="text-sm text-muted-foreground">{customer.contactPhone}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Twilio Nummer</p>
                  <p className="font-medium">{customer.twilioNumber || 'Ej kopplat'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Skapad</p>
                  <p className="font-medium">
                    {new Date(customer.createdAt).toLocaleDateString('sv-SE')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import AIReceptionistLayout from '../ai-layout';

function CustomersContent() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">Kunder</h1>
        <div className="flex items-center space-x-3">
          <Link href="/calls">
            <Button variant="outline" className="flex items-center space-x-2">
              <PhoneCall className="h-4 w-4" />
              <span>Samtalshistorik</span>
            </Button>
          </Link>
          <Link href="/customers/new">
            <Button>Lägg till ny kund</Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<CustomersSkeleton />}>
        <CustomersList />
      </Suspense>
    </section>
  );
}

export default function CustomersPage() {
  return (
    <AIReceptionistLayout>
      <CustomersContent />
    </AIReceptionistLayout>
  );
}