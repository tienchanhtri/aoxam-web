FROM node:14-alpine3.16
COPY ./public ./public
COPY ./.next/standalone ./
COPY ./.next/static ./.next/static
ENV PORT 3000