import type {TimingStatus} from './timing';
/** Plain labels. The later-burning question can only be "likely": the check is a diagnostic, not proof. */
export const lateLabel=(s:TimingStatus)=>s==='signal'?'Yes, likely':s==='within'?'No sign':'Can’t tell';
export const modisLabel=(s:TimingStatus)=>s==='signal'?'Yes':s==='within'?'No':'Can’t tell';
