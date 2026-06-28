# syntax=docker/dockerfile:1

# ---- Dependencies ----------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
# Build toolchain for transitive native modules (e.g. `usb` from the kit's
# Trezor transport). These are node-only and never reach the browser bundle,
# but `npm ci` still compiles them during install.
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev libusb-dev
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ---------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined at build time. They are optional: when unset,
# the app falls back to the live testnet contract defaults baked into
# src/lib/config.ts, so the image runs out of the box.
ARG NEXT_PUBLIC_SOROBAN_RPC_URL
ARG NEXT_PUBLIC_NETWORK_PASSPHRASE
ARG NEXT_PUBLIC_CONTRACT_ID
ARG NEXT_PUBLIC_TOKEN_SAC
ARG NEXT_PUBLIC_TOKEN_SYMBOL
ARG NEXT_PUBLIC_TOKEN_DECIMALS
ARG NEXT_PUBLIC_EXPLORER_BASE
ENV NEXT_PUBLIC_SOROBAN_RPC_URL=${NEXT_PUBLIC_SOROBAN_RPC_URL} \
    NEXT_PUBLIC_NETWORK_PASSPHRASE=${NEXT_PUBLIC_NETWORK_PASSPHRASE} \
    NEXT_PUBLIC_CONTRACT_ID=${NEXT_PUBLIC_CONTRACT_ID} \
    NEXT_PUBLIC_TOKEN_SAC=${NEXT_PUBLIC_TOKEN_SAC} \
    NEXT_PUBLIC_TOKEN_SYMBOL=${NEXT_PUBLIC_TOKEN_SYMBOL} \
    NEXT_PUBLIC_TOKEN_DECIMALS=${NEXT_PUBLIC_TOKEN_DECIMALS} \
    NEXT_PUBLIC_EXPLORER_BASE=${NEXT_PUBLIC_EXPLORER_BASE} \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runner ----------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy only what the standalone server needs.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Lightweight healthcheck against the home page.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
