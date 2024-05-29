FROM node:20.11.1-alpine3.18 AS runner
WORKDIR /app
COPY ./public ./public
COPY ./.next/standalone ./
COPY ./.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]