FROM node:14-alpine as build

WORKDIR /code
COPY . .
RUN npm ci && npm run build

FROM node:14-alpine

ENV NODE_ENV=production

WORKDIR /app
RUN apk add --no-cache --virtual build-dependencies git
COPY package.json .
RUN npm install --only=production
RUN apk del build-dependencies
COPY --from=build /code/dist/ .

CMD ["node", "/app/index.js"]
