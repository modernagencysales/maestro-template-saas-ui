# Deployment Preparation Guide

This guide covers the steps needed to prepare your application for production deployment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Build Configuration](#build-configuration)
- [Security Considerations](#security-considerations)
- [Third-Party Services](#third-party-services)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Platform-Specific Guides](#platform-specific-guides)

## Prerequisites

Before deploying, ensure you have:

1. **Node.js** >= 20.14.0
2. **pnpm** 9.15.0
3. **PostgreSQL** database (production instance)
4. **Stripe** account (for billing)
5. **Resend** account (for email)
6. **Git** repository connected to deployment platform

## Environment Configuration

### Required Environment Variables

Create a production environment file based on [.env.example](../.env.example):

```bash
# Application URLs
APP_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com

# Billing Configuration
DEFAULT_PLAN_ID=free@1
DEFAULT_IS_FREE=true

# Email Configuration
EMAIL_FROM="hello@your-domain.com"

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Authentication
AUTH_SECRET=<generate-secure-random-string>

# Email Provider (Resend)
RESEND_API_KEY=<your-resend-api-key>

# Stripe Payment Provider
VITE_STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
```

### Generating Secrets

**AUTH_SECRET**: Generate a secure random string (32+ characters):

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Environment Validation

The application validates environment variables on startup using [packages/env/env.ts](../packages/env/env.ts).

Missing or invalid environment variables will cause the application to fail startup with clear error messages.

## Database Setup

### 1. Create Production Database

Create a PostgreSQL database on your hosting platform:

**Options**:

- **Managed Services**: Supabase, Neon, Railway, Render, AWS RDS, Digital Ocean
- **Self-Hosted**: PostgreSQL in Docker or VPS

**Requirements**:

- PostgreSQL 14+
- SSL/TLS connection support
- Sufficient storage for your data needs
- Regular backups configured

### 2. Database Connection String

Format: `postgresql://username:password@host:port/database?sslmode=require`

**Example**:

```
postgresql://myuser:mypassword@db.example.com:5432/production?sslmode=require
```

Add `?sslmode=require` for secure connections (required by most managed services).

### 3. Run Migrations

After deploying your application code, run database migrations:

```bash
# From project root
pnpm db:migrate
```

Or manually from the db package:

```bash
cd packages/db
pnpm db:migrate
```

**Important**: Use `db:migrate` (not `db:push`) for production deployments. Migrations ensure proper version tracking and rollback capability.

### 4. Seed Data (Optional)

For initial setup, you may want to seed your database:

```bash
pnpm --filter @workspace/db db:seed \
  --email admin@your-domain.com \
  --password <secure-password>
```

This creates:

- 1 admin user with specified credentials
- 1 default workspace
- Sample contacts (can be deleted later)
- Billing plans from configuration

### 5. Billing Plans Sync

Sync your Stripe pricing plans to the database:

```bash
pnpm billing:sync
```

This reads plans from [packages/billing-stripe/src/plans.ts](../packages/billing-stripe/src/plans.ts) and creates/updates them in the database.

## Build Configuration

### Build Output

The application builds to `.output/` directory using TanStack Start:

```bash
pnpm build:web
```

**Build artifacts**:

- `.output/server/` - Server-side code
- `.output/client/` - Client-side static assets
- `.output/public/` - Public static files

### Production Start Command

After building, start the production server:

```bash
node .output/server/index.mjs
```

**Port**: The application listens on `PORT` environment variable (default: 3000).

### Build Optimization

The application is configured with:

- **TanStack Start** with SPA mode enabled
- **Vite** for optimized bundling
- **Tree-shaking** enabled
- **Code splitting** for lazy-loaded routes
- **Asset optimization** (minification, compression)

### Vercel Deployment

The application has built-in Vercel support in [apps/web/src/features/common/util/get-base-url.ts](../apps/web/src/features/common/util/get-base-url.ts):

```typescript
if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
```

No additional configuration needed for Vercel deployments.

## Security Considerations

### 1. Environment Variables

- **Never commit** `.env` files to version control
- Use platform-specific secret management
- Rotate secrets regularly
- Use different secrets for staging/production

### 2. Database Security

- Enable SSL/TLS for database connections
- Use strong passwords
- Restrict database access to application servers only
- Enable connection pooling for better performance
- Set up regular automated backups

### 3. Authentication

- `AUTH_SECRET` must be strong and unique
- Enable session expiration
- Consider enabling 2FA (requires custom implementation)

### 4. CORS & Security Headers

**Currently not configured** - consider adding:

```typescript
// In your server configuration
app.use(helmet()) // Security headers
app.use(
  cors({
    origin: process.env.APP_URL,
    credentials: true,
  }),
)
```

### 5. Rate Limiting

**Currently not configured** - consider adding rate limiting for:

- Login endpoints
- API endpoints
- Password reset endpoints

### 6. Monitoring & Logging

**Recommended**: Integrate error monitoring:

- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Datadog** - APM and logging
- **New Relic** - Performance monitoring

### 7. Health Checks

**Currently not implemented** - consider adding a health check endpoint:

```typescript
// apps/web/src/routes/api/health.tsx
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        // Check database connection
        // Check external services
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
```

## Third-Party Services

### Stripe Setup

1. **Create Stripe Account**: https://stripe.com
2. **Get API Keys**: Dashboard → Developers → API keys
3. **Configure Plans**: Update [packages/billing-stripe/src/plans.ts](../packages/billing-stripe/src/plans.ts)
4. **Create Products in Stripe**: Match plan IDs in your configuration
5. **Set Up Webhooks**:
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
6. **Copy Webhook Secret**: Add to `STRIPE_WEBHOOK_SECRET`

### Resend Email Setup

1. **Create Resend Account**: https://resend.com
2. **Verify Domain**: Add DNS records for your sending domain
3. **Get API Key**: Dashboard → API Keys
4. **Add to Environment**: `RESEND_API_KEY`
5. **Configure FROM Address**: `EMAIL_FROM=noreply@your-domain.com`

**Email Templates**: Located in [packages/email/templates/](../packages/email/templates/)

### Optional: Supabase Authentication

The application supports Supabase as an alternative auth provider:

1. Uncomment Supabase env vars in `.env`
2. Configure [packages/auth-supabase/](../packages/auth-supabase/)
3. Update auth configuration in application

## Pre-Deployment Checklist

### Code Quality

- [ ] All linting errors fixed: `pnpm lint`
- [ ] All formatting applied: `pnpm format:write`
- [ ] Code reviewed and approved
- [ ] No `console.log` statements in production code (or acceptable)
- [ ] No hardcoded credentials or secrets

### Testing

- [ ] Manual testing completed
- [ ] Critical user flows tested
- [ ] Authentication flows tested
- [ ] Payment flows tested (Stripe test mode)
- [ ] Email sending tested

**Note**: The project currently has no automated tests configured. Consider adding tests before production deployment.

### Environment

- [ ] Production environment variables configured
- [ ] `AUTH_SECRET` generated and added
- [ ] Database connection string added
- [ ] Stripe keys (production mode) added
- [ ] Resend API key added
- [ ] `APP_URL` and `VITE_API_URL` set to production domain

### Database

- [ ] Production database created
- [ ] Database backups enabled
- [ ] SSL connection enabled
- [ ] Migrations ready to run: `pnpm db:migrate`
- [ ] Billing plans configured

### Third-Party Services

- [ ] Stripe account set up (production mode)
- [ ] Stripe products/prices created
- [ ] Stripe webhook configured with production URL
- [ ] Resend domain verified
- [ ] Resend API key (production) obtained
- [ ] Email templates tested

### Build & Deployment

- [ ] Production build successful: `pnpm build:web`
- [ ] Build output size acceptable
- [ ] Start command tested: `node .output/server/index.mjs`
- [ ] Application starts without errors
- [ ] Environment validation passes
- [ ] Port configuration correct (default 3000)

### Post-Deployment

- [ ] Application accessible at production URL
- [ ] Database migrations run successfully
- [ ] Billing plans synced: `pnpm billing:sync`
- [ ] Admin user created (via seed or manual)
- [ ] Login flow works
- [ ] Workspace creation works
- [ ] Stripe checkout works
- [ ] Webhooks receiving events (test with small transaction)
- [ ] Emails sending correctly
- [ ] Error monitoring active (if configured)

## Platform-Specific Guides

### Vercel

**Recommended for**: Fastest deployment with zero configuration

1. **Connect Repository**: Import from GitHub/GitLab/Bitbucket
2. **Framework Preset**: Vercel auto-detects TanStack Start
3. **Environment Variables**: Add all production env vars in project settings
4. **Database**: Use Vercel Postgres or external service (Supabase/Neon)
5. **Deploy**: Push to main branch

**Build Settings** (auto-configured):

- Build Command: `pnpm build:web`
- Output Directory: `.output`
- Install Command: `pnpm install`

**Domain**: Configure custom domain in Vercel project settings

### Railway

**Recommended for**: Full-stack apps with database included

1. **Create New Project**: From GitHub repository
2. **Add PostgreSQL**: Railway Postgres add-on
3. **Environment Variables**: Add in Railway dashboard
4. **Deploy Settings**:
   - Root Directory: `/`
   - Build Command: `pnpm build:web`
   - Start Command: `node apps/web/.output/server/index.mjs`
   - Watch Paths: `apps/web/**`
5. **Database**: Connection string auto-configured via `DATABASE_URL`
6. **Run Migrations**: In Railway terminal or deployment script

### Render

**Recommended for**: Simple deployment with database

1. **Create Web Service**: From GitHub repository
2. **Settings**:
   - Environment: Node
   - Build Command: `pnpm install && pnpm build:web`
   - Start Command: `node apps/web/.output/server/index.mjs`
   - Instance Type: Choose based on needs
3. **Add PostgreSQL**: Create database in Render
4. **Environment Variables**: Add in Render dashboard
5. **Deploy**: Automatic on git push

### Docker Deployment

See [docker-deployment.md](./docker-deployment.md) for containerized deployment guide.

## Troubleshooting

### Build Fails

**Check**:

- All dependencies installed: `pnpm install`
- No TypeScript errors: `pnpm lint`
- Environment variables not needed at build time

### Application Won't Start

**Check**:

- All required environment variables set
- Database connection string correct
- Port not already in use
- Node version >= 20.14.0

### Database Connection Fails

**Check**:

- Database is running and accessible
- Connection string format correct
- SSL mode configured if required
- Firewall/security group allows connection
- Database user has sufficient permissions

### Stripe Webhooks Not Working

**Check**:

- Webhook URL is publicly accessible
- Webhook secret matches Stripe dashboard
- Webhook events are configured correctly
- Check webhook delivery logs in Stripe dashboard
- Verify application logs for webhook errors

### Emails Not Sending

**Check**:

- Resend API key is correct
- Domain is verified in Resend
- `EMAIL_FROM` address uses verified domain
- Check Resend logs for delivery status
- Verify email templates are properly compiled

## Next Steps

After successful deployment:

1. **Monitor Application**: Set up error tracking and monitoring
2. **Set Up Alerts**: Configure alerts for errors, downtime, performance
3. **Enable Backups**: Ensure database backups are running
4. **Test Critical Flows**: Login, signup, payments, emails
5. **Update Documentation**: Document your deployment process
6. **Set Up CI/CD**: Automate testing and deployment
7. **Security Audit**: Review security best practices
8. **Performance Testing**: Load test critical endpoints
9. **SEO**: Configure meta tags, sitemap, robots.txt
10. **Analytics**: Add analytics tracking (Google Analytics, Plausible, etc.)

## Getting Help

- **TanStack Start Docs**: https://tanstack.com/start
- **tRPC Docs**: https://trpc.io
- **Drizzle ORM Docs**: https://orm.drizzle.team
- **Stripe Docs**: https://stripe.com/docs
- **Resend Docs**: https://resend.com/docs
