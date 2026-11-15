import {describe,expect,it} from 'vitest';
import {briefHtml,briefText} from './roleBrief';
const result:any={months:[10,11],a:2021,b:2025,platforms:[{platform:'N',status:'ok',changePct:-82},{platform:'A',status:'ok',changePct:-75}],harmonized:{status:'ok',changePct:-82,rangePct:[-88,-72]},checks:{late:'signal',relationship:'signal',drivers:['A'],tests:[],year:2025}};
const input={role:'policy' as const,name:'Punjab <test>',monthLabel:'Oct–Nov',result,actions:['Watch the late afternoon.'],notes:[],link:'https://example.org/?a=1#explorer',dataVersion:'2026-11-14',today:'2026-11-15'};
describe('role brief',()=>{
  it('leads with the verdict, then actions, evidence and limits',()=>{
    const t=briefText(input);
    expect(t.indexOf('VERDICT: Timing matters here')).toBeLessThan(t.indexOf('WHAT TO DO'));
    expect(t).toContain('1. Watch the late afternoon.');
    expect(t).toContain('−82% (approximate range −88% to −72%)');
    expect(t).toContain('Has burning moved to hours the satellites miss? Yes, likely');
    expect(t).toContain('not individual fires');
  });
  it('escapes the place name in the HTML file',()=>{const h=briefHtml(input);expect(h).toContain('Punjab &lt;test&gt;');expect(h).not.toContain('<test>');expect(h).toContain('href="https://example.org/?a=1#explorer"');});
});
