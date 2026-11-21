import type { Game } from './game';
import { stars } from './game';
export type RecordEntry = {id:string; mission:number; success:boolean; time:number; health:number; stamina:number; clues:number; stars:number; date:string};
const KEY='summit-rescue.records.v1';
export function readRecords():RecordEntry[]{try{const data:unknown=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data.filter((r):r is RecordEntry=>!!r&&typeof r==='object'&&typeof r.id==='string'&&typeof r.success==='boolean'&&[r.time,r.health,r.stars,r.mission].every(Number.isFinite)).slice(0,100):[];}catch{return [];}}
export function saveRecord(game:Game,mission=1):boolean{try{const records=readRecords();const id=`${game.seed}-${mission}`;if(!records.some(r=>r.id===id))records.unshift({id,mission,success:game.status==='success',time:game.elapsed,health:Math.round(game.health),stamina:game.stamina,clues:game.clues.length,stars:stars(game),date:new Date().toLocaleDateString('ko-KR')});localStorage.setItem(KEY,JSON.stringify(records.slice(0,100)));return true;}catch{return false;}}
export type Settings={sound:boolean;volume:number;motion:boolean};
export function readSettings():Settings{try{const s=JSON.parse(localStorage.getItem('summit-rescue.settings')||'{}');return {sound:s?.sound===true,volume:typeof s?.volume==='number'&&Number.isFinite(s.volume)?Math.max(0,Math.min(1,s.volume)):.3,motion:s?.motion!==false};}catch{return {sound:false,volume:.3,motion:true};}}
export function saveSettings(s:Settings){try{localStorage.setItem('summit-rescue.settings',JSON.stringify(s));}catch{/* Session settings still work. */}}
