import {contourBands,type ContourSeries} from '../contours';
export default function ContourLegend({series,palette,hour}:{series:ContourSeries;palette:string[];hour?:number}){
  return <div className="contour-legend"><strong>{series.label.replace('{HH}',String(hour??''))}</strong><div className="contour-bands" role="group" aria-label="Contour band ranges">{contourBands(series,palette).map(b=><span key={b.lo}><i aria-hidden="true" style={{background:b.color}}/>{b.label}</span>)}</div><p>{series.unit}</p><p><b>Smoothed for display.</b> Blank means no fire nearby or no data. Colours and levels are fixed across years{series.hours_ist?' and hours':''}.</p></div>;
}
