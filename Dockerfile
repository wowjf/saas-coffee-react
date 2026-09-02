FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/src ./src
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
