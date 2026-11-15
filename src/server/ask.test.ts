import {describe,expect,it} from 'vitest';
import {numbersIn,unverified} from './ask';
describe('assistant number check',()=>{
  it('reads numbers, including thousands separators and minus signs',()=>{expect(numbersIn('fell −80% (1,234 cells) in 2025, ratio 1.14')).toEqual([-80,1234,2025,1.14]);});
  it('accepts rounded tool values, fractions shown as percentages, years and small counts',()=>{
    const src=[JSON.stringify({change_pct:-80.3504,ratio:1.1369,share:0.9871,cells:1234})];
    expect(unverified('It fell about 80%, the ratio is 1.14, 99% came late, 1,234 cells, between 2021 and 2025, in 3 districts.',src,'')).toEqual([]);
  });
  it('flags numbers that are not in the tool results or the question',()=>{
    const src=[JSON.stringify({change_pct:-80.35})];
    expect(unverified('Fires fell 93% and smoke rose 37.2%.',src,'')).toEqual([93,37.2]);
    expect(unverified('You asked about 93%: the data shows 80%.',src,'Did fires fall 93%?')).toEqual([]);
  });
  it('ignores numbers inside links',()=>{expect(unverified('See https://x.test/?box=27.6,73.8,32.6,77.6#explorer',[],'')).toEqual([]);});
});
