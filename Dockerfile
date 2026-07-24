FROM node:24-bookworm-slim AS client-build
WORKDIR /app
COPY client/package*.json ./client/
RUN npm --prefix client ci
COPY client ./client
RUN npm --prefix client run build

FROM node:24-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV SAMPLE_GRAPH_DB=/data/sample-graph-runtime.sqlite

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p /data /app/client/public/artwork /app/client/public/avatars

EXPOSE 3001
CMD ["npm", "run", "server"]
