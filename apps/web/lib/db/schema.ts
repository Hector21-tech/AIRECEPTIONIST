import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

// AI Receptionist Tables
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  contactName: varchar('contact_name', { length: 100 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  twilioNumber: varchar('twilio_number', { length: 20 }),
  agentId: varchar('agent_id', { length: 50 }),
  elevenlabsApiKey: varchar('elevenlabs_api_key', { length: 200 }), // Per-customer API key
  planType: varchar('plan_type', { length: 50 }).notNull().default('Standard'),
  teamId: integer('team_id')
    .references(() => teams.id),
  webhookTwilioStatus: varchar('webhook_twilio_status', { length: 20 }).default('inactive'),
  webhookElevenlabsStatus: varchar('webhook_elevenlabs_status', { length: 20 }).default('inactive'),
  webhookTwilioUrl: text('webhook_twilio_url'),
  webhookElevenlabsUrl: text('webhook_elevenlabs_url'),
  // Restaurant Scraper Integration
  websiteUrl: text('website_url'),
  restaurantSlug: varchar('restaurant_slug', { length: 100 }),
  knowledgeBaseId: varchar('knowledge_base_id', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const usage = pgTable('usage', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  date: date('date').notNull(),
  minutesUsed: decimal('minutes_used', { precision: 10, scale: 2 }).notNull().default('0'),
  cost: decimal('cost', { precision: 10, scale: 4 }).notNull().default('0'), // Total cost (Twilio + ElevenLabs)
  revenue: decimal('revenue', { precision: 10, scale: 2 }).notNull().default('0'),
  margin: decimal('margin', { precision: 10, scale: 2 }).notNull().default('0'),
  callCount: integer('call_count').notNull().default(0), // Number of calls this day
});

export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  type: varchar('type', { length: 50 }).notNull(), // 'booking' or 'pos'
  method: varchar('method', { length: 50 }).notNull(), // 'API', 'Puppeteer', 'SMS'
  status: varchar('status', { length: 50 }).notNull().default('active'),
  config: text('config'), // JSON config for integration
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const callLogs = pgTable('call_logs', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  datetime: timestamp('datetime').notNull().defaultNow(),
  transcript: text('transcript'),
  outcome: varchar('outcome', { length: 50 }).notNull(), // 'completed', 'failed', 'no-answer', etc.
  duration: varchar('duration', { length: 20 }), // duration in seconds (as string)
  cost: decimal('cost', { precision: 10, scale: 4 }), // Twilio cost in original currency
  callSid: varchar('call_sid', { length: 100 }), // Twilio CallSid
  fromNumber: varchar('from_number', { length: 20 }), // Caller's number
  toNumber: varchar('to_number', { length: 20 }), // Twilio number (customer's)
  elevenlabsCost: decimal('elevenlabs_cost', { precision: 10, scale: 4 }), // ElevenLabs cost
  audioData: text('audio_data'), // Base64 encoded audio from ElevenLabs (deprecated)
  audioFileName: varchar('audio_file_name', { length: 255 }), // Supabase Storage filename
});

export const automations = pgTable('automations', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // 'draft', 'active', 'paused'
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // 'call_completed', 'call_missed', 'scheduled', 'call_keyword'
  triggerConfig: text('trigger_config'), // JSON config for trigger
  actions: text('actions'), // JSON array of actions
  runs: integer('runs').notNull().default(0), // Total number of executions
  lastRun: timestamp('last_run'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations for AI Receptionist tables
export const customersRelations = relations(customers, ({ one, many }) => ({
  team: one(teams, {
    fields: [customers.teamId],
    references: [teams.id],
  }),
  usage: many(usage),
  integrations: many(integrations),
  callLogs: many(callLogs),
  automations: many(automations),
}));

export const usageRelations = relations(usage, ({ one }) => ({
  customer: one(customers, {
    fields: [usage.customerId],
    references: [customers.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  customer: one(customers, {
    fields: [integrations.customerId],
    references: [customers.id],
  }),
}));

export const callLogsRelations = relations(callLogs, ({ one }) => ({
  customer: one(customers, {
    fields: [callLogs.customerId],
    references: [customers.id],
  }),
}));

export const automationsRelations = relations(automations, ({ one }) => ({
  customer: one(customers, {
    fields: [automations.customerId],
    references: [customers.id],
  }),
}));

// Types for AI Receptionist tables
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Usage = typeof usage.$inferSelect;
export type NewUsage = typeof usage.$inferInsert;
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type CallLog = typeof callLogs.$inferSelect;
export type NewCallLog = typeof callLogs.$inferInsert;
export type Automation = typeof automations.$inferSelect;
export type NewAutomation = typeof automations.$inferInsert;

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}
