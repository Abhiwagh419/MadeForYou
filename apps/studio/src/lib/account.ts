import { clearLocalAssets } from "./assets";
import { resetState } from "../state/store";

/** Forgets everything MadeForYou keeps in this browser: pages, photos, upload notes. Signing out is separate. */
export async function wipeLocalData() {
  resetState();
  await clearLocalAssets();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("mfy")) if (k !== "mfy:dev-user") localStorage.removeItem(k);
  } catch {
    /* storage blocked: nothing to clear */
  }
}
