FROM node:24.12.0-bookworm-slim@sha256:7326fb2dbdce998edd72140946851be64ef4a643e8715e138ca467e8e9d92c99

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /runner

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN npx playwright install-deps chromium \
    && rm -rf /var/lib/apt/lists/*
RUN npx playwright install chromium

COPY journey.mjs ./

RUN groupadd --system runner \
    && useradd --system --gid runner --create-home runner \
    && chown -R runner:runner /runner /ms-playwright

USER runner
