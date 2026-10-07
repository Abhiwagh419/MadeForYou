export const PLACEHOLDER: string;
export function isDatabaseId(v: unknown): boolean;
export function currentDatabaseId(toml: string): string;
export function pickDatabaseId(stdout: string, name: string): string | null;
export function applyDatabaseId(toml: string, id: string): string;
