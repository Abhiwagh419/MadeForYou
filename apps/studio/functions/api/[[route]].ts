import { createApp } from "@madeforyou/api";
import { handle } from "hono/cloudflare-pages";

// All API routes live in packages/api; this file only connects them to Cloudflare Pages.
export const onRequest = handle(createApp());
