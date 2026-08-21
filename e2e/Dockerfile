FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /workspace/e2e

COPY e2e/package.json ./package.json
RUN npm install --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY e2e/playwright.config.mjs ./playwright.config.mjs
COPY e2e/tests ./tests

ENV CI=1
CMD ["npm", "test"]
