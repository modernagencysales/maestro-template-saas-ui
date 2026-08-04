FROM node:22.12.0-bookworm@sha256:0e910f435308c36ea60b4cfd7b80208044d77a074d16b768a81901ce938a62dc
RUN apt-get update && apt-get install -y --no-install-recommends bubblewrap ca-certificates socat \
  && npm install --global --ignore-scripts pnpm@10.12.1 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /controller/bin /controller/proxy /controller/runtime/bin /controller/runtime/pnpm /controller/runtime/lib /controller/runtime/lib64 /controller/runtime/usr/lib \
  && cp /usr/local/bin/node /controller/runtime/bin/node \
  && cp /usr/bin/socat /controller/runtime/bin/socat \
  && cp -a /usr/local/lib/node_modules/pnpm/. /controller/runtime/pnpm/ \
  && ldd /usr/local/bin/node /usr/bin/socat | awk '{ for (i=1;i<=NF;i++) if ($i ~ /^\// && $i !~ /:$/) print $i }' | sort -u | while read -r library; do mkdir -p "/controller/runtime$(dirname "$library")"; cp "$library" "/controller/runtime$library"; done
COPY tooling/ci/protected-bootstrap.mts /controller/protected-bootstrap.mts
COPY tooling/ci/candidate-sandbox.mts tooling/ci/dependency-proxy.mts tooling/ci/dependency-allowlist.json /controller/
COPY tooling/ci/sandbox-runner.mjs /controller/runtime/sandbox-runner.mjs
RUN printf '#!/bin/sh\nexec /usr/local/bin/node --experimental-strip-types /controller/protected-bootstrap.mts "$@"\n' > /controller/bin/protected-bootstrap \
  && chmod 0555 /controller/bin/protected-bootstrap /controller/runtime/bin/node /controller/runtime/bin/socat \
  && chmod -R a-w /controller/runtime /controller/*.mts /controller/dependency-allowlist.json \
  && chown node:node /controller/proxy
USER node
ENTRYPOINT ["/controller/bin/protected-bootstrap"]
