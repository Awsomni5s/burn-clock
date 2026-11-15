export const DEFINITIONS:Record<string,string>={
 'active cell-day':'A map cell with a qualifying satellite detection on one day; it is not an individual fire.',
 'active cell-days':'Map cells with qualifying satellite detections counted once per day and platform, not individual fires.',
 'pixel-hours':'Detected satellite pixels counted at each observed hour; the same activity can be counted repeatedly.',
 'pixel-days':'Detected satellite pixels counted once per day, not individual fires.',
 'harmonized':'Satellite observations adjusted to a common instrument scale using overlapping years.',
 'VIIRS':'The fire-detecting instrument aboard S-NPP, NOAA-20 and NOAA-21.',
 'MODIS':'The fire-detecting instrument aboard Terra and Aqua.',
 'GK2A':'Geo-KOMPSAT-2A, the satellite providing the independent hourly Punjab observations.',
 'held-out':'Observations excluded from fitting and used to assess error.',
 'LOYO':'Leave one year out: fit without one year and assess it separately.',
 'geostationary':'A satellite that repeatedly watches the same part of Earth.',
 'Theil–Sen':'A trend estimate using the median slope between pairs of annual values.'
};
export default function Term({text}:{text:string}){const key=Object.keys(DEFINITIONS).find(k=>k.toLowerCase()===text.toLowerCase());return <dfn className="inline-term" tabIndex={0} title={DEFINITIONS[key??text]}>{text}</dfn>;}
