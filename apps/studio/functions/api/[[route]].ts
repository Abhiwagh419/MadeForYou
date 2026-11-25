import { createApp } from "@madeforyou/api";
import { handle } from "hono/cloudflare-pages";

export const onRequest = handle(createApp());
