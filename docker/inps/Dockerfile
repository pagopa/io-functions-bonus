FROM node:10.14.2-alpine as builder

WORKDIR /usr/src/app/inps

RUN apk add git \
    && git clone https://github.com/pagopa/io-bonus-inps-node-mock /usr/src/app/inps

RUN yarn install && yarn build

CMD ["yarn", "start"]
