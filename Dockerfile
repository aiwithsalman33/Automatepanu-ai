# syntax=docker/dockerfile:1

# ---------------------------------------------------------------
# Stage 1 — install dependencies (cached until package*.json change)
# ---------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------
# Stage 2 — build
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build
# time, so they must be provided as build args (docker-compose.yml
# forwards them from .env.local). Server-only secrets (service role
# key, ENCRYPTION_KEY, META_APP_SECRET, ...) are read at runtime and
# must NOT be baked into the image.
# ---------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_LOCALE=en
# Two-domain routing + Sign in/Start free links (src/proxy.ts and the
# marketing site read these; NEXT_PUBLIC_* are inlined at build time,
# server code included).
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MARKETING_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_APP_LOCALE=$NEXT_PUBLIC_APP_LOCALE \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL \
    NEXT_TELEMETRY_DISABLED=1

# Fail fast with a clear message instead of a cryptic prerender error
# ("Invalid supabaseUrl") minutes into the build.
RUN node -e 'const u=process.env.NEXT_PUBLIC_SUPABASE_URL||"",k=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";const bad=[];if(!/^https?:\/\/[^\s<>]+$/.test(u)||/FILL/.test(u))bad.push("NEXT_PUBLIC_SUPABASE_URL");if(!k||/FILL/.test(k))bad.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");if(bad.length){console.error("\n  x Build stopped: "+bad.join(" and ")+" missing or still a >>> FILL <<< placeholder.\n    Set real values in Dokploy -> Environment (or .env.local), then redeploy.\n");process.exit(1)}'

RUN npm run build

# ---------------------------------------------------------------
# Stage 3 — one-shot database migrator (compose service `migrate`)
#
# Runs db/migrate.mjs: a superuser bootstrap (roles, schemas,
# extensions) when DATABASE_ADMIN_URL is set, then node-pg-migrate as
# wacrm_owner. Build it with `--target migrate`. It must stay *before*
# the runner stage: the last stage is the default build target.
# ---------------------------------------------------------------
FROM node:22-alpine AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY db ./db
USER node
CMD ["node", "db/migrate.mjs", "up"]

# ---------------------------------------------------------------
# Stage 4 — minimal runtime (standalone output)
# ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
