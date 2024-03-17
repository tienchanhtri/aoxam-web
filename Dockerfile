FROM node:20.11.1-alpine3.18 AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY web/package.json ./
ARG PROXY
RUN npm config set proxy ${PROXY} && npm config set https-proxy ${PROXY}
RUN npm install
COPY web ./
ARG ENV
COPY secret/web.env.${ENV} .env.local
RUN npm run build

FROM node:20.11.1-alpine3.18 AS runner
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]