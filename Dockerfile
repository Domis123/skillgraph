FROM node:20-slim

WORKDIR /app

COPY api/package*.json ./api/
RUN cd api && npm install

COPY api/ ./api/
COPY vault/ ./vault/

ENV VAULT_PATH=/app/vault
ENV PORT=3002

EXPOSE 3002

CMD ["npx", "--prefix", "api", "tsx", "api/src/index.ts"]