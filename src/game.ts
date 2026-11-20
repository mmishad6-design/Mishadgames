export type Color = "red" | "green" | "yellow" | "blue";
export type Token = { progress: number };
export type Player = { color: Color; name: string; ai: boolean; tokens: Token[] };
export const COLORS: Color[] = ["red", "green", "yellow", "blue"];
export const COLOR_NAMES: Record<Color,string> = {red:"Red",green:"Green",yellow:"Yellow",blue:"Blue"};
export const PALETTE: Record<Color,string> = {red:"#df5357",green:"#23966b",yellow:"#e5b63f",blue:"#4788ca"};
export const TRACK: [number,number][] = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
export const START: Record<Color,number> = {red:0,green:13,yellow:26,blue:39};
export const SAFE = new Set([0,8,13,21,26,34,39,47]);
export const HOME_LANES: Record<Color,[number,number][]> = {
 red:[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
 green:[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
 yellow:[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
 blue:[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
};
export const BASES: Record<Color,{x:number;y:number}> = {red:{x:0,y:0},green:{x:9,y:0},yellow:{x:9,y:9},blue:{x:0,y:9}};
export const BASE_SPOTS: Record<Color,[number,number][]> = {
 red:[[2.05,2.05],[4,2.05],[2.05,4],[4,4]],
 green:[[11,2.05],[12.95,2.05],[11,4],[12.95,4]],
 yellow:[[11,11],[12.95,11],[11,12.95],[12.95,12.95]],
 blue:[[2.05,11],[4,11],[2.05,12.95],[4,12.95]]
};
export function trackPosition(color:Color,progress:number):[number,number]|null {
 if(!Number.isInteger(progress)||progress<0||progress>50)return null;
 return TRACK[(START[color]+progress)%52];
}
export function tokenPosition(color:Color,token:Token,index:number):[number,number] {
 if(token.progress<0)return BASE_SPOTS[color][index];
 if(token.progress<=50)return trackPosition(color,token.progress)!;
 return HOME_LANES[color][token.progress-51];
}
export function legalTokens(player:Player,dice:number):number[] {
 if(!Number.isInteger(dice)||dice<1||dice>6)return [];
 return player.tokens.flatMap((token,index)=>{
  if(token.progress===-1)return dice===6?[index]:[];
  if(token.progress>=0&&token.progress<56&&token.progress+dice<=56)return [index];
  return [];
 });
}
export function moveToken(players:Player[],playerIndex:number,tokenIndex:number,dice:number):{players:Player[];captured:number;finished:boolean} {
 const player=players[playerIndex];
 if(!player||!Number.isInteger(tokenIndex)||tokenIndex<0||tokenIndex>=player.tokens.length||!legalTokens(player,dice).includes(tokenIndex))
  return {players,captured:0,finished:false};
 const next=players.map(p=>({...p,tokens:p.tokens.map(t=>({...t}))}));
 const mover=next[playerIndex],token=mover.tokens[tokenIndex];
 token.progress=token.progress===-1?0:token.progress+dice;
 let captured=0;
 if(token.progress<=50){
  const target=trackPosition(mover.color,token.progress)!;
  const absolute=(START[mover.color]+token.progress)%52;
  if(!SAFE.has(absolute)){
   next.forEach((opponent,opponentIndex)=>{
    if(opponentIndex===playerIndex)return;
    opponent.tokens.forEach(otherToken=>{
     if(otherToken.progress<0||otherToken.progress>50)return;
     const position=trackPosition(opponent.color,otherToken.progress)!;
     if(position[0]===target[0]&&position[1]===target[1]){
      otherToken.progress=-1;captured++;
     }
    });
   });
  }
 }
 return {players:next,captured,finished:token.progress===56};
}
export function winner(player:Player):boolean{return player.tokens.every(token=>token.progress===56)}
export function chooseAiToken(players:Player[],playerIndex:number,dice:number,legal:number[]):number {
 const player=players[playerIndex];
 let best=legal[0],bestScore=-Infinity;
 for(const index of legal){
  const before=player.tokens[index].progress;
  const result=moveToken(players,playerIndex,index,dice);
  const after=result.players[playerIndex].tokens[index].progress;
  let score=after*4;
  if(before===-1)score+=650;
  if(after===56)score+=10000;
  else if(after>50&&before<=50)score+=900;
  if(result.captured)score+=result.captured*1800;
  if(after>=0&&after<=50){
   const [x,y]=trackPosition(player.color,after)!;
   const opponents=result.players.filter((_,i)=>i!==playerIndex);
   const threatened=opponents.some(op=>op.tokens.some(t=>{
    if(t.progress<0||t.progress>50)return false;
    const pos=trackPosition(op.color,t.progress)!;
    return pos[0]===x&&pos[1]===y;
   }));
   if(threatened)score-=700;
  }
  if(score>bestScore){bestScore=score;best=index}
 }
 return best;
}
