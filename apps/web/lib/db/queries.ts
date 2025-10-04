import { desc, and, eq, isNull, sum, sql, or } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, teamMembers, teams, users, customers, usage, callLogs, integrations } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  // Get ALL user's team memberships
  const userTeamMembers = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt
    })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  if (userTeamMembers.length === 0) {
    return null;
  }

  // If user has multiple teams, prioritize:
  // 1. Teams where user is member (not owner of own team)
  // 2. Most recently joined team
  // 3. Fallback to first team
  let selectedTeamId: number;

  if (userTeamMembers.length === 1) {
    selectedTeamId = userTeamMembers[0].teamId;
  } else {
    // Multiple teams - prefer teams where user is member, not owner
    const memberTeams = userTeamMembers.filter(tm => tm.role === 'member');
    const ownerTeams = userTeamMembers.filter(tm => tm.role === 'owner');

    if (memberTeams.length > 0) {
      // Prefer member teams (invited teams)
      selectedTeamId = memberTeams.sort((a, b) =>
        new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
      )[0].teamId;
    } else if (ownerTeams.length > 0) {
      // Fallback to owner teams
      selectedTeamId = ownerTeams[0].teamId;
    } else {
      selectedTeamId = userTeamMembers[0].teamId;
    }
  }

  const teamId = selectedTeamId;

  // Get team info
  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (team.length === 0) {
    return null;
  }

  // Get all active team members
  const members = await db
    .select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email
      }
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        isNull(users.deletedAt)
      )
    );

  return {
    ...team[0],
    teamMembers: members
  };
}

// AI Receptionist queries
export async function getAllCustomers() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const teamData = await getTeamForUser();
  if (!teamData) {
    throw new Error('User not part of any team');
  }

  return await db
    .select()
    .from(customers)
    .where(eq(customers.teamId, teamData.id))
    .orderBy(desc(customers.createdAt));
}

export async function getCustomer(id: number) {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const teamData = await getTeamForUser();
  if (!teamData) {
    throw new Error('User not part of any team');
  }

  const result = await db
    .select()
    .from(customers)
    .where(and(
      eq(customers.id, id),
      eq(customers.teamId, teamData.id)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getCustomerWithUsage(id: number) {
  const customer = await getCustomer(id);
  if (!customer) return null;

  const currentMonth = new Date();
  currentMonth.setDate(1);

  const monthUsage = await db
    .select({
      totalMinutes: sum(usage.minutesUsed),
      totalCost: sum(usage.cost),
      totalRevenue: sum(usage.revenue),
      totalMargin: sum(usage.margin)
    })
    .from(usage)
    .where(and(
      eq(usage.customerId, id),
      sql`${usage.date} >= ${currentMonth.toISOString().split('T')[0]}`
    ));

  const recentCalls = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.customerId, id))
    .orderBy(desc(callLogs.datetime))
    .limit(10);

  const customerIntegrations = await db
    .select()
    .from(integrations)
    .where(eq(integrations.customerId, id));

  return {
    customer,
    monthUsage: monthUsage[0],
    recentCalls,
    integrations: customerIntegrations
  };
}

// NEW: Get only REAL data from actual call logs
export async function getRealDashboardMetrics(dateRange?: { from: Date; to: Date }) {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const teamData = await getTeamForUser();
  if (!teamData) {
    throw new Error('User not part of any team');
  }

  // Default to last 30 days if no range provided
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultTo.getDate() - 30);

  const fromDate = dateRange?.from || defaultFrom;
  const toDate = dateRange?.to || defaultTo;

  // Get REAL call data only from callLogs table
  const realCalls = await db
    .select({
      id: callLogs.id,
      callSid: callLogs.callSid,
      fromNumber: callLogs.fromNumber,
      toNumber: callLogs.toNumber,
      datetime: callLogs.datetime,
      outcome: callLogs.outcome,
      duration: callLogs.duration,
      customerName: customers.name,
      transcript: callLogs.transcript,
      elevenlabsCost: callLogs.elevenlabsCost,
      audioData: callLogs.audioData,
      audioFileName: callLogs.audioFileName,
      twilioPrice: callLogs.cost
    })
    .from(callLogs)
    .innerJoin(customers, eq(callLogs.customerId, customers.id))
    .where(and(
      eq(customers.teamId, teamData.id),
      sql`DATE(${callLogs.datetime}) >= ${fromDate.toISOString().split('T')[0]}`,
      sql`DATE(${callLogs.datetime}) <= ${toDate.toISOString().split('T')[0]}`
    ))
    .orderBy(desc(callLogs.datetime));

  // Calculate REAL metrics from actual calls
  const totalCalls = realCalls.length;
  const totalMinutes = realCalls.reduce((sum, call) => {
    const minutes = call.duration ? parseFloat(call.duration) / 60 : 0;
    return sum + minutes;
  }, 0);

  // Only show real costs, no fake revenue
  const totalTwilioCost = realCalls.reduce((sum, call) => {
    return sum + (call.twilioPrice ? parseFloat(call.twilioPrice) : 0);
  }, 0);

  const totalElevenLabsCost = realCalls.reduce((sum, call) => {
    return sum + (call.elevenlabsCost ? parseFloat(call.elevenlabsCost) : 0);
  }, 0);

  return {
    totalCalls,
    totalMinutes: Math.round(totalMinutes * 100) / 100, // Round to 2 decimals
    averageCallLength: totalCalls > 0 ? Math.round((totalMinutes / totalCalls) * 100) / 100 : 0,
    totalTwilioCost: Math.round(totalTwilioCost * 100) / 100,
    totalElevenLabsCost: Math.round(totalElevenLabsCost * 100) / 100,
    totalCost: Math.round((totalTwilioCost + totalElevenLabsCost) * 100) / 100,
    callsToday: realCalls.filter(call => {
      const today = new Date().toISOString().split('T')[0];
      const callDate = new Date(call.datetime).toISOString().split('T')[0];
      return callDate === today;
    }).length,
    recentCalls: realCalls.slice(0, 6), // Show 6 most recent
    dateRange: { from: fromDate, to: toDate }
  };
}

