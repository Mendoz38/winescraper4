FROM node:22-alpine AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ws_front/package.json ws_front/
COPY ws_scrapper/package.json ws_scrapper/
RUN pnpm install --frozen-lockfile --filter ./ws_front
COPY ws_front ws_front
RUN pnpm --dir ws_front run build --mode prod

FROM nginx:stable-alpine

COPY --from=build /app/ws_front/dist/client /usr/share/nginx/html
COPY ws_front/nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
