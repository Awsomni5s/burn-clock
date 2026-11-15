// GET /api/telegram-setup?key=TELEGRAM_WEBHOOK_SECRET: registers the bot's webhook and command list once.
import {handleSetup} from './_lib/server.mjs';
export function GET(request){return handleSetup(request,process.env);}
