# syntax=docker/dockerfile:1
#
# Automate Panu AI — multi-stage build.
#   deps     npm ci (cached until package*.json change)
#   builder  next build (standalone). Only NEXT_PUBLIC_* are build args.
#   migrate  one-shot DB migrator (compose service `migrate`)
#   runner   minimal non-root runtime (default target)
# No secret is ever baked into an image: they are read at runtime.

ARG NODE_IMAGE=node:22.23.5-alpine3.24

# ---------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_LOCALE=en
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MARKETING_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_APP_LOCALE=$NEXT_PUBLIC_APP_LOCALE \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL \
    NEXT_TELEMETRY_DISABLED=1

# Fail fast (seconds, not minutes into `next build`) on a malformed or
# placeholder public URL. They're optional (brand defaults apply), but
# when set they are inlined into every page, so a typo would ship.
RUN node -e 'const bad=[];for(const k of ["NEXT_PUBLIC_APP_URL","NEXT_PUBLIC_MARKETING_URL","NEXT_PUBLIC_SITE_URL"]){const v=process.env[k]||"";if(v&&(!/^https?:\/\/[^\s<>\/]+(\/[^\s<>]*)?$/.test(v)||/FILL|change-me/i.test(v)))bad.push(k)}if(bad.length){console.error("\n  x Build stopped: "+bad.join(", ")+" is not a valid URL (or still a placeholder).\n    Fix it in Dokploy -> Environment (or .env), then redeploy.\n");process.exit(1)}'

RUN npm run build

# ---------------------------------------------------------------
# Must stay before `runner`: the last stage is the default target.
FROM ${NODE_IMAGE} AS migrate
WORKDIR /app
ENV NODE_ENV=production
# The migrator needs only pg + node-pg-migrate: install exactly the
# versions pinned in package-lock.json, not the whole app (~60 MB vs 1.2 GB).
COPY package-lock.json /tmp/package-lock.json
RUN DEPS="$(node -e "const l=require('/tmp/package-lock.json').packages;process.stdout.write(['pg','node-pg-migrate'].map(n=>n+'@'+l['node_modules/'+n].version).join(' '))")" \
 && echo '{"name":"migrate","private":true,"type":"module"}' > package.json \
 && npm install --omit=dev --ignore-scripts --no-audit --no-fund $DEPS \
 && npm cache clean --force && rm /tmp/package-lock.json
COPY db ./db
USER node
CMD ["node", "db/migrate.mjs", "up"]

# ---------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --chown=nextjs:nextjs scripts/check-env.mjs ./scripts/check-env.mjs

USER nextjs
EXPOSE 3000
# check-env refuses to start (with the list of what's missing) when a
# required variable is absent or still a placeholder; then the server.
CMD ["sh", "-c", "node scripts/check-env.mjs && exec node server.js"]
