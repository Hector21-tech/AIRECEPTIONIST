'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, Phone, Menu, Building2 } from 'lucide-react';
import useSWR from 'swr';

type TeamData = {
  id: number;
  name: string;
  teamMembers: Array<{
    id: number;
    role: string;
    user: {
      id: number;
      email: string;
      name: string | null;
    };
  }>;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type User = {
  id: number;
  email: string;
  name?: string | null;
  role: string;
};

function TeamInfo() {
  const { data: teamData } = useSWR<TeamData>('/api/team', fetcher);
  const { data: user } = useSWR<User>('/api/user', fetcher);

  if (!teamData || !user) {
    return (
      <div className="mb-6 px-2 py-3 bg-gray-100 rounded-lg">
        <div className="flex items-center text-gray-500">
          <Building2 className="h-4 w-4 mr-2" />
          <span className="text-sm">Laddar team...</span>
        </div>
      </div>
    );
  }

  const memberCount = teamData.teamMembers?.length || 0;
  const roleText = user.role === 'owner' ? 'Ägare' : 'Medlem';

  return (
    <div className="mb-4 px-3 py-2 border-b border-gray-100">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        TEAM
      </p>
      <div className="flex items-center text-gray-600">
        <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">
            {teamData.name}
          </p>
          <p className="text-xs text-gray-500">
            {memberCount} medlem{memberCount !== 1 ? 'mar' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AIReceptionistLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { href: '/overview', icon: BarChart3, label: 'Översikt' },
    { href: '/customers', icon: Users, label: 'Kunder' },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <div className="flex items-center">
          <Phone className="h-5 w-5 mr-2 text-blue-600" />
          <span className="font-medium">AI-Receptionist</span>
        </div>
        <Button
          className="-mr-3"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <aside
          className={`w-64 bg-white lg:bg-gray-50 border-r border-gray-200 lg:block ${
            isSidebarOpen ? 'block' : 'hidden'
          } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="h-full overflow-y-auto p-4">
            <div className="flex items-center mb-6 px-2">
              <Phone className="h-6 w-6 mr-3 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">AI-Receptionist</h2>
            </div>

            <TeamInfo />

            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={`shadow-none my-1 w-full justify-start ${
                    pathname === item.href ? 'bg-blue-100 text-blue-900' : ''
                  }`}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}

            <div className="mt-8 px-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Andra inställningar
              </h3>
              <Link href="/dashboard" passHref>
                <Button
                  variant="ghost"
                  className="shadow-none my-1 w-full justify-start text-gray-600"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  Team inställningar
                </Button>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-0 lg:p-4">{children}</main>
      </div>
    </div>
  );
}