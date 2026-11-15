// GET /api/punjab?district=Sangrur[&format=text] → check window, busiest weeks, count gap, wording and this week's fires.
import {handlePunjab} from './_lib/server.mjs';
export function GET(request){return handlePunjab(request,process.env);}
