# === Development stage ===
FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Non-root user
RUN addgroup -S app && adduser -S app -G app && \
    chown -R app:app /app
USER app

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]


# === Production build stage ===
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


# === Production serve stage ===
FROM nginx:1.25-alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html

# Non-root user
RUN addgroup -S app && adduser -S app -G app && \
    chown -R app:app /usr/share/nginx/html

EXPOSE 80
