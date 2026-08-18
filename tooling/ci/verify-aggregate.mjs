#!/usr/bin/env node

import console from "node:console";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const requiredWorkflows = ["verify-core", "verify-coverage"];

export async function verifyAggregate(
  pipelineUrl = process.env.CI_PIPELINE_URL,
  fetchPipeline = globalThis.fetch,
) {
  const endpoint = pipelineEndpoint(pipelineUrl);
  const response = await fetchPipeline(endpoint, {
    signal: globalThis.AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Woodpecker API returned HTTP ${response.status}`);
  }

  const pipeline = await response.json();
  if (!Array.isArray(pipeline?.workflows)) {
    throw new Error("Woodpecker API response omitted workflows");
  }

  const states = new Map(
    pipeline.workflows.map((workflow) => [workflow?.name, workflow?.state]),
  );
  const unsuccessful = requiredWorkflows.filter(
    (name) => states.get(name) !== "success",
  );
  if (unsuccessful.length > 0) {
    throw new Error(
      unsuccessful
        .map((name) => `${name}=${states.get(name) ?? "missing"}`)
        .join(", "),
    );
  }

  console.log("verify-aggregate: required workflows succeeded");
}

function pipelineEndpoint(pipelineUrl) {
  if (pipelineUrl === undefined || pipelineUrl === "") {
    throw new Error("CI_PIPELINE_URL is required");
  }
  const url = new URL(pipelineUrl);
  const match = /^\/repos\/(\d+)\/pipeline\/(\d+)\/?$/u.exec(url.pathname);
  if (match === null) {
    throw new Error(`unexpected CI_PIPELINE_URL path: ${url.pathname}`);
  }
  url.pathname = `/api/repos/${match[1]}/pipelines/${match[2]}`;
  url.search = "";
  url.hash = "";
  return url;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await verifyAggregate();
  } catch (error) {
    console.error(`verify-aggregate: ${error?.message ?? String(error)}`);
    process.exitCode = 1;
  }
}
