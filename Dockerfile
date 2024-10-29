FROM node:20-alpine AS build

WORKDIR /code
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app
RUN apk add --no-cache --virtual build-dependencies git
COPY package.json .
RUN npm install --omit=dev
RUN apk del build-dependencies
COPY --from=build /code/dist/ .

CMD ["node", "/app/index.js"]
