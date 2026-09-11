# WhatsApp Portal — Architecture

Multi-tenant WhatsApp Customer Support / CRM portal with AI auto-responder, designed to grow
into a workflow-automation hub (E) and a reseller / WhatsApp-as-a-Service panel (G).

## Stack (current)

- React 19 + TypeScript + Vite + Tailwind + shadcn/ui (`app/`)
- State: React context store (`src/lib/store.tsx`) over a gateway adapter
- Runs today in **demo mode** (MockAdapter with realistic seed + live inbound simulation)

## Key design decision: the gateway adapter seam

```
UI pages ──► store.tsx ──► WhatsAppGateway interface (src/lib/gateway/types.ts)
                              ├── mock.ts        → demo data + simulated live events
                              ├── openwa.ts      → OpenWA REST (X-API-Key, /api/…)
                              └── evolution.ts   → Evolution REST (apikey, /instance/…)
```

The UI never talks to a WhatsApp backend directly. Switching or combining backends
(including Meta Cloud API later) only touches `src/lib/gateway/`.

## Domain model (multi-tenant)

`Tenant → WaSession (WhatsApp number + engine) → Contact → Conversation → Message`

Plus per-tenant: `TeamMember` (owner/admin/agent/viewer roles), `BotRule` + `BotConfig`
(AI auto-responder), `AutomationRule` (trigger→condition→action), `GatewayProfile`.

## Roadmap to options E & G

**G — Reseller / SaaS panel**
- Tenant switcher, plans, roles are already modeled. Next: real backend (NestJS/Fastify) with
  Postgres, per-tenant API keys mapped to gateway key scopes (OpenWA supports session-scoped
  operator/viewer keys natively), billing, and white-label domains.

**E — Workflow automation hub**
- `AutomationRule` + the gateway webhook event bus (`message.received`, `session.status`, …)
  are the trigger layer. Next: terminate webhooks in the backend, add a rule engine, and
  ship n8n/Make-style action nodes (webhook, tag, assign, send, AI classify).

**AI auto-responder runtime**
- Rules + persona live in the UI now. Next: backend bot worker that consumes inbound events,
  applies keyword rules first, then falls back to an LLM (via OpenWA's MCP server, Dify, or
  OpenAI/Chatwoot integrations on Evolution), with human-handoff escalation.

## Recommended production backends

- Primary: **OpenWA** (MIT, multi-session, scoped API keys, dashboard, MCP server)
- Compliance channel: **Meta Cloud API** (via Evolution-style instance or direct) for
  regulated/critical messaging

## Develop

```bash
cd app
npm run dev
```
