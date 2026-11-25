import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.argv[2] ?? "dist/_headers");
if (!existsSync(file)) process.exit(0);

const host = (process.env.CLERK_FRONTEND_HOST ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const enforce = process.env.CSP_ENFORCE === "1";

if (host && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) {
  console.error(`CLERK_FRONTEND_HOST looks wrong: ${host}`);
  process.exit(1);
}

const widen = (policy, directive, extra) =>
  policy.replace(new RegExp(`(${directive} )([^;]*)`), (_, name, values) => {
    const kept = host ? values.split(" ").filter((v) => v !== "https://*.clerk.accounts.dev") : values.split(" ");
    return name + [...kept, ...extra].join(" ");
  });

const lines = readFileSync(file, "utf8").split("\n").map((line) => {
  const m = line.match(/^(\s*)(Content-Security-Policy(?:-Report-Only)?): (.*)$/);
  if (!m) return line;
  let policy = m[3];
  if (host) {
    policy = widen(policy, "script-src", [`https://${host}`]);
    policy = widen(policy, "frame-src", [`https://${host}`]);
    policy = widen(policy, "connect-src", [`https://${host}`, "https://clerk-telemetry.com"]);
  }
  return `${m[1]}${enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"}: ${policy}`;
});

writeFileSync(file, lines.join("\n"));
console.log(`headers ready (${enforce ? "enforcing" : "report-only"}${host ? `, clerk on ${host}` : ""})`);
