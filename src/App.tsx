import {useEffect,useRef,useState} from "react";
import {BASES,BASE_SPOTS,COLORS,COLOR_NAMES,HOME_LANES,PALETTE,SAFE,START,TRACK,chooseAiToken,legalTokens,moveToken,tokenPosition,winner,type Color,type Player} from "./game";
type Mode="local"|"ai";
function createPlayers(count:number,mode:Mode):Player[]{
 const colors:Color[]=count===2?["red","yellow"]:count===3?["red","green","yellow"]:COLORS;
 return colors.map((color,index)=>({color,name:mode==="ai"&&index>0?"Computer":COLOR_NAMES[color],ai:mode==="ai"&&index>0,tokens:Array.from({length:4},()=>({progress:-1}))}));
}
function Dice({value,rolling}:{value:number|null;rolling:boolean}){
 const faces:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
 return <div className={"dice-face"+(rolling?" rolling":"")} aria-label={rolling?"Dice rolling":value? "Dice shows "+value:"Dice ready"}>
  {rolling?<span className="dice-rolling">…</span>:value?Array.from({length:9},(_,i)=><i key={i} className={faces[value].includes(i)?"pip visible":"pip"}/>):<span className="dice-ready">⚄</span>}
 </div>;
}
function Board({players,turn,choices,onMove}:{players:Player[];turn:number;choices:number[];onMove:(i:number)=>void}){
 const pieces=players.flatMap((player,playerIndex)=>player.tokens.map((token,tokenIndex)=>({player,playerIndex,tokenIndex,pos:tokenPosition(player.color,token,tokenIndex)})));
 return <svg className="board-svg" viewBox="0 0 600 600" role="img" aria-label="Classic Ludo board">
  <rect width="600" height="600" fill="#fffdf7"/>
  {COLORS.map(color=>{const base=BASES[color];return <g key={color}>
   <rect x={base.x*40} y={base.y*40} width="240" height="240" fill={PALETTE[color]} stroke="#283b36" strokeWidth="2"/>
   <rect x={base.x*40+34} y={base.y*40+34} width="172" height="172" rx="9" fill="#fffdf7" stroke="#fff" strokeWidth="5"/>
   {BASE_SPOTS[color].map(([x,y],index)=><circle key={index} cx={x*40} cy={y*40} r="25" fill={PALETTE[color]} stroke="#d7d2c5" strokeWidth="3"/>)}
  </g>})}
  {TRACK.map(([x,y],index)=><g key={index}>
   <rect x={x*40} y={y*40} width="40" height="40" fill={SAFE.has(index)?"#f2e8cb":"#fffdf7"} stroke="#b8b9af" strokeWidth="1.2"/>
   {SAFE.has(index)&&<text x={x*40+20} y={y*40+26} textAnchor="middle" fontSize="18" fill="#a18a56">✦</text>}
   {Object.entries(START).some(([,start])=>start===index)&&<rect x={x*40+3} y={y*40+3} width="34" height="34" fill={PALETTE[Object.keys(START).find(key=>START[key as Color]===index) as Color]} opacity=".9"/>}
  </g>)}
  {Object.entries(HOME_LANES).map(([color,cells])=>cells.map(([x,y],index)=><rect key={color+index} x={x*40} y={y*40} width="40" height="40" fill={PALETTE[color as Color]} stroke="#b8b9af" strokeWidth="1.2"/>))}
  <g stroke="#283b36" strokeWidth="1.5"><path d="M240 240H360V360H240Z" fill="#fffdf7"/><path d="M240 240L300 300L240 360Z" fill={PALETTE.red}/><path d="M240 240L360 240L300 300Z" fill={PALETTE.green}/><path d="M360 240L360 360L300 300Z" fill={PALETTE.yellow}/><path d="M240 360L360 360L300 300Z" fill={PALETTE.blue}/></g>
  {COLORS.map(color=>{const base=BASES[color];return <text key={color} x={base.x*40+120} y={base.y*40+22} textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="2" fill="#fff">{COLOR_NAMES[color].toUpperCase()}</text>})}
  {pieces.map(piece=>{
   const [x,y]=piece.pos;
   const stacked=pieces.filter(other=>other.pos[0]===x&&other.pos[1]===y);
   const stackIndex=stacked.findIndex(other=>other.playerIndex===piece.playerIndex&&other.tokenIndex===piece.tokenIndex);
   const dx=stacked.length>1?(stackIndex%2)*12-6:0,dy=stacked.length>1?Math.floor(stackIndex/2)*12-6:0;
   const selectable=piece.playerIndex===turn&&choices.includes(piece.tokenIndex);
   return <g key={piece.player.color+piece.tokenIndex} className={"token-piece"+(selectable?" token-selectable":"")} transform={`translate(${x*40+20+dx},${y*40+20+dy})`} onClick={()=>selectable&&onMove(piece.tokenIndex)} onKeyDown={event=>{if(selectable&&(event.key==="Enter"||event.key===" ")){event.preventDefault();onMove(piece.tokenIndex)}}} tabIndex={selectable?0:-1} role={selectable?"button":undefined} aria-label={selectable?`Move ${piece.player.color} token ${piece.tokenIndex+1}`:undefined} style={{cursor:selectable?"pointer":"default"}}>
    <circle r="14" fill={PALETTE[piece.player.color]} stroke="#fff" strokeWidth="3"/><circle r="9" fill="none" stroke="#ffffff99"/><text y="3.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">{piece.tokenIndex+1}</text>
    {selectable&&<circle r="18" fill="none" stroke="#bd9654" strokeWidth="2" strokeDasharray="3 3"/>}
   </g>;
  })}
 </svg>;
}
export default function App(){
 const [mode,setMode]=useState<Mode>("local"),[count,setCount]=useState(2),[players,setPlayers]=useState<Player[]>([]),[turn,setTurn]=useState(0);
 const [dice,setDice]=useState<number|null>(null),[choices,setChoices]=useState<number[]>([]),[message,setMessage]=useState("Roll the dice to begin.");
 const [started,setStarted]=useState(false),[champion,setChampion]=useState<string|null>(null),[busy,setBusy]=useState(false),[passPending,setPassPending]=useState(false),[soundEnabled,setSoundEnabled]=useState(true);
 const rollTimer=useRef<number|undefined>(undefined),passTimer=useRef<number|undefined>(undefined),aiTimer=useRef<number|undefined>(undefined);
 const audioContext=useRef<AudioContext|null>(null);
 const playSound=(kind:"roll"|"move"|"capture"|"win")=>{
  if(!soundEnabled||typeof window==="undefined")return;
  try{
   const AudioContextClass=window.AudioContext;
   if(!AudioContextClass)return;
   const ctx=audioContext.current??(audioContext.current=new AudioContextClass());
   if(ctx.state==="suspended")void ctx.resume();
   const now=ctx.currentTime;
   const tones=kind==="roll"?[{f:220,d:.07},{f:330,d:.07},{f:440,d:.09}]:kind==="capture"?[{f:520,d:.09},{f:740,d:.13}]:kind==="win"?[{f:392,d:.12},{f:494,d:.12},{f:587,d:.12},{f:784,d:.24}]:[{f:440,d:.08},{f:587,d:.1}];
   let offset=0;
   for(const tone of tones){
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=kind==="roll"?"triangle":"sine";osc.frequency.setValueAtTime(tone.f,now+offset);
    gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(kind==="roll"?.045:.065,now+offset+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+tone.d);
    osc.connect(gain);gain.connect(ctx.destination);osc.start(now+offset);osc.stop(now+offset+tone.d+.015);offset+=tone.d+.018;
   }
  }catch{/* Audio is optional; gameplay must never depend on it. */}
 };
 const current=players[turn];
 const clearTimers=()=>{if(rollTimer.current!==undefined)window.clearTimeout(rollTimer.current);if(passTimer.current!==undefined)window.clearTimeout(passTimer.current);if(aiTimer.current!==undefined)window.clearTimeout(aiTimer.current);};
 const resetGame=()=>{clearTimers();setPlayers(createPlayers(count,mode));setTurn(0);setDice(null);setChoices([]);setMessage("Roll the dice to begin.");setChampion(null);setBusy(false);setPassPending(false);setStarted(true);};
 const backToSetup=()=>{clearTimers();setStarted(false);setBusy(false);setPassPending(false);setDice(null);setChoices([]);};
 const nextTurn=()=>{clearTimers();setTurn(value=>(value+1)%players.length);setDice(null);setChoices([]);setBusy(false);setPassPending(false);};
 const rollDice=()=>{
  if(!started||!current||dice!==null||busy||champion||passPending)return;
  setBusy(true);
  playSound("roll");
  const rolled=Math.floor(Math.random()*6)+1;
  rollTimer.current=window.setTimeout(()=>{
   setBusy(false);
   const legal=legalTokens(current,rolled,players);
   if(legal.length===0){
    setDice(null);setChoices([]);
    if(rolled===6){setMessage("Six! No token can move. Roll again.");}
    else{setMessage("No legal move. Turn passes to the next player.");setPassPending(true);passTimer.current=window.setTimeout(()=>nextTurn(),1100);}
    return;
   }
   setDice(rolled);setChoices(legal);
   setMessage(rolled===6?"Six! Choose a token to move.":"Choose one of the highlighted tokens.");
  },450);
 };
 const moveSelected=(tokenIndex:number)=>{
  if(dice===null||!choices.includes(tokenIndex)||!current||champion)return;
  const rolled=dice;
  const result=moveToken(players,turn,tokenIndex,rolled);
  if(result.players===players)return;
  setPlayers(result.players);
  playSound(result.captured>0?"capture":"move");
  if(winner(result.players[turn])){
   playSound("win");
   clearTimers();setChampion(current.name);setMessage(current.name+" wins the game!");setDice(null);setChoices([]);return;
  }
  if(rolled===6||result.captured>0){
   setDice(null);setChoices([]);
   setMessage(result.captured>0?`Captured ${result.captured} opponent token${result.captured>1?"s":""}! You get another turn.`:"Six! You get another turn.");
   return;
  }
  nextTurn();
 };
 useEffect(()=>{
  if(!started||!current?.ai||champion||busy||passPending)return;
  aiTimer.current=window.setTimeout(()=>{
   if(dice===null)rollDice();
   else if(choices.length)moveSelected(chooseAiToken(players,turn,dice,choices));
  },850);
  return()=>{if(aiTimer.current!==undefined)window.clearTimeout(aiTimer.current)};
 },[started,current?.ai,turn,dice,choices,busy,champion,passPending,players]);
 useEffect(()=>()=>clearTimers(),[]);
 const currentColor=current?PALETTE[current.color]:"#fff";
 return <main className="app-shell">
  <header className="topbar"><div className="brand"><div className="brand-mark">M</div><div><strong>MISHAD'S LUDO</strong><small>THE CLASSIC. YOUR WAY.</small></div></div><span className="edition">A MISHAD ORIGINAL</span></header>
  {!started?<section className="setup-wrap">
   <div className="hero"><span className="eyebrow">A timeless game, made for good company</span><h1>Gather around.<br/><em>Let’s play.</em></h1><p>Bring everyone together for a classic game of Ludo.</p></div>
   <div className="setup-card"><span className="step">01 / GAME SETUP</span><h2>Choose how you want to play</h2>
    <div className="mode-grid">
     <button className={"mode-card "+(mode==="local"?"selected":"")} onClick={()=>setMode("local")}><span className="mode-icon">♟</span><span><b>Local Player</b><small>Pass one device between players</small></span></button>
     <button className={"mode-card "+(mode==="ai"?"selected":"")} onClick={()=>setMode("ai")}><span className="mode-icon">✦</span><span><b>AI Player</b><small>Play against computer opponents</small></span></button>
     <button className="mode-card coming-soon" disabled><span className="mode-icon">◎</span><span><b>Online Player</b><small>Online rooms are being built</small></span></button>
    </div>
    <label className="field-label">NUMBER OF PLAYERS</label><div className="player-count">{[2,3,4].map(number=><button key={number} className={count===number?"selected":""} onClick={()=>setCount(number)}>{number} Players</button>)}</div>
    <button className="primary-btn" onClick={resetGame}>START NEW GAME <span>→</span></button><p className="footnote">Free to play · No account needed · Made by Mishad</p>
   </div>
  </section>:<section className="play-wrap">
   <div className="game-heading"><button className="back-btn" onClick={backToSetup}>← Setup</button><div className="turn-label"><i style={{background:currentColor}}/>{champion?champion+" wins":(current?.name??"Player")+"'s turn"}</div><button className="back-btn" onClick={resetGame}>↻ Restart</button></div>
   <div className="game-layout"><div className="board-frame"><Board players={players} turn={turn} choices={choices} onMove={moveSelected}/></div>
    <aside className="game-side"><span className="step">{champion?"GAME FINISHED":current?.ai?"COMPUTER TURN":"YOUR MOVE"}</span>
     <div className="game-controls"><Dice value={dice} rolling={busy}/><button type="button" className="sound-toggle" aria-pressed={soundEnabled} onClick={()=>setSoundEnabled(value=>!value)}>{soundEnabled?"🔊 Sound On":"🔇 Sound Off"}</button></div>
     <button className="roll-btn" onClick={rollDice} disabled={dice!==null||busy||!!champion||passPending||!!current?.ai}>{busy?"ROLLING…":passPending?"PASSING TURN":current?.ai?"COMPUTER PLAYING":"ROLL DICE"}</button>
     <p className="game-message" aria-live="polite">{message}</p>
     <div className="score-list">{players.map((player,index)=><div key={player.color} className={"score-row "+(index===turn?"is-turn":"")}><i style={{background:PALETTE[player.color]}}/><span>{player.name}{player.ai?" · AI":""}</span><small>{player.tokens.filter(token=>token.progress===56).length}/4 finished</small></div>)}</div>
     <p className="rule-note">A six brings a token out. Landing on an opponent sends it home. Safe squares protect tokens. You need an exact roll to finish.</p>
     {champion&&<button className="primary-btn replay-btn" onClick={resetGame}>PLAY AGAIN</button>}
    </aside>
   </div>
  </section>}
  <footer>© {new Date().getFullYear()} Mishad's Ludo <span>·</span> MISHAD EDITION</footer>
 </main>;
}