export async function getDashboardMetrics(dateRange?: { from: Date; to: Date }) {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const teamData = await getTeamForUser();
  if (!teamData) {
    throw new Error('User not part of any team');
  }

  // Default to last 30 days if no range provided
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultTo.getDate() - 30);

  const fromDate = dateRange?.from || defaultFrom;
  const toDate = dateRange?.to || defaultTo;

  // Only count customers belonging to current team
  const activeCustomers = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(eq(customers.teamId, teamData.id));

  // Get metrics for the selected date range
  const rangeMetrics = await db
    .select({
      totalMinutes: sum(usage.minutesUsed),
      totalCost: sum(usage.cost),
      totalRevenue: sum(usage.revenue),
      totalMargin: sum(usage.margin)
    })
    .from(usage)
    .innerJoin(customers, eq(usage.customerId, customers.id))
    .where(and(
      eq(customers.teamId, teamData.id),
      sql`${usage.date} >= ${fromDate.toISOString().split('T')[0]}`,
      sql`${usage.date} <= ${toDate.toISOString().split('T')[0]}`
    ));

  // Get daily stats for charts
  const dailyStats = await db
    .select({
      date: usage.date,
      totalCalls: sql<number>`count(${callLogs.id})`,
      totalCost: sum(usage.cost),
      totalRevenue: sum(usage.revenue),
      totalMinutes: sum(usage.minutesUsed)
    })
    .from(usage)
    .innerJoin(customers, eq(usage.customerId, customers.id))
    .leftJoin(callLogs, eq(callLogs.customerId, customers.id))
    .where(and(
      eq(customers.teamId, teamData.id),
      sql`${usage.date} >= ${fromDate.toISOString().split('T')[0]}`,
      sql`${usage.date} <= ${toDate.toISOString().split('T')[0]}`
    ))
    .groupBy(usage.date)
    .orderBy(usage.date);

  // Get hourly stats - include date in grouping for when we need specific day data
  const hourlyStats = await db
    .select({
      date: sql<string>`DATE(${callLogs.datetime})`,
      hour: sql<number>`EXTRACT(HOUR FROM ${callLogs.datetime})`,
      calls: sql<number>`count(*)`,
      totalCost: sql<number>`COALESCE(SUM(CAST(${callLogs.cost} AS DECIMAL) + CAST(${callLogs.elevenlabsCost} AS DECIMAL)), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(CAST(${callLogs.duration} AS INTEGER)), 0)`
    })
    .from(callLogs)
    .innerJoin(customers, eq(callLogs.customerId, customers.id))
    .where(and(
      eq(customers.teamId, teamData.id),
      sql`DATE(${callLogs.datetime}) >= ${fromDate.toISOString().split('T')[0]}`,
      sql`DATE(${callLogs.datetime}) <= ${toDate.toISOString().split('T')[0]}`
    ))
    .groupBy(sql`DATE(${callLogs.datetime})`, sql`EXTRACT(HOUR FROM ${callLogs.datetime})`)
    .orderBy(sql`DATE(${callLogs.datetime})`, sql`EXTRACT(HOUR FROM ${callLogs.datetime})`);

  // Get outcome stats
  const outcomeStats = await db
    .select({
      outcome: callLogs.outcome,
      count: sql<number>`count(*)`
    })
    .from(callLogs)
    .innerJoin(customers, eq(callLogs.customerId, customers.id))
    .where(and(
      eq(customers.teamId, teamData.id),
      sql`DATE(${callLogs.datetime}) >= ${fromDate.toISOString().split('T')[0]}`,
      sql`DATE(${callLogs.datetime}) <= ${toDate.toISOString().split('T')[0]}`
    ))
    .groupBy(callLogs.outcome);

  // Only get call logs for team's customers
  const recentCalls = await db
    .select({
      id: callLogs.id,
      callSid: callLogs.callSid,
      fromNumber: callLogs.fromNumber,
      toNumber: callLogs.toNumber,
      datetime: callLogs.datetime,
      outcome: callLogs.outcome,
      duration: callLogs.duration,
      customerName: customers.name,
      transcript: callLogs.transcript,
      elevenlabsCost: callLogs.elevenlabsCost,
      audioData: callLogs.audioData,
      audioFileName: callLogs.audioFileName
    })
    .from(callLogs)
    .innerJoin(customers, eq(callLogs.customerId, customers.id))
    .where(eq(customers.teamId, teamData.id))
    .orderBy(desc(callLogs.datetime))
    .limit(6);

  // Format chart data
  const chartData = {
    dailyStats: dailyStats.map(stat => ({
      date: stat.date,
      calls: Number(stat.totalCalls) || 0,
      cost: parseFloat(stat.totalCost as string) || 0,
      revenue: parseFloat(stat.totalRevenue as string) || 0,
      duration: parseFloat(stat.totalMinutes as string) * 60 || 0
    })),
    hourlyStats: Array.from({ length: 24 }, (_, hour) => {
      const stat = hourlyStats.find(s => s.hour === hour);
      return {
        hour,
        calls: stat?.calls || 0
      };
    }),
    outcomeStats: outcomeStats.map(stat => ({
      name: stat.outcome === 'completed' ? 'Lyckade' :
            stat.outcome === 'failed' ? 'Misslyckade' : 'Andra',
      value: stat.count,
      color: stat.outcome === 'completed' ? '#10b981' :
             stat.outcome === 'failed' ? '#ef4444' : '#f59e0b'
    }))
  };

  return {
    activeCustomers: activeCustomers[0]?.count || 0,
    rangeMetrics: rangeMetrics[0],
    recentCalls,
    chartData,
    dateRange: { from: fromDate, to: toDate }
  };
}

