FROM node:20-slim

WORKDIR /app

# Copy API files
COPY api/package*.json ./api/
RUN cd api && npm install --production

COPY api/ ./api/
COPY vault/ ./vault/

# Build TypeScript
RUN cd api && npx tsc || true

ENV VAULT_PATH=/app/vault
ENV PORT=3456

EXPOSE 3456

CMD ["node", "--experimental-specifier-resolution=node", "api/dist/index.js"]
