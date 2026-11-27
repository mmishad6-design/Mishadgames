import {BASES,BASE_SPOTS,COLORS,COLOR_NAMES,HOME_LANES,PALETTE,SAFE,START,TRACK,tokenPosition,type Color,type Player} from "./game";
const DICE_DOTS:Record<number,[number,number][]> = {
  1:[[0,0]],2:[[-14,-14],[14,14]],3:[[-14,-14],[0,0],[14,14]],
  4:[[-14,-14],[14,-14],[-14,14],[14,14]],5:[[-14,-14],[14,-14],[0,0],[-14,14],[14,14]],
  6:[[-14,-14],[14,-14],[-14,0],[14,0],[-14,14],[14,14]]
};
export default function TwoDBoard({players,turn,choices,dice,lastDice,rolling,canRoll,onRoll,onMove,animatedToken}:{players:Player[];turn:number;choices:number[];dice:number|null;lastDice:number|null;rolling:boolean;canRoll:boolean;onRoll:()=>void;onMove:(i:number)=>void;animatedToken:{playerIndex:number;tokenIndex:number;pos:[number,number]}|null}){
 const displayValue=dice??lastDice??5;
 const faceLayout:Record<number,{top:number;side:number}>={1:{top:2,side:3},2:{top:1,side:4},3:{top:1,side:5},4:{top:2,side:6},5:{top:3,side:1},6:{top:4,side:2}};
 const faceDots=(value:number)=>DICE_DOTS[value].map(([x,y])=>[x/14,y/14] as [number,number]);
 const pieces=players.flatMap((player,playerIndex)=>player.tokens.map((token,tokenIndex)=>({player,playerIndex,tokenIndex,pos:animatedToken?.playerIndex===playerIndex&&animatedToken.tokenIndex===tokenIndex?animatedToken.pos:tokenPosition(player.color,token,tokenIndex),animating:animatedToken?.playerIndex===playerIndex&&animatedToken.tokenIndex===tokenIndex})));
 return <svg className="board-svg" viewBox="0 0 600 600" role="img" aria-label="Classic Ludo board">
  <defs>
   <linearGradient id="homeDiceFace" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset=".58" stopColor="#fffefa"/><stop offset="1" stopColor="#e9e4d8"/></linearGradient>
   <radialGradient id="homeDicePip" cx="28%" cy="24%" r="78%"><stop offset="0" stopColor="#49665b"/><stop offset=".42" stopColor="#244a3e"/><stop offset="1" stopColor="#102c23"/></radialGradient>
   <filter id="homeDiceShadow" x="-25%" y="-25%" width="150%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.2"/><feOffset dy="2.5"/><feComponentTransfer><feFuncA type="linear" slope=".25"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
   <radialGradient id="tokenRed" cx="28%" cy="22%" r="78%"><stop offset="0" stopColor="#ffb0a0"/><stop offset=".35" stopColor="#ed6c68"/><stop offset="1" stopColor="#a92e3b"/></radialGradient>
   <radialGradient id="tokenGreen" cx="28%" cy="22%" r="78%"><stop offset="0" stopColor="#a7f2c1"/><stop offset=".35" stopColor="#38b982"/><stop offset="1" stopColor="#126143"/></radialGradient>
   <radialGradient id="tokenYellow" cx="28%" cy="22%" r="78%"><stop offset="0" stopColor="#fff0a8"/><stop offset=".35" stopColor="#f2c64e"/><stop offset="1" stopColor="#b47a20"/></radialGradient>
   <radialGradient id="tokenBlue" cx="28%" cy="22%" r="78%"><stop offset="0" stopColor="#b6dcff"/><stop offset=".35" stopColor="#5b9ddd"/><stop offset="1" stopColor="#28578e"/></radialGradient>
   <filter id="token3dShadow" x="-60%" y="-60%" width="220%" height="240%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.8"/><feOffset dy="4"/><feComponentTransfer><feFuncA type="linear" slope=".42"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="600" height="600" fill="var(--board-surface)"/>
  {COLORS.map(color=>{const base=BASES[color];return <g key={color}>
   <rect x={base.x*40} y={base.y*40} width="240" height="240" fill={PALETTE[color]} stroke="#283b36" strokeWidth="2"/>
   <rect x={base.x*40+34} y={base.y*40+34} width="172" height="172" rx="9" fill="#fffdf7" stroke="#fff" strokeWidth="5"/>
   {BASE_SPOTS[color].map(([x,y],index)=><circle key={index} cx={x*40} cy={y*40} r="25" fill={PALETTE[color]} stroke="#d7d2c5" strokeWidth="3"/>)}
  </g>})}
  {TRACK.map(([x,y],index)=><g key={index}>
   <rect x={x*40} y={y*40} width="40" height="40" fill={SAFE.has(index)?"var(--board-safe)":"var(--board-surface)"} stroke="#b8b9af" strokeWidth="1.2"/>
   {SAFE.has(index)&&<text x={x*40+20} y={y*40+26} textAnchor="middle" fontSize="18" fill="#a18a56">✦</text>}
   {Object.entries(START).some(([,start])=>start===index)&&<rect x={x*40+3} y={y*40+3} width="34" height="34" fill={PALETTE[Object.keys(START).find(key=>START[key as Color]===index) as Color]} opacity=".9"/>}
  </g>)}
  {Object.entries(HOME_LANES).map(([color,cells])=>cells.map(([x,y],index)=><rect key={color+index} x={x*40} y={y*40} width="40" height="40" fill={PALETTE[color as Color]} stroke="#b8b9af" strokeWidth="1.2"/>))}
  <g stroke="#283b36" strokeWidth="1.5"><path d="M240 240H360V360H240Z" fill="#fffdf7"/><path d="M240 240L300 300L240 360Z" fill={PALETTE.red}/><path d="M240 240L360 240L300 300Z" fill={PALETTE.green}/><path d="M360 240L360 360L300 300Z" fill={PALETTE.yellow}/><path d="M240 360L360 360L300 300Z" fill={PALETTE.blue}/></g>
  {COLORS.map(color=>{const base=BASES[color];const player=players.find(player=>player.color===color);const playerName=player?.name||COLOR_NAMES[color];const nameSize=playerName.length>16?8.5:playerName.length>11?9.5:11;const progress=player?Math.round(player.tokens.reduce((sum,token)=>sum+Math.max(0,Math.min(56,token.progress)),0)/(player.tokens.length*56)*100):0;return <g key={color}>
   <text x={base.x*40+120} y={base.y*40+20} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize={nameSize} fontWeight="700" letterSpacing="0" fill="#fff">{playerName}{player?.rank?` · ${player.rank===1?"1st":player.rank===2?"2nd":player.rank===3?"3rd":player.rank+"th"}`:""}</text>
   {player&&<g><rect x={base.x*40+59} y={base.y*40+25} width="122" height="18" rx="9" fill="#17372d" fillOpacity=".9" stroke="#f4d28a" strokeWidth="1"/><rect x={base.x*40+64} y={base.y*40+39} width="112" height="2.5" rx="1.25" fill="#ffffff55"/><rect x={base.x*40+64} y={base.y*40+39} width={112*progress/100} height="2.5" rx="1.25" fill="#f4d28a"/><text x={base.x*40+120} y={base.y*40+36.5} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="10" fontWeight="900" letterSpacing=".6" fill="#fff8e8">PROGRESS  {progress}%</text></g>}
   {players[turn]?.color===color&&<g pointerEvents="none">
    <rect x={base.x*40+7} y={base.y*40+7} width="226" height="226" rx="12" fill="none" stroke="#f4d28a" strokeWidth="5"/>
    <rect x={base.x*40+82} y={base.y*40+210} width="76" height="19" rx="9.5" fill="#f4d28a"/>
    <text x={base.x*40+120} y={base.y*40+223.5} textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9" fontWeight="800" letterSpacing=".8" fill="#26372f">CURRENT TURN</text>
   </g>}
  </g>})}
  {pieces.map(piece=>{
   const [x,y]=piece.pos;
   const stacked=pieces.filter(other=>other.pos[0]===x&&other.pos[1]===y);
   const stackIndex=stacked.findIndex(other=>other.playerIndex===piece.playerIndex&&other.tokenIndex===piece.tokenIndex);
   const dx=stacked.length>1?(stackIndex%2)*12-6:0,dy=stacked.length>1?Math.floor(stackIndex/2)*12-6:0;
   const selectable=piece.playerIndex===turn&&choices.includes(piece.tokenIndex);
   const inHome=piece.player.tokens[piece.tokenIndex].progress===-1;
   const tokenOffset=inHome&&!piece.animating?0:20;
   return <g key={piece.player.color+piece.tokenIndex} className={"token-piece"+(piece.animating?" token-moving":"")+(selectable?" token-selectable":"")} transform={`translate(${x*40+tokenOffset+dx},${y*40+tokenOffset+dy})`} onClick={()=>selectable&&onMove(piece.tokenIndex)} onKeyDown={event=>{if(selectable&&(event.key==="Enter"||event.key===" ")){event.preventDefault();onMove(piece.tokenIndex)}}} tabIndex={selectable?0:-1} role={selectable?"button":undefined} aria-label={selectable?`Move ${piece.player.color} token ${piece.tokenIndex+1}`:undefined} style={{cursor:selectable?"pointer":"default"}}>
    <ellipse cy="9" rx="13.5" ry="5.5" fill="#14231d" opacity=".42"/>
    <g filter="url(#token3dShadow)">
     <path d="M-13 1 C-13 5 -8 8 0 8 C8 8 13 5 13 1 L11 -3 L-11 -3 Z" fill="#493b2d" opacity=".72"/>
     <ellipse cy="0" rx="13" ry="5.5" fill={PALETTE[piece.player.color]} stroke="#6c5740" strokeWidth="1"/>
     <path d="M-10 0 C-10 -7 -7 -13 -6 -18 C-5 -23 -4 -27 0 -28 C4 -27 5 -23 6 -18 C7 -13 10 -7 10 0 C7 3 -7 3 -10 0Z" fill={PALETTE[piece.player.color]} stroke="#604b37" strokeWidth="1.1"/>
     <path d="M-7 -4 C-6 -12 -4 -18 -3 -22 C-2 -25 0 -26 2 -25 C-1 -17 -1 -8 0 -3Z" fill="#ffffff" opacity=".16"/>
     <ellipse cy="-25" rx="7.8" ry="7.2" fill={`url(#token${piece.player.color[0].toUpperCase()+piece.player.color.slice(1)})`} stroke="#fff5df" strokeWidth="1.5"/>
     <ellipse cx="-2.8" cy="-28" rx="3.1" ry="1.7" transform="rotate(-22 -2.8 -28)" fill="#fff" opacity=".65"/>
     <text y="-9" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff" stroke="#24352d" strokeOpacity=".35" strokeWidth=".8">{piece.tokenIndex+1}</text>
     <path d="M-8 -1 Q0 2 8 -1" fill="none" stroke="#ffffff66" strokeWidth="1" strokeLinecap="round"/>
    </g>
    {selectable&&<circle r="18" fill="none" stroke="#bd9654" strokeWidth="2" strokeDasharray="3 3"/>}
   </g>;
  })}
  {(()=>{const color=players[turn]?.color;if(!color)return null;const base=BASES[color];return <g
   className={`home-dice ${canRoll?"is-clickable":""} ${rolling?"is-rolling":""}`}
   transform={`translate(${base.x*40+(color==="red"||color==="blue"?210:30)},${base.y*40+(color==="red"||color==="green"?210:30)})`}
   role={canRoll?"button":undefined} tabIndex={canRoll?0:undefined}
   aria-label={canRoll?"Click to roll dice":"Dice shows "+displayValue}
   onClick={canRoll?onRoll:undefined}
   onKeyDown={canRoll?(event:any)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onRoll();}}:undefined}>
   <g filter="url(#homeDiceShadow)" className="dice-cube">
    <path d="M-34 -25 L-20 -41 Q-19 -43 -16 -43 L36 -43 Q40 -43 40 -39 L25 -25 Z" fill="#fffdf5" stroke="#9d9586" strokeWidth="1.5"/>
    <path d="M25 -25 L40 -39 L40 16 Q40 19 37 22 L25 34 Z" fill="#77796f" stroke="#625f55" strokeWidth="1.5"/>
    <path d="M-34 -25 Q-34 -29 -30 -29 L21 -29 Q25 -29 25 -25 L25 30 Q25 34 21 34 L-30 34 Q-34 34 -34 30 Z" fill="url(#homeDiceFace)" stroke={canRoll?"#244a3e":"#887d69"} strokeWidth={canRoll?"2.8":"2"}/>
    <path d="M-28 -22 Q-28 -24 -25 -24 L16 -24 Q19 -24 19 -21 L19 25 Q19 28 16 28 L-25 28 Q-28 28 -28 25 Z" fill="none" stroke="#ffffff" strokeOpacity=".95" strokeWidth="1.5"/>
    <path d="M-25 -26 L16 -26" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".9"/>
    <path d="M-27 29 Q-2 33 19 28" fill="none" stroke="#bdb5a5" strokeWidth="1.4" opacity=".75"/>
    <path d="M27 -21 L36 -30 L36 13 L27 22 Z" fill="#ffffff" opacity=".13"/>
   </g>
   {rolling?<text x="-4" y="4" textAnchor="middle" dominantBaseline="central" fontSize="35" fontWeight="800" fill="#244a3e">…</text>:<>
    {faceDots(faceLayout[displayValue].top).map(([nx,ny],dot)=><g key={"top"+dot}><ellipse cx={5+nx*14+ny*4} cy={-34+ny*4.5} rx="3.4" ry="2.1" fill="#142b22" opacity=".25"/><ellipse cx={5+nx*14+ny*4} cy={-34+ny*4.5} rx="2.9" ry="1.8" fill="#183c30"/><ellipse cx={4+nx*14+ny*4} cy={-35+ny*4.5} rx="1" ry=".65" fill="#ffffff" opacity=".32"/></g>)}
    {faceDots(faceLayout[displayValue].side).map(([nx,ny],dot)=><g key={"side"+dot}><ellipse cx={33+nx*3.1-ny*4.2} cy={-4+ny*17} rx="2.2" ry="3.2" fill="#17271f" opacity=".3"/><ellipse cx={33+nx*3.1-ny*4.2} cy={-4+ny*17} rx="1.8" ry="2.8" fill="#183c30"/><ellipse cx={32.5+nx*3.1-ny*4.2} cy={-5+ny*17} rx=".65" ry="1.1" fill="#ffffff" opacity=".3"/></g>)}
    {DICE_DOTS[displayValue].map(([dx,dy],dot)=><g key={"front"+dot} transform="translate(-4 4)"><ellipse cx={dx} cy={dy+1.8} rx="6.9" ry="6.3" fill="#0d281f" opacity=".18"/><circle cx={dx} cy={dy} r="6.7" fill="url(#homeDicePip)"/><ellipse cx={dx-2} cy={dy-2.2} rx="1.7" ry="1.2" fill="#ffffff" opacity=".3"/></g>)}
   </>}
  </g>;})()}
 </svg>;
}