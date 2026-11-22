// A deploy built without VITE_REMOTE=1 is a "local mode" site: it looks fine but never talks to the server,
// so nothing anyone makes is saved or shared. Better to stop before deploying than to find out afterwards.

/** True when the build will be a live (server-connected) one. `fileTexts` are the contents of the .env files Vite reads. */
export function liveModeConfigured(fileTexts, env) {
  if (env && env.VITE_REMOTE === "1") return true;
  return (fileTexts ?? []).some((t) => /^\s*VITE_REMOTE\s*=\s*["']?1["']?\s*(#.*)?$/m.test(t));
}
