'use client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { useActionState } from 'react';
import { TeamDataWithMembers, User } from '@/lib/db/schema';
import { removeTeamMember, inviteTeamMember, updateTeam, leaveTeam } from '@/app/(login)/actions';
import useSWR, { mutate } from 'swr';
import { Suspense } from 'react';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle } from 'lucide-react';

type ActionState = {
  error?: string;
  success?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function TeamSettingsSkeleton() {
  return (
    <Card className="mb-8 h-[200px]">
      <CardHeader>
        <CardTitle>Team Settings</CardTitle>
      </CardHeader>
    </Card>
  );
}

function TeamSettings() {
  const { data: teamData, error: teamError } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const { data: user } = useSWR<User>('/api/user', fetcher);

  // Check if current user is owner of THIS team (not global role)
  const currentUserMembership = teamData?.teamMembers?.find(member => member.user.id === user?.id);
  const isOwner = currentUserMembership?.role === 'owner';

  const updateTeamWithCache = async (prevState: ActionState, formData: FormData) => {
    const result = await updateTeam(prevState, formData);
    if ('success' in result && result.success) {
      mutate('/api/team');
    }
    return result;
  };

  const [updateState, updateAction, isUpdatePending] = useActionState<
    ActionState,
    FormData
  >(updateTeamWithCache, {});

  // Show team error if there's one
  if (teamError) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">
            <p className="font-medium">Failed to load team settings</p>
            <p className="text-sm mt-1">Error: {teamError.message || 'Unknown error'}</p>
            <div className="mt-4 p-4 bg-gray-100 rounded text-sm text-gray-700">
              <p className="font-medium mb-2">Debug Info:</p>
              <p>User ID: {user?.id}</p>
              <p>User Email: {user?.email}</p>
              <p>User Role: {user?.role}</p>
              <p className="mt-2">
                <a
                  href="/api/debug-team"
                  target="_blank"
                  className="text-blue-600 underline"
                >
                  View detailed debug info
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Team Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Team Name</label>
            <form action={updateAction} className="flex items-center gap-2">
              <Input
                name="name"
                key={teamData?.name} // Force re-render when data changes
                defaultValue={teamData?.name || ''}
                placeholder="Team name"
                disabled={!isOwner}
                className="flex-1"
                required
              />
              {isOwner && (
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={isUpdatePending}
                >
                  {isUpdatePending ? 'Saving...' : 'Save'}
                </Button>
              )}
            </form>
            {isOwner && updateState?.error && (
              <p className="text-red-500 text-sm mt-1">{updateState.error}</p>
            )}
            {isOwner && updateState?.success && (
              <p className="text-green-500 text-sm mt-1">{updateState.success}</p>
            )}
            {!isOwner && (
              <p className="text-xs text-muted-foreground mt-1">
                Only team owners can edit the team name
              </p>
            )}
          </div>

          {/* Subscription Info */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Subscription</h4>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-4 sm:mb-0">
                <p className="font-medium">
                  Current Plan: {teamData?.planName || 'Free'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {teamData?.subscriptionStatus === 'active'
                    ? 'Billed monthly'
                    : teamData?.subscriptionStatus === 'trialing'
                    ? 'Trial period'
                    : 'No active subscription'}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Fakturering hanteras manuellt
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamMembersSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-4 mt-1">
          <div className="flex items-center space-x-4">
            <div className="size-8 rounded-full bg-gray-200"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-3 w-14 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamMembers() {
  const { data: teamData, error, isLoading } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const { data: currentUser } = useSWR<User>('/api/user', fetcher);

  const removeTeamMemberWithCache = async (prevState: ActionState, formData: FormData) => {
    const result = await removeTeamMember(prevState, formData);
    if ('success' in result && result.success) {
      mutate('/api/team');
    }
    return result;
  };

  const leaveTeamWithCache = async (prevState: ActionState, formData: FormData) => {
    const result = await leaveTeam(prevState, formData);
    if ('success' in result && result.success) {
      mutate('/api/team');
      mutate('/api/user');
      if (result.redirect) {
        window.location.href = '/dashboard';
      }
    }
    return result;
  };

  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeTeamMemberWithCache, {});

  const [leaveState, leaveAction, isLeavePending] = useActionState<
    ActionState,
    FormData
  >(leaveTeamWithCache, {});

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || 'Unknown User';
  };

  // Show loading state
  if (isLoading) {
    return <TeamMembersSkeleton />;
  }

  // Show error state
  if (error) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">
            <p className="font-medium">Failed to load team data</p>
            <p className="text-sm mt-1">Error: {error.message || 'Unknown error'}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try refreshing the page or contact support if this persists.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show no team state (teamData is null)
  if (!teamData) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-yellow-600">
            <p className="font-medium">No team found</p>
            <p className="text-sm mt-1">
              You don't appear to be a member of any team yet.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Ask a team owner to invite you, or contact support if you believe this is an error.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty team members
  if (!teamData.teamMembers?.length) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Team "{teamData.name}" has no active members.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {teamData.teamMembers.map((member, index) => {
            const isCurrentUser = member.user.id === currentUser?.id;
            // Check if current user is owner of THIS team (not global role)
            const currentUserMembership = teamData.teamMembers.find(m => m.user.id === currentUser?.id);
            const isCurrentUserOwner = currentUserMembership?.role === 'owner';
            const canRemoveMember = isCurrentUserOwner && !isCurrentUser;

            return (
              <li key={member.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarFallback>
                      {getUserDisplayName(member.user)
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {getUserDisplayName(member.user)}
                      {isCurrentUser && <span className="text-muted-foreground ml-2">(You)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {member.role}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isCurrentUser && (
                    <form action={leaveAction}>
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={isLeavePending}
                        className="text-red-600 hover:text-red-700"
                      >
                        {isLeavePending ? 'Leaving...' : 'Leave Team'}
                      </Button>
                    </form>
                  )}
                  {canRemoveMember && (
                    <form action={removeAction}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={isRemovePending}
                        className="text-red-600 hover:text-red-700"
                      >
                        {isRemovePending ? 'Removing...' : 'Remove'}
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Error Messages */}
        {removeState?.error && (
          <p className="text-red-500 mt-4">{removeState.error}</p>
        )}
        {removeState?.success && (
          <p className="text-green-500 mt-4">{removeState.success}</p>
        )}
        {leaveState?.error && (
          <p className="text-red-500 mt-4">{leaveState.error}</p>
        )}
        {leaveState?.success && (
          <p className="text-green-500 mt-4">{leaveState.success}</p>
        )}
      </CardContent>
    </Card>
  );
}

function InviteTeamMemberSkeleton() {
  return (
    <Card className="h-[260px]">
      <CardHeader>
        <CardTitle>Invite Team Member</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InviteTeamMember() {
  const { data: teamData } = useSWR<TeamDataWithMembers>('/api/team', fetcher);
  const { data: user } = useSWR<User>('/api/user', fetcher);

  // Check if current user is owner of THIS team (not global role)
  const currentUserMembership = teamData?.teamMembers?.find(member => member.user.id === user?.id);
  const isOwner = currentUserMembership?.role === 'owner';

  const inviteTeamMemberWithCache = async (prevState: ActionState, formData: FormData) => {
    const result = await inviteTeamMember(prevState, formData);
    if ('success' in result && result.success) {
      mutate('/api/team');
    }
    return result;
  };

  const [inviteState, inviteAction, isInvitePending] = useActionState<
    ActionState,
    FormData
  >(inviteTeamMemberWithCache, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Team Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={inviteAction} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-2">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter email"
              required
              disabled={!isOwner}
            />
          </div>
          <div>
            <Label>Role</Label>
            <RadioGroup
              defaultValue="member"
              name="role"
              className="flex space-x-4"
              disabled={!isOwner}
            >
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="member" id="member" />
                <Label htmlFor="member">Member</Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="owner" id="owner" />
                <Label htmlFor="owner">Owner</Label>
              </div>
            </RadioGroup>
          </div>
          {inviteState?.error && (
            <p className="text-red-500">{inviteState.error}</p>
          )}
          {inviteState?.success && (
            <p className="text-green-500">{inviteState.success}</p>
          )}
          <Button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={isInvitePending || !isOwner}
          >
            {isInvitePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Invite Member
              </>
            )}
          </Button>
        </form>
      </CardContent>
      {!isOwner && (
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            You must be a team owner to invite new members.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Team Settings</h1>
      <Suspense fallback={<TeamSettingsSkeleton />}>
        <TeamSettings />
      </Suspense>
      <Suspense fallback={<TeamMembersSkeleton />}>
        <TeamMembers />
      </Suspense>
      <Suspense fallback={<InviteTeamMemberSkeleton />}>
        <InviteTeamMember />
      </Suspense>
    </section>
  );
}
