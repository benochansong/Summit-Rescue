export type Point = { id: string; name: string; x: number; y: number; elevation: number; kind?: 'base' | 'shelter' | 'lookout' | 'cliff' };
export const points: Point[] = [
  {id:'base',name:'구조본부',x:175,y:665,elevation:320,kind:'base'},
  {id:'gate',name:'북쪽 등산로',x:290,y:575,elevation:410},
  {id:'lookout',name:'제2전망대',x:420,y:475,elevation:580,kind:'lookout'},
  {id:'fork',name:'삼거리 이정표',x:535,y:370,elevation:650},
  {id:'cedar',name:'전나무 쉼터',x:375,y:290,elevation:690,kind:'shelter'},
  {id:'valley',name:'물소리 계곡',x:670,y:465,elevation:520},
  {id:'cave',name:'바위 그늘',x:710,y:265,elevation:740,kind:'cliff'},
  {id:'west',name:'서쪽 숲길',x:150,y:465,elevation:460},
  {id:'spring',name:'옹달샘',x:235,y:345,elevation:530},
  {id:'hut',name:'백운 대피소',x:210,y:225,elevation:640,kind:'shelter'},
  {id:'ridge',name:'칼바람 능선',x:525,y:190,elevation:890,kind:'cliff'},
  {id:'summit',name:'백운산 정상',x:650,y:95,elevation:1087,kind:'lookout'},
  {id:'east',name:'동쪽 암릉',x:835,y:170,elevation:920,kind:'cliff'},
  {id:'bridge',name:'계곡 나무다리',x:770,y:590,elevation:400},
  {id:'pine',name:'소나무 숲',x:525,y:620,elevation:400},
  {id:'lower',name:'하부 탐방로',x:375,y:705,elevation:340},
  {id:'waterfall',name:'작은 폭포',x:855,y:405,elevation:500},
];
export type Edge = { a: string; b: string; steep?: boolean; risk?: 'river' | 'ridge' };
export const edges: Edge[] = [
  {a:'base',b:'gate'},{a:'gate',b:'lookout'},{a:'lookout',b:'fork'},
  {a:'fork',b:'cedar'},{a:'fork',b:'valley',risk:'river'},{a:'fork',b:'cave',risk:'ridge'},
  {a:'base',b:'west'},{a:'west',b:'spring'},{a:'spring',b:'hut'},
  {a:'hut',b:'cedar'},{a:'spring',b:'lookout'},
  {a:'cedar',b:'ridge',steep:true,risk:'ridge'},{a:'ridge',b:'summit',steep:true,risk:'ridge'},
  {a:'summit',b:'east',steep:true,risk:'ridge'},{a:'east',b:'cave',steep:true},
  {a:'base',b:'lower'},{a:'lower',b:'pine'},{a:'pine',b:'lookout'},
  {a:'pine',b:'bridge'},{a:'bridge',b:'valley'},{a:'valley',b:'waterfall'},
  {a:'waterfall',b:'cave'},
];
export const candidates = ['cedar','valley','cave'];
export const point = (id: string) => points.find(p=>p.id===id)!;
export const connection = (a: string,b: string) => edges.find(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
export const adjacent = (id: string) => edges.filter(e=>e.a===id||e.b===id).map(e=>e.a===id?e.b:e.a);
export type Clue = { location: string; text: string };
export type Game = {
  seed: number; target: string; position: string; elapsed: number; stamina: number; health: number;
  found: boolean; treated: boolean; visited: string[]; searched: string[]; trail: string[];
  clues: Clue[]; log: string[]; status: 'active'|'success'|'failed'; reason: string; revision: number;
};
export type Action = {type:'move';to:string}|{type:'search'}|{type:'rest'}|{type:'aid'}|{type:'abandon'};
export type Cost = { time: number; energy: number };
export function createGame(seed = Date.now()): Game {
  return {seed,target:candidates[(seed>>>0)%3],position:'base',elapsed:0,stamina:100,health:85,found:false,treated:false,visited:['base'],searched:[],trail:['base'],clues:[],log:['본부: 제2전망대가 마지막 목격 장소입니다. 북쪽 등산로를 따라 이동하십시오.'],status:'active',reason:'',revision:0};
}
export function actionCost(g:Game,a:Action):Cost {
  if(a.type==='move') { const steep=connection(g.position,a.to)?.steep; return {time:Math.ceil((steep?20:10)*(g.found?1.2:1)),energy:Math.ceil((steep?12:5)*(g.found?1.4:1))}; }
  return a.type==='search'?{time:15,energy:7}:a.type==='rest'?{time:20,energy:-15}:a.type==='aid'?{time:10,energy:3}:{time:0,energy:0};
}
export function disabledReason(g:Game,a:Action):string {
  if(g.status!=='active') return '종료된 임무입니다.';
  if(a.type==='move'&&!connection(g.position,a.to)) return '연결된 등산로로만 이동할 수 있습니다.';
  if(a.type==='search'&&g.searched.includes(g.position)) return '이미 수색을 마쳤습니다.';
  if(a.type==='aid'&&(!g.found||g.treated)) return '조난자 발견 후 한 번 응급처치할 수 있습니다.';
  if(a.type==='rest'&&g.stamina===100) return '체력이 충분합니다.';
  if(g.stamina<actionCost(g,a).energy) return '체력이 부족합니다. 휴식 후 이동하거나 임무를 중단하세요.';
  return '';
}
export function transition(g:Game,a:Action,expectedRevision=g.revision):Game {
  if(expectedRevision!==g.revision||disabledReason(g,a)) return g;
  if(a.type==='abandon') return {...g,status:'failed',reason:'구조대 안전을 위해 임무를 중단했습니다.',revision:g.revision+1};
  const cost=actionCost(g,a);
  const n:Game={...g,elapsed:g.elapsed+cost.time,stamina:Math.min(100,g.stamina-cost.energy),health:Math.max(0,g.health-cost.time*.18),revision:g.revision+1};
  let message='';
  if(a.type==='move') {n.position=a.to;n.visited=[...new Set([...g.visited,a.to])];n.trail=[...g.trail,a.to];message=`${point(a.to).name} 도착. ${cost.time}분 경과, 체력 ${cost.energy} 소모.`;}
  if(a.type==='search') {
    n.searched=[...g.searched,g.position];
    if(g.position===g.target){n.found=true;message='본부, 여기는 구조 1팀. 실종자 발견! 생존 확인, 응급처치를 시작하겠습니다.';}
    else {
      const text=g.position==='lookout'?`떨어진 물병과 이동 기록 발견. 삼거리 이정표에서 ${point(g.target).name} 방향으로 향했습니다.`:g.position==='fork'?`등산화 발자국과 배낭을 확인했습니다. ${point(g.target).name}에서 수색하십시오.`:g.position==='gate'?'마지막 목격 정보: 제2전망대로 향하는 등산객을 봤습니다.':adjacent(g.position).includes(g.target)?`가까운 ${point(g.target).name} 쪽에서 희미한 구조 신호가 들립니다.`:'주변 수색 완료. 새로운 흔적이 없습니다. 마지막 목격 장소의 단서를 확인하세요.';
      if(!text.startsWith('주변')) n.clues=[...g.clues,{location:g.position,text}];
      message=text;
    }
  }
  if(a.type==='rest')message=`20분 휴식. 체력 ${n.stamina-g.stamina} 회복.`;
  if(a.type==='aid'){n.treated=true;n.health=Math.min(100,n.health+22);message='응급처치 완료. 조난자 생존 상태 22 회복. 이제 구조본부로 귀환하십시오.';}
  if(n.elapsed>=180||n.health<=0){n.status='failed';n.reason=n.health<=0?'조난자의 생존 상태가 0에 도달했습니다.':'일몰 전 구조 제한 시간이 지났습니다.';}
  else if(n.position==='base'&&n.found){n.status='success';n.reason='전원 무사 귀환. 오늘, 한 사람의 내일을 지켰습니다.';}
  n.log=[message,...g.log].slice(0,30);return n;
}
export const stars=(g:Game)=>g.status!=='success'?1:g.health>=65&&g.elapsed<=160?3:g.health>=40?2:1;
export const healthLabel=(health:number)=>health>=80?'안정':health>=50?'주의':health>=20?'위험':health>0?'위급':'구조 실패';
export const objective=(g:Game)=>g.found?g.treated?'조난자와 함께 구조본부로 귀환하세요.':'응급처치로 조난자를 안정시키세요.':g.clues.some(c=>c.text.includes(point(g.target).name))?`${point(g.target).name}에 도착해 주변을 수색하세요.`:'북쪽 등산로를 따라 제2전망대에서 수색하세요.';
