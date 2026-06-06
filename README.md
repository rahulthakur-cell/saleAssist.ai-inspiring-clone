# SaleAssist.ai Clone

> **Video Commerce SaaS Platform** — Transform e-commerce with live video shopping, AI chat, shoppable videos, CRM, and real-time customer engagement.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com/)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | NestJS, TypeScript, Prisma ORM |
| **Database** | PostgreSQL 16 (with RLS for multi-tenancy) |
| **Cache & Queue** | Redis 7, BullMQ |
| **Real-time** | Socket.IO, LiveKit OSS |
| **AI** | LiteLLM Proxy (OpenAI, Anthropic, Google) |
| **Storage** | MinIO (S3-compatible) |
| **Search** | Meilisearch |
| **Analytics** | PostHog OSS |
| **Billing** | Stripe, Razorpay |
| **Deployment** | Docker, Coolify |

## Quick Start

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

### 1. Clone & Install

```bash
git clone https://github.com/your-org/saleassist-clone.git
cd saleassist-clone
cp .env.example .env
pnpm install
```

### 2. Start Infrastructure

```bash
pnpm docker:up
```

This starts PostgreSQL, Redis, MinIO, Meilisearch, LiveKit, and LiteLLM.

### 3. Setup Database

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

### 4. Start Development

```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API Server | http://localhost:4000 |
| API Docs | http://localhost:4000/api/docs |
| MinIO Console | http://localhost:9001 |
| Meilisearch | http://localhost:7700 |

### Demo Credentials

| Account | Email | Password |
|---------|-------|----------|
| Admin | admin@saleassist.local | admin123456 |
| Agent | agent@saleassist.local | agent123456 |

## Project Structure

```
saleassists.ai_clone/
├── apps/
│   ├── web/          # Next.js 15 Dashboard
│   ├── api/          # NestJS API Server
│   ├── worker/       # BullMQ Background Workers
│   └── widget/       # Embeddable Widget (Vanilla JS)
├── packages/
│   ├── database/     # Prisma Schema & Client
│   ├── shared/       # Types, Validators, Constants
│   ├── ui/           # shadcn/ui Components
│   └── config-*/     # Shared Configs
└── docker/           # Docker Compose & Service Configs
```

## Features

- ✅ **Multi-tenancy** — Shared schema with Row-Level Security
- ✅ **Auth** — JWT + Refresh tokens, OAuth (Google, GitHub)
- ✅ **RBAC** — Role-based access with custom roles & permissions
- ✅ **Video Calls** — 1:1 and group calls via LiveKit
- ✅ **Live Streaming** — Broadcast to large audiences
- ✅ **Shoppable Videos** — Interactive video with product hotspots
- ✅ **Video FAQ** — Video-based FAQ collections
- ✅ **AI Chat** — LLM-powered chat via LiteLLM
- ✅ **CRM** — Contacts, Companies, Deals pipeline
- ✅ **Lead Management** — Capture, score, assign, convert
- ✅ **Visitor Tracking** — Real-time visitor analytics
- ✅ **Widget** — Embeddable widget for any website
- ✅ **Billing** — Stripe + Razorpay with usage metering
- ✅ **Analytics** — PostHog-powered dashboards

## License

MIT — See [LICENSE](LICENSE) for details.
