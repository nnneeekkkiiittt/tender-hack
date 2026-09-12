FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --registry=https://registry.npmjs.org
COPY . .

# Vite bakes VITE_* variables into the bundle at BUILD time (there is no
# runtime env substitution for a static nginx-served build) — so these must
# be build ARGs, not container environment variables. Compare with
# docker-compose.yml, which passes them under build.args accordingly.
ARG VITE_APP_MODE=api
ARG VITE_API_URL=/api
ARG VITE_ANALYTICS_API_URL=http://localhost:8080
ARG VITE_METABASE_URL=http://localhost:3000
ENV VITE_APP_MODE=$VITE_APP_MODE \
    VITE_API_URL=$VITE_API_URL \
    VITE_ANALYTICS_API_URL=$VITE_ANALYTICS_API_URL \
    VITE_METABASE_URL=$VITE_METABASE_URL
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
