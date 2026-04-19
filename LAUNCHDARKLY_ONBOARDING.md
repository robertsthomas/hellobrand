# LaunchDarkly Onboarding Log

## Checklist

| Step | Status | Notes |
|------|--------|-------|
| 0 -- Onboarding log | done | Created |
| 1 -- Explore project | done | Next.js 16, React 19, TypeScript, pnpm, Fly.io |
| 2 -- Detect agent | done | Claude Code (opencode) |
| 3 -- Companion skills | not started | |
| 4 -- MCP | not started | |
| 5 -- SDK install | not started | |
| 6 -- First flag | not started | Create all 15 flags migrated from Vercel |
| Follow-through | not started | |

## Context

- **Agent:** opencode (Claude Code compatible)
- **Language:** TypeScript
- **Framework:** Next.js 16 (App Router) + React 19
- **Package manager:** pnpm
- **Platform:** Fly.io (migrated from Vercel)
- **Auth:** Clerk
- **DB:** Supabase (Postgres) + Prisma
- **Background jobs:** Inngest
- **Email:** Resend
- **Payments:** Stripe
- **Monitoring:** Sentry
- **Existing LD usage:** None
- **LD project key:** TBD
- **LD environments:** TBD

## Flags to migrate (from Vercel -> LD)

| Flag Key | Default (Prod) | Type |
|----------|---------------|------|
| yahoo-provider-enabled | false | boolean |
| yahoo-oauth-enabled | true | boolean |
| yahoo-app-password-enabled | true | boolean |
| gmail-provider-enabled | true | boolean |
| outlook-provider-enabled | true | boolean |
| invoice-editor-enabled | true | boolean |
| ai-risk-analysis-enabled | true | boolean |
| ai-conflict-intelligence | false | boolean |
| batch-intake-enabled | false | boolean |
| intake-clustering-enabled | false | boolean |
| smart-inbox-enabled | false | boolean |
| invoice-reminders-enabled | false | boolean |
| sidebar-milestones-enabled | true | boolean |
| blog-summarize-enabled | false | boolean |
| maintenance-mode | false | boolean |

## Next step

Step 3: Install companion skills
