import { appendFileSync } from "node:fs";
import dns from "node:dns";
import dgram from "node:dgram";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import process from "node:process";
import tls from "node:tls";
import { URL } from "node:url";
import { syncBuiltinESMExports } from "node:module";

const auditPath = process.env.MAESTRO_NETWORK_AUDIT_PATH;
const originalFetch = globalThis.fetch;
const originalSocketConnect = net.Socket.prototype.connect;
const originalNetConnect = net.connect;
const originalNetCreateConnection = net.createConnection;
const originalTlsConnect = tls.connect;
const originalHttpRequest = http.request;
const originalHttpGet = http.get;
const originalHttpsRequest = https.request;
const originalHttpsGet = https.get;

function deny(channel) {
  if (typeof auditPath === "string" && auditPath.length > 0) {
    appendFileSync(
      auditPath,
      `${JSON.stringify({ event: "outbound-network-denied", channel })}\n`,
      "utf8",
    );
  }
  throw new Error(`MAESTRO_OUTBOUND_NETWORK_DENIED:${channel}`);
}

globalThis.fetch = (...args) =>
  isLoopbackRequest(args[0]) ? originalFetch(...args) : deny("fetch");
if (typeof globalThis.WebSocket === "function") {
  globalThis.WebSocket = class DeniedWebSocket {
    constructor() {
      deny("websocket");
    }
  };
}

net.Socket.prototype.connect = function guardedSocketConnect(...args) {
  return isLocalConnection(args)
    ? originalSocketConnect.apply(this, args)
    : deny("net.connect");
};
net.connect = (...args) =>
  isLocalConnection(args) ? originalNetConnect(...args) : deny("net.connect");
net.createConnection = (...args) =>
  isLocalConnection(args)
    ? originalNetCreateConnection(...args)
    : deny("net.createConnection");
tls.connect = (...args) =>
  isLocalConnection(args) ? originalTlsConnect(...args) : deny("tls.connect");
http.request = (...args) =>
  isLoopbackRequest(args[0])
    ? originalHttpRequest(...args)
    : deny("http.request");
http.get = (...args) =>
  isLoopbackRequest(args[0]) ? originalHttpGet(...args) : deny("http.get");
https.request = (...args) =>
  isLoopbackRequest(args[0])
    ? originalHttpsRequest(...args)
    : deny("https.request");
https.get = (...args) =>
  isLoopbackRequest(args[0]) ? originalHttpsGet(...args) : deny("https.get");

for (const method of ["lookup", "resolve", "resolve4", "resolve6", "reverse"]) {
  dns[method] = () => deny(`dns.${method}`);
  if (typeof dns.promises?.[method] === "function") {
    dns.promises[method] = () => Promise.reject(deny(`dns.promises.${method}`));
  }
}

const originalCreateSocket = dgram.createSocket.bind(dgram);
dgram.createSocket = (...args) => {
  const socket = originalCreateSocket(...args);
  socket.connect = () => deny("dgram.connect");
  socket.send = () => deny("dgram.send");
  return socket;
};

syncBuiltinESMExports();

function isLocalConnection(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (typeof first === "string") return true;
  if (typeof first === "number") return isLoopbackHost(args[1]);
  if (first !== null && typeof first === "object") {
    if (typeof first.path === "string") return true;
    return isLoopbackHost(first.host);
  }
  return false;
}

function isLoopbackRequest(input) {
  try {
    if (typeof input === "string" || input instanceof URL)
      return isLoopbackHost(new URL(input).hostname);
    if (input !== null && typeof input === "object")
      return isLoopbackHost(input.hostname ?? input.host);
  } catch {
    return false;
  }
  return false;
}

function isLoopbackHost(host) {
  return (
    host === undefined ||
    host === "localhost" ||
    host === "::1" ||
    (typeof host === "string" && host.startsWith("127."))
  );
}
