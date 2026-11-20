export type Color="red"|"green"|"yellow"|"blue";
export type Player={color:Color;name:string;ai:boolean;tokens:{progress:number}[]};
export const COLORS:Color[]=["red","green","yellow","blue"];
export const COLOR_NAMES:Record<Color,string>={red:"Red",green:"Green",yellow:"Yellow",blue:"Blue"};
export const PALETTE:Record<Color,string>={red:"#df5357",green:"#23966b",yellow:"#e5b63f",blue:"#4788ca"};
export const TRACK:[number,number][]=[[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
export const START:Record<Color,number>={red:0,green:13,yellow:26,blue:39};
export const SAFE=new Set([0,8,13,21,26,34,39,47]);
export const HOME_LANES:Record<Color,[number,number][] >={red:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],green:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],yellow:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],blue:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]};
export const BASES:Record<Color,{x:number;y:number}>={red:{x:0,y:0},green:{x:9,y:0},yellow:{x:9,y:9},blue:{x:0,y:9}};
export const BASE_SPOTS:Record<Color,[number,number][] >={red:[[2.05,2.05],[4,2.05],[2.05,4],[4,4]],green:[[11,2.05],[12.95,2.05],[11,4],[12.95,4]],yellow:[[11,11],[12.95,11],[11,12.95],[12.95,12.95]],blue:[[2.05,11],[4,11],[2.05,12.95],[4,12.95]]};
export function trackPosition(c:Color,p:number):[number,number]|null{return p<0||p>50?null:TRACK[(START[c]+p)%52]}
export function tokenPosition(c:Color,t:{progress:number},i:number):[number,number]{if(t.progress<0)return BASE_SPOTS[c][i];if(t.progress<=50)return trackPosition(c,t.progress)!;return HOME_LANES[c][t.progress-51]}
export function legalTokens(p:Player,d:number):number[]{return p.tokens.map((t,i)=>({t,i})).filter(({t})=>t.progress===-1?d===6:t.progress+d<=56).map(x=>x.i)}
export function moveToken(players:Player[],pi:number,ti:number,d:number){const next=players.map(p=>({...p,tokens:p.tokens.map(t=>({...t}))}));const p=next[pi],t=p.tokens[ti];t.progress=t.progress===-1?0:t.progress+d;let captured=0;if(t.progress<=50){const pos=trackPosition(p.color,t.progress)!;if(!SAFE.has((START[p.color]+t.progress)%52))next.forEach((op,j)=>{if(j===pi)return;op.tokens.forEach(ot=>{if(ot.progress<0||ot.progress>50)return;const q=trackPosition(op.color,ot.progress)!;if(q[0]===pos[0]&&q[1]===pos[1]){ot.progress=-1;captured++}})})}return {players:next,captured}}
export function winner(p:Player){return p.tokens.every(t=>t.progress===56)}
