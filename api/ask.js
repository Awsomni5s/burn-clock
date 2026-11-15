// GET /api/ask → {configured}. POST /api/ask {"question": "..."} → Claude answers using only Burn Clock tools; numbers checked.
import {handleAsk} from './_lib/server.mjs';
export function GET(request){return handleAsk(request,process.env);}
export function POST(request){return handleAsk(request,process.env);}
