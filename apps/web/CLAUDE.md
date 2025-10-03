# CLAUDE.md - AI Receptionist System Architecture
System Overview

This is a multi-tenant AI receptionist system built with Next.js 15, providing automated phone call handling through Twilio and ElevenLabs integrations. The system features analytics, team management, and customer billing.

Claude is not the main developer – Claude acts as a dispatcher and coordinates specialized agents.
Claude should never directly run SQL, API calls, or big code changes.

Core Technologies

Framework: Next.js 15 with App Router

Database: PostgreSQL with Drizzle ORM (via Supabase)

Storage: Supabase Storage for audio files

Authentication: Custom JWT-based authentication

External APIs: Twilio (telephony), ElevenLabs (AI voice)

Charts: Recharts

UI: shadcn/ui with Tailwind CSS

Multi-Tenant Architecture
Database Schema

Hierarchical structure with team isolation:

teams (workspace level)
├── teamMembers (user associations)
├── customers (AI receptionist clients)
│   ├── callLogs (call records)
│   ├── usage (daily metrics)
│   └── integrations (POS/booking systems)
└── activityLogs (audit trail)

Integration Architecture
Twilio

Webhook: /api/twilio/call-status

Logs calls and Twilio costs

Updates usage with minutes and costs

Triggered automatically per customer

ElevenLabs

Webhook: /api/elevenlabs/transcript

Receives transcript + AI cost

Updates callLogs

Uploads audio to Supabase Storage

Adjusts usage margins

Dashboard System

Overview Page: metrics, charts, recent calls

Customer Detail Page: per-customer usage, integrations, call history

Activity Logs: recent team activity

Charts: volume, costs vs revenue, hourly patterns, outcomes

Specialized Agent Usage Guidelines

Claude must always call the right agent instead of doing things directly.

db-agent – Database Operations

When to use: Any database task

Fetch customers, usage, callLogs

Create or update records

Schema migrations
❌ Claude never writes SQL himself.

integration-agent – External Service Management

When to use: Any external API integration

Configure Twilio webhooks

Configure ElevenLabs webhooks

Update integration status in DB
❌ Claude never calls APIs directly.

research-agent – External Information

When to use: Need external knowledge

API docs, pricing, competitors

SaaS patterns and best practices
❌ Claude never guesses – always delegate research.

debug-agent – Troubleshooting & Quality

When to use: Before release, or if something looks wrong

Find inconsistencies

Detect unused code/dummy data

Suggest refactors
❌ Claude never directly fixes code – only suggestions.

feature-agent – New Feature Development

When to use: Adding new UI or system features

New dashboard cards, menus, settings

New customer functionality
❌ Claude never builds features alone.

Development Workflow

Local dev with npm run dev

Migrations with npm run db:migrate

Webhook testing with ngrok http 3000

Always test new features with agents before release

Environment Variables
POSTGRES_URL=postgresql://...
BASE_URL=http://localhost:3000
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
ELEVENLABS_API_KEY=...
NEXT_PUBLIC_APP_URL=https://your-domain.com

Security

Team-based data isolation

No secrets stored in DB

Webhook signature verification

JWT auth for all restricted routes

Agent Rules (Summary)

DB tasks → db-agent

Integrations → integration-agent

Research → research-agent

Debugging → debug-agent

Features → feature-agent

Claude’s mission: Coordinate, not control.
