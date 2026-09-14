#!/usr/bin/env node
// npm run play: starts the Wizard backend and frontend together, reachable from
// this computer only, from your local Wi-Fi, or over Tailscale.
//
//   npm run play                     asks which setup you want
//   npm run play -- --mode lan       local | lan | tailscale, without asking
//   npm run play -- --dry-run        shows what it would do and starts nothing

import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The frontend calls the backend on this port of whichever machine served the
// page (src/services/api.ts), so both ports are fixed.
const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
};
const dryRun = args.includes("--dry-run");

// Tailscale addresses come from 100.64.0.0/10.
const isTailscale = (address) => {
  const [a, b] = address.split(".").map(Number);
  return a === 100 && b >= 64 && b <= 127;
};

const ipv4Addresses = () =>
  Object.entries(os.networkInterfaces()).flatMap(([name, list]) =>
    (list ?? [])
      .filter((entry) => entry.family === "IPv4" && !entry.internal)
      .map((entry) => ({ name, address: entry.address, cidr: entry.cidr })),
  );

function findLan() {
  return (
    ipv4Addresses().find(
      ({ name, address }) =>
        !isTailscale(address) && !/^(tailscale|docker|br-|veth|virbr|vboxnet|zt)/.test(name),
    ) ?? null
  );
}

function findTailscale() {
  const onInterface = ipv4Addresses().find(({ address }) => isTailscale(address));
  if (onInterface) return onInterface.address;
  try {
    const address = execFileSync("tailscale", ["ip", "-4"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    })
      .trim()
      .split("\n")[0];
    return isTailscale(address) ? address : null;
  } catch {
    return null;
  }
}

// "192.168.1.107/24" -> "192.168.1.0/24"
function networkOf(cidr) {
  const [address, bitsText] = cidr.split("/");
  const bits = Number(bitsText);
  const value = address.split(".").reduce((total, octet) => total * 256 + Number(octet), 0);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const network = (value & mask) >>> 0;
  return `${[24, 16, 8, 0].map((shift) => (network >>> shift) & 255).join(".")}/${bits}`;
}

// ufw's config file is readable without root, even though its rules aren't.
function ufwEnabled() {
  try {
    return /^\s*ENABLED\s*=\s*yes/im.test(readFileSync("/etc/ufw/ufw.conf", "utf8"));
  } catch {
    return false;
  }
}

const origin = (host) => `http://${host}:${FRONTEND_PORT}`;
const localOrigins = [origin("localhost"), origin("127.0.0.1")];
const lan = findLan();
const tailscale = findTailscale();

// listen: the backend's address; viteHost: the frontend's (null keeps Vite's
// default, this computer only); open: where to point a browser; origins: the
// pages the backend accepts requests from.
const modes = [
  {
    key: "local",
    title: "Localhost",
    detail: "this computer only",
    listen: "127.0.0.1",
    viteHost: null,
    open: ["localhost"],
    origins: localOrigins,
    note: "Only this computer can reach the game.",
    steps: [],
    firewall: null,
  },
];

// The box telling you exactly where to point a browser.
function printConnectHelp(mode) {
  const rule = "─".repeat(64);
  const lines = ["", rule, ` ${mode.title}: how to connect`, rule];
  if (mode.key === "local") {
    lines.push(" On this computer, open:", `     ${origin("localhost")}`);
  } else {
    lines.push(" On your phone or another device:");
    mode.steps.forEach((step, index) => lines.push(`   ${index + 1}. ${step}`));
    lines.push(`   ${mode.steps.length + 1}. Open  ${origin(mode.open[0])}`);
    lines.push("", mode.key === "lan" ? ` On this computer you can also use  ${origin("localhost")}` : " Use the same address on this computer.");
    if (mode.firewall && ufwEnabled()) {
      lines.push(
        "",
        " Firewall: ufw is on, and it blocks other devices unless these ports are",
        " allowed. If the page won't load on the other device, run once:",
        `     ${mode.firewall}`,
      );
    }
  }
  lines.push("", ` ${mode.note}`, rule, "");
  console.log(lines.join("\n"));
}
if (lan) {
  modes.push({
    key: "lan",
    title: "Local Wi-Fi",
    detail: `${lan.address} on ${lan.name}`,
    listen: "0.0.0.0",
    viteHost: "0.0.0.0",
    open: [lan.address, "localhost"],
    origins: [...localOrigins, origin(lan.address), ...(tailscale ? [origin(tailscale)] : [])],
    note:
      "Anyone on this network can reach the game; on shared or public Wi-Fi, prefer Tailscale. " +
      "If a device still can't connect, the router may keep Wi-Fi devices apart (client isolation); " +
      "Tailscale works around that.",
    steps: [
      lan.cidr?.endsWith("/24")
        ? `Join the same Wi-Fi as this computer: the device's own address should start with ${lan.address.split(".").slice(0, 3).join(".")}.`
        : `Join the same network as this computer (${lan.cidr ? networkOf(lan.cidr) : lan.address}).`,
      "With more than one router, that means the one this computer is connected to.",
    ],
    firewall: `sudo ufw allow from ${lan.cidr ? networkOf(lan.cidr) : lan.address} to any port ${BACKEND_PORT},${FRONTEND_PORT} proto tcp`,
  });
}
if (tailscale) {
  modes.push({
    key: "tailscale",
    title: "Tailscale",
    detail: tailscale,
    listen: tailscale,
    viteHost: tailscale,
    open: [tailscale],
    origins: [origin(tailscale)],
    note: "Only devices on your tailnet can reach the game.",
    steps: ["Turn on Tailscale, signed in to an account that can reach this computer (yours, or one you've shared this machine with)."],
    firewall: `sudo ufw allow in on tailscale0 to any port ${BACKEND_PORT},${FRONTEND_PORT} proto tcp`,
  });
}