export async function createCustomer(data: {
  name: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  twilioNumber?: string;
  elevenlabsVoiceId?: string;
  planType?: string;
  description?: string;
  fallbackSms?: string;
  websiteUrl?: string;
  integrations?: {
    id: string;
    name: string;
    type: string;
    method: string;
    config: Record<string, string>;
  }[];
}) {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const teamData = await getTeamForUser();
  if (!teamData) {
    throw new Error('User not part of any team');
  }

  // Create the customer with team association
  const customerData = {
    name: data.name,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail,
    twilioNumber: data.twilioNumber,
    voiceId: data.elevenlabsVoiceId,
    planType: data.planType || 'Standard',
    description: data.description,
    websiteUrl: data.websiteUrl,
    teamId: teamData.id, // Associate with current user's team
  };

  const [customer] = await db.insert(customers).values(customerData).returning();

  // Create integrations if provided
  if (data.integrations && data.integrations.length > 0) {
    const integrationPromises = data.integrations.map(integration =>
      db.insert(integrations).values({
        customerId: customer.id,
        type: integration.type,
        method: integration.method,
        status: 'active',
        config: JSON.stringify({
          name: integration.name,
          ...integration.config,
          ...(data.fallbackSms && { fallbackSms: data.fallbackSms }),
        }),
      })
    );

    await Promise.all(integrationPromises);
  }

  return customer;
}

