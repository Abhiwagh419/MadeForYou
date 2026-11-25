import { clearLocalAssets } from "./assets";
import { resetState } from "../state/store";

export async function wipeLocalData() {
  resetState();
  await clearLocalAssets();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("mfy")) if (k !== "mfy:dev-user") localStorage.removeItem(k);
  } catch {}
}
