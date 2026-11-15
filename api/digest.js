// GET /api/digest: weekly Telegram message to subscribers (Vercel Cron; needs CRON_SECRET, Upstash Redis and the bot token).
import {handleDigest} from './_lib/server.mjs';
export function GET(request){return handleDigest(request,process.env);}
