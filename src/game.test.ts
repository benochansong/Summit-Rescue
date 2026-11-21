import { describe, expect, it } from 'vitest';
import { createGame, transition, actionCost, candidates } from './game';
describe('첫 구조 임무',()=>{
  for(let seed=0;seed<3;seed++) it(`${candidates[seed]}에서 수색·응급처치·귀환 가능`,()=>{
    let g=createGame(seed);
    for(const to of ['gate','lookout'])g=transition(g,{type:'move',to});
    g=transition(g,{type:'search'});
    expect(g.clues[0].text).toContain('삼거리');
    for(const to of ['fork',g.target])g=transition(g,{type:'move',to});
    g=transition(g,{type:'search'});expect(g.found).toBe(true);
    g=transition(g,{type:'aid'});
    for(const to of ['fork','lookout','gate','base'])g=transition(g,{type:'move',to});
    expect(g.status).toBe('success');expect(g.elapsed).toBe(128);expect(g.health).toBeGreaterThan(65);
  });
  it('순간이동 및 오래된 명령을 차단',()=>{const g=createGame(0);expect(transition(g,{type:'move',to:'summit'})).toBe(g);const n=transition(g,{type:'move',to:'gate'});expect(transition(n,{type:'search'},0)).toBe(n);});
  it('행동 비용과 휴식 상한',()=>{let g=createGame();expect(actionCost(g,{type:'move',to:'gate'})).toEqual({time:10,energy:5});g=transition(g,{type:'move',to:'gate'});g=transition(g,{type:'rest'});expect(g.stamina).toBe(100);expect(g.elapsed).toBe(30);});
  it('실패와 재시작',()=>{let g=createGame();g={...g,elapsed:175};expect(transition(g,{type:'search'}).status).toBe('failed');expect(createGame().status).toBe('active');});
});
