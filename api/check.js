// GET /api/check?box=south,west,north,east (or lat=&lon=&radius_deg=) &months=10,11&a=2021&b=2025 → verdict JSON for any place.
import {handleCheck} from './_lib/server.mjs';
export function GET(request){return handleCheck(request,process.env);}