export async function createUsageRecord(data: {
  customerId: number;
  date: string;
  minutesUsed: string;
  cost: string;
  revenue: string;
  margin: string;
  callCount: number;
}) {
  return await db.insert(usage).values(data).returning();
}

export async function createCallLog(data: {
  customerId: number;
  transcript?: string;
  outcome: string;
  duration?: string;
  cost?: string;
  callSid?: string;
  fromNumber?: string;
  toNumber?: string;
  elevenlabsCost?: string;
}) {
  return await db.insert(callLogs).values(data).returning();
}

export async function updateOrCreateUsageRecord(data: {
  customerId: number;
  date: string;
  minutesUsed: number;
  cost: number;
  revenue: number;
  margin: number;
  callCount: number;
}) {
  // Try to find existing record for this customer and date
  const existingUsage = await db
    .select()
    .from(usage)
    .where(and(
      eq(usage.customerId, data.customerId),
      eq(usage.date, data.date)
    ))
    .limit(1);

  if (existingUsage.length > 0) {
    // Update existing record by adding new values
    const existing = existingUsage[0];
    const newMinutesUsed = parseFloat(existing.minutesUsed) + data.minutesUsed;
    const newCost = parseFloat(existing.cost) + data.cost;
    const newRevenue = parseFloat(existing.revenue) + data.revenue;
    const newMargin = parseFloat(existing.margin) + data.margin;
    const newCallCount = existing.callCount + data.callCount;

    await db
      .update(usage)
      .set({
        minutesUsed: newMinutesUsed.toString(),
        cost: newCost.toString(),
        revenue: newRevenue.toString(),
        margin: newMargin.toString(),
        callCount: newCallCount,
      })
      .where(eq(usage.id, existing.id));

    return { updated: true, record: existing };
  } else {
    // Create new record
    const newRecord = await db
      .insert(usage)
      .values({
        customerId: data.customerId,
        date: data.date,
        minutesUsed: data.minutesUsed.toString(),
        cost: data.cost.toString(),
        revenue: data.revenue.toString(),
        margin: data.margin.toString(),
        callCount: data.callCount,
      })
      .returning();

    return { updated: false, record: newRecord[0] };
  }
}

export async function updateCallLogWithTranscript(callSid: string, transcript: string, elevenlabsCost: number) {
  // Update call log
  await db
    .update(callLogs)
    .set({
      transcript: transcript,
      elevenlabsCost: elevenlabsCost.toString(),
    })
    .where(eq(callLogs.callSid, callSid));

  // Find the call log to get customer info
  const callLog = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.callSid, callSid))
    .limit(1);

  if (callLog.length > 0) {
    const today = new Date().toISOString().split('T')[0];

    // Find today's usage record for this customer
    const todayUsage = await db
      .select()
      .from(usage)
      .where(and(
        eq(usage.customerId, callLog[0].customerId),
        eq(usage.date, today)
      ))
      .limit(1);

    if (todayUsage.length > 0) {
      // Add ElevenLabs cost to existing usage record
      const existing = todayUsage[0];
      const newCost = parseFloat(existing.cost) + elevenlabsCost;
      const newMargin = parseFloat(existing.margin) - elevenlabsCost; // Subtract cost from margin

      await db
        .update(usage)
        .set({
          cost: newCost.toString(),
          margin: newMargin.toString(),
        })
        .where(eq(usage.id, existing.id));
    }
  }

  return callLog[0];
}