async function chooseMode() {
  const requested = argValue("--mode");
  if (requested) {
    const mode = modes.find((candidate) => candidate.key === requested);
    if (!mode) {
      console.error(`No "${requested}" setup is available here. Options: ${modes.map((m) => m.key).join(", ")}.`);
      process.exit(1);
    }
    return mode;
  }
  if (!process.stdin.isTTY) return modes[0];

  console.log("\nHow should the game be reachable?\n");
  modes.forEach((mode, index) => console.log(`  ${index + 1}) ${mode.title.padEnd(12)} ${mode.detail}`));
  if (!tailscale) console.log("     (Tailscale not detected)");

  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = (await prompt.question(`\nChoose 1-${modes.length} [1]: `)).trim();
      const index = answer === "" ? 0 : Number(answer) - 1;
      if (Number.isInteger(index) && modes[index]) return modes[index];
      console.log("  Please enter one of the numbers above.");
    }
  } finally {
    prompt.close();
  }
}

function accepting(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function portTaken(port, mode) {
  const hosts = ["127.0.0.1", "::1"];
  if (mode.listen !== "0.0.0.0" && mode.listen !== "127.0.0.1") hosts.push(mode.listen);
  for (const host of hosts) {
    if (await accepting(port, host)) return true;
  }
  return false;
}

// Runs a command in its own process group, prefixing each line of its output.
function start(name, command, commandArgs, options, onLine = () => {}) {
  const child = spawn(command, commandArgs, { ...options, stdio: ["ignore", "pipe", "pipe"], detached: true });
  for (const stream of [child.stdout, child.stderr]) {
    let pending = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines) {
        console.log(`[${name}] ${line}`);
        onLine(line);
      }
    });
  }
  return child;
}

const mode = await chooseMode();
const urls = mode.open.map(origin);
const backendEnv = { HOST: mode.listen, CORS_ORIGINS: mode.origins.join(",") };
const viteArgs = ["vite", "--port", String(FRONTEND_PORT), "--strictPort", ...(mode.viteHost ? ["--host", mode.viteHost] : [])];

printConnectHelp(mode);

if (dryRun) {
  console.log(
    JSON.stringify(
      { mode: mode.key, backend: { command: "npm run dev (in backend/)", env: backendEnv }, frontend: `npx ${viteArgs.join(" ")}`, open: urls },
      null,
      2,
    ),
  );
  process.exit(0);
}

for (const [port, what] of [[BACKEND_PORT, "backend"], [FRONTEND_PORT, "frontend"]]) {
  if (await portTaken(port, mode)) {
    console.error(
      `\nPort ${port} (the ${what}) is already in use. Stop whatever is running there, ` +
        "such as an earlier npm run dev, and try again.",
    );
    process.exit(1);
  }
}

const backend = start("backend", "npm", ["run", "dev"], {
  cwd: path.join(ROOT, "backend"),
  env: { ...process.env, ...backendEnv },
});
// Once Vite is ready, repeat the connection help below its startup output.
let announcedReady = false;
const frontend = start("frontend", "npx", viteArgs, { cwd: ROOT, env: process.env }, (line) => {
  if (announcedReady || !/ready in/i.test(line)) return;
  announcedReady = true;
  setTimeout(() => printConnectHelp(mode), 100);
});

console.log("Starting both servers. Press Ctrl+C to stop them.\n");

let stopping = false;
const stop = (code) => {
  if (stopping) return;
  stopping = true;
  for (const child of [backend, frontend]) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
  setTimeout(() => process.exit(code), 500);
};
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
for (const [child, name] of [[backend, "backend"], [frontend, "frontend"]]) {
  child.on("exit", (code) => {
    if (stopping) return;
    console.error(`\nThe ${name} stopped${code ? ` (exit ${code})` : ""}, so the other is stopping too.`);
    stop(code ?? 1);
  });
}
