export function liveModeConfigured(fileTexts, env) {
  if (env && env.VITE_REMOTE === "1") return true;
  return (fileTexts ?? []).some((t) => /^\s*VITE_REMOTE\s*=\s*["']?1["']?\s*(#.*)?$/m.test(t));
}
