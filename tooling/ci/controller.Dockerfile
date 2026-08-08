FROM node:22.12.0-bookworm@sha256:0e910f435308c36ea60b4cfd7b80208044d77a074d16b768a81901ce938a62dc
RUN apt-get update && apt-get install -y --no-install-recommends bubblewrap ca-certificates git strace && rm -rf /var/lib/apt/lists/*
WORKDIR /controller
COPY tooling/ci/candidate-sandbox.mts tooling/ci/dependency-proxy.mts tooling/ci/dependency-allowlist.json ./
USER node
ENTRYPOINT ["node", "--experimental-strip-types", "/controller/candidate-sandbox.mts"]
