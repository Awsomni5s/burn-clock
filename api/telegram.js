// POST /api/telegram: Telegram webhook (needs TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET).
import {handleTelegram} from './_lib/server.mjs';
export function POST(request){return handleTelegram(request,process.env);}
export function GET(request){return handleTelegram(request,process.env);}
