FROM node:22.23.2-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a
RUN apt-get update && apt-get install -y --no-install-recommends bubblewrap ca-certificates git strace && rm -rf /var/lib/apt/lists/*
WORKDIR /controller
COPY tooling/ci/candidate-sandbox.mts tooling/ci/dependency-proxy.mts tooling/ci/dependency-allowlist.json ./
USER node
ENTRYPOINT ["node", "--experimental-strip-types", "/controller/candidate-sandbox.mts"]
