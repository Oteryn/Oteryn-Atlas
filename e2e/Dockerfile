FROM mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07

WORKDIR /workspace/e2e

COPY e2e/package.json e2e/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY e2e/playwright.config.mjs ./playwright.config.mjs
COPY e2e/tests ./tests

ENV CI=1
CMD ["npm", "test"]
