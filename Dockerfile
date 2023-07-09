FROM node:14-alpine3.16 AS builder
ARG ENV
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY web/package.json ./
RUN npm install
COPY web ./
COPY secret/web.env.${ENV} .env.local
RUN npm run build

FROM node:14-alpine3.16 AS runner
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]