import {useEffect,useRef,useState} from "react";
import {BASES,BASE_SPOTS,COLORS,COLOR_NAMES,HOME_LANES,PALETTE,SAFE,START,TRACK,chooseAiToken,legalTokens,moveToken,tokenPosition,winner,type Color,type Player} from "./game";
import {supabase} from "./supabase";
type Mode="local"|"ai"|"online";
type MatchRecord={id:number;date:string;mode:Mode;players:string[];winner:string};
function createPlayers(count:number,mode:Mode,names:string[]):Player[]{
 const colors:Color[]=count===2?["red","yellow"]:count===3?["red","green","yellow"]:COLORS;
 return colors.map((color,index)=>({color,name:mode==="ai"&&index>0?"Computer":(names[index]?.trim()||"Player "+(index+1)),ai:mode==="ai"&&index>0,tokens:Array.from({length:4},()=>({progress:-1}))}));
}
const DICE_DOTS:Record<number,[number,number][]>={
  1:[[0,0]],2:[[-8,-8],[8,8]],3:[[-8,-8],[0,0],[8,8]],
  4:[[-8,-8],[8,-8],[-8,8],[8,8]],5:[[-8,-8],[8,-8],[0,0],[-8,8],[8,8]],
  6:[[-8,-8],[8,-8],[-8,0],[8,0],[-8,8],[8,8]]
};
function Board({players,turn,choices,dice,rolling,canRoll,onRoll,onMove}:{players:Player[];turn:number;choices:number[];dice:number|null;rolling:boolean;canRoll:boolean;onRoll:()=>void;onMove:(i:number)=>void}){
 const pieces=players.flatMap((player,playerIndex)=>player.tokens.map((token,tokenIndex)=>({player,playerIndex,tokenIndex,pos:tokenPosition(player.color,token,tokenIndex)})));
 return <svg className="board-svg" viewBox="0 0 600 600" role="img" aria-label="Classic Ludo board">
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
  {COLORS.map(color=>{const base=BASES[color];const active=players[turn]?.color===color;return <g key={color}>
   <text x={base.x*40+120} y={base.y*40+23} textAnchor="middle" fontSize="7.2" fontWeight="700" letterSpacing=".35" textLength="148" lengthAdjust="spacingAndGlyphs" fill="#fff">{players.find(player=>player.color===color)?.name||COLOR_NAMES[color].toUpperCase()}</text>
   {active&&<g
    className={`home-dice ${canRoll?"is-clickable":""} ${rolling?"is-rolling":""}`}
    transform={`translate(${base.x*40+120},${base.y*40+120})`}
    role={canRoll?"button":undefined}
    tabIndex={canRoll?0:undefined}
    aria-label={canRoll?"Click to roll dice":dice===null?"Waiting for dice roll":"Dice shows "+dice}
    onClick={canRoll?onRoll:undefined}
    onKeyDown={canRoll?(event:any)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onRoll();}}:undefined}
   >
    <rect x="-17" y="-17" width="34" height="34" rx="7" fill="#fffdf7" stroke={canRoll?"#244a3e":"#806d4d"} strokeWidth={canRoll?"2":"1.5"}/>
    {rolling?<text textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight="800" fill="#244a3e">…</text>:dice===null?<text textAnchor="middle" dominantBaseline="central" fontSize="20" fill="#244a3e">⚄</text>:DICE_DOTS[dice].map(([dx,dy],dot)=><circle key={dot} cx={dx} cy={dy} r="2.8" fill="#244a3e"/>)}
   </g>}
  </g>})}
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
function OnlinePanel({name,setName,code,setCode,activeCode,players,onlineIndex,onlinePlayers,presenceReady,error,busy,onCreate,onJoin,onStart,onBack}:{name:string;setName:(v:string)=>void;code:string;setCode:(v:string)=>void;activeCode:string|null;players:Player[];onlineIndex:number;onlinePlayers:number[];presenceReady:boolean;error:string;busy:boolean;onCreate:()=>void;onJoin:()=>void;onStart:()=>void;onBack:()=>void}){
 return <div className="online-card"><button className="back-btn online-back" onClick={onBack}>← Game modes</button><span className="step">ONLINE MULTIPLAYER</span><h2>{activeCode?"Your room is ready":"Play with friends online"}</h2>
 <label className="field-label">YOUR PLAYER NAME</label><input className="online-input" value={name} maxLength={20} onChange={e=>setName(e.target.value)} placeholder="Enter your name"/>
 {!activeCode?<><div className="online-actions"><button className="primary-btn" disabled={busy||!name.trim()} onClick={onCreate}>{busy?"CREATING…":"CREATE ROOM"}</button><div className="online-join"><label className="field-label">JOIN WITH ROOM CODE</label><input className="online-input room-code-input" value={code} maxLength={6} inputMode="numeric" onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit code"/><button className="secondary-btn" disabled={busy||!name.trim()||code.length!==6} onClick={onJoin}>JOIN ROOM →</button></div></div></>:<><div className="room-code-display"><span>ROOM CODE</span><strong>{activeCode}</strong><button className="secondary-btn" onClick={()=>void navigator.clipboard?.writeText(activeCode)}>COPY CODE</button></div><div className="room-player-list"><b>PLAYERS IN ROOM</b>{players.map((p,i)=><div className="room-player" key={p.color}><i style={{background:PALETTE[p.color]}}/>{p.name}{i===onlineIndex?" (You)":""}{i===0?" · Host":""}<small className={"presence-status "+(onlinePlayers.includes(i)?"is-online":"is-offline")}>{presenceReady?(onlinePlayers.includes(i)?"Connected":"Disconnected"):"Checking…"}</small></div>)}</div>{onlineIndex===0?<button className="primary-btn" disabled={players.length<2||busy} onClick={onStart}>{players.length<2?"WAITING FOR PLAYER…":"START ONLINE GAME →"}</button>:<p className="online-waiting">Waiting for the host to start the game…</p>}</>}
 {error&&<p className="online-error" role="alert">{error}</p>}<p className="footnote">Room codes are random 6-digit numbers. Share yours only with friends.</p></div>;
}

type ChatMessage={id:number;player_index:number;player_name:string;message:string;created_at:string};
function RoomChat({roomCode,playerIndex}:{roomCode:string;playerIndex:number}){
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [draft,setDraft]=useState("");
 const [open,setOpen]=useState(true);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState("");
 const refresh=async()=>{
  const {data,error}=await supabase.rpc("ludo_chat_list",{p_code:roomCode,p_token:getOnlineToken()});
  if(error){setError(error.message);return;}
  setMessages((data||[]).slice().reverse() as ChatMessage[]);
 };
 useEffect(()=>{
  void refresh();
  const timer=window.setInterval(()=>void refresh(),2500);
  return()=>window.clearInterval(timer);
 },[roomCode]);
 const send=async()=>{
  const message=draft.trim();if(!message||sending)return;
  setSending(true);setError("");
  const {error}=await supabase.rpc("ludo_chat_send",{p_code:roomCode,p_token:getOnlineToken(),p_message:message});
  if(error)setError(error.message);else{setDraft("");await refresh();}
  setSending(false);
 };
 return <section className="room-chat">
  <button type="button" className="chat-toggle" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>
   <span>CHAT</span><b>{open?"−":"＋"}</b>
  </button>
  {open&&<div className="chat-content">
   <div className="chat-messages" aria-live="polite">{messages.length===0?<p className="chat-empty">No messages yet. Say hello! 👋</p>:messages.map(item=><div className={"chat-message "+(item.player_index===playerIndex?"mine":"")} key={item.id}>
    <small>{item.player_index===playerIndex?"You":item.player_name}</small><p>{item.message}</p><time>{new Date(item.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time>
   </div>)}</div>
   <div className="chat-compose"><input value={draft} maxLength={300} placeholder="Write a message…" onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void send();}}/><button type="button" disabled={!draft.trim()||sending} onClick={()=>void send()}>{sending?"…":"SEND"}</button></div>
   {error&&<p className="chat-error">{error}</p>}
   <p className="chat-note">Temporary chat · Cleared when everyone leaves the room.</p>
  </div>}
 </section>;
}

function getOnlineToken(){let token=localStorage.getItem("mishads-ludo-player-token");if(!token){token=crypto.randomUUID();localStorage.setItem("mishads-ludo-player-token",token);}return token;}
function getSavedOnlineSession():{roomCode:string;playerIndex:number;name:string}|null{
 try{const raw=localStorage.getItem("mishads-ludo-online-session");if(!raw)return null;const value=JSON.parse(raw);if(typeof value.roomCode==="string"&&/^\d{6}$/.test(value.roomCode)&&Number.isInteger(value.playerIndex)&&value.playerIndex>=0&&value.playerIndex<4)return {roomCode:value.roomCode,playerIndex:value.playerIndex,name:typeof value.name==="string"?value.name:""};}catch{/* Ignore invalid saved room data. */}
 return null;
}

export default function App(){
 const [mode,setMode]=useState<Mode>(()=>getSavedOnlineSession()?"online":"local"),[count,setCount]=useState(2),[players,setPlayers]=useState<Player[]>([]),[turn,setTurn]=useState(0);
 const [onlineName,setOnlineName]=useState(()=>getSavedOnlineSession()?.name||""),[joinCode,setJoinCode]=useState(""),[activeRoomCode,setActiveRoomCode]=useState<string|null>(()=>getSavedOnlineSession()?.roomCode||null),[onlineIndex,setOnlineIndex]=useState(()=>getSavedOnlineSession()?.playerIndex||0),[onlineError,setOnlineError]=useState(""),[onlineBusy,setOnlineBusy]=useState(false),[reconnectKey,setReconnectKey]=useState(0);const [onlinePlayers,setOnlinePlayers]=useState<number[]>([]),[presenceReady,setPresenceReady]=useState(false),[resetRequest,setResetRequest]=useState<any>(null);const roomChannelRef=useRef<any>(null);
 const [theme,setTheme]=useState<"light"|"dark">(()=>{try{return localStorage.getItem("mishads-ludo-theme")==="dark"?"dark":"light";}catch{return "light";}});
 const [playerNames,setPlayerNames]=useState(["Player 1","Player 2","Player 3","Player 4"]);
 const [matchHistory,setMatchHistory]=useState<MatchRecord[]>(()=>{
  try{return JSON.parse(localStorage.getItem("mishads-ludo-history")||"[]") as MatchRecord[];}catch{return [];}
 });
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
 const applyOnlineState=(state:any)=>{if(!state)return;const nextPlayers=state.players||[];const nextTurn=Number(state.turn||0);const nextDice=state.dice??null;setPlayers(nextPlayers);setTurn(nextTurn);setDice(nextDice);setChoices(state.choices?.length?state.choices:(nextDice!==null&&nextPlayers[nextTurn]?legalTokens(nextPlayers[nextTurn],Number(nextDice),nextPlayers):[]));setMessage(state.message||"Online match");setChampion(state.champion??null);setStarted(!!state.started);setResetRequest(state.resetRequest??null);setBusy(false);setPassPending(false);};
 const syncOnlineState=async(state:any)=>{if(mode!=="online"||!activeRoomCode)return;const {error}=await supabase.rpc("ludo_update_state",{p_code:activeRoomCode,p_token:getOnlineToken(),p_state:state});if(error){setOnlineError(error.message);return;}applyOnlineState(state);};
 const createOnlineRoom=async()=>{setOnlineBusy(true);setOnlineError("");try{const {data,error}=await supabase.rpc("ludo_create_room",{p_name:onlineName.trim(),p_token:getOnlineToken()});if(error)throw error;const row=Array.isArray(data)?data[0]:data;setActiveRoomCode(row.room_code);setOnlineIndex(0);localStorage.setItem("mishads-ludo-online-session",JSON.stringify({roomCode:row.room_code,playerIndex:0,name:onlineName.trim()}));applyOnlineState(row.room_state);}catch(e){setOnlineError(e instanceof Error?e.message:"Could not create room");}finally{setOnlineBusy(false);}};
 const joinOnlineRoom=async()=>{setOnlineBusy(true);setOnlineError("");try{const {data,error}=await supabase.rpc("ludo_join_room",{p_code:joinCode,p_name:onlineName.trim(),p_token:getOnlineToken()});if(error)throw error;const row=Array.isArray(data)?data[0]:data;setActiveRoomCode(row.room_code);setOnlineIndex(row.your_index);localStorage.setItem("mishads-ludo-online-session",JSON.stringify({roomCode:row.room_code,playerIndex:row.your_index,name:onlineName.trim()}));applyOnlineState(row.room_state);}catch(e){setOnlineError(e instanceof Error?e.message:"Could not join room");}finally{setOnlineBusy(false);}};
 const startOnlineRoom=async()=>{if(!activeRoomCode)return;setOnlineBusy(true);setOnlineError("");const {data,error}=await supabase.rpc("ludo_start_room",{p_code:activeRoomCode,p_token:getOnlineToken()});if(error)setOnlineError(error.message);else applyOnlineState(data);setOnlineBusy(false);};
 const requestOnlineReset=async()=>{
  if(!activeRoomCode||onlineIndex!==0||resetRequest?.status==="pending"||onlineBusy)return;
  setOnlineBusy(true);setOnlineError("");
  const {data,error}=await supabase.rpc("ludo_request_reset",{p_code:activeRoomCode,p_token:getOnlineToken()});
  if(error)setOnlineError(error.message);else applyOnlineState(data);
  setOnlineBusy(false);
 };
 const respondOnlineReset=async(accept:boolean)=>{
  if(!activeRoomCode||!resetRequest?.id||resetRequest.status!=="pending"||onlineBusy)return;
  setOnlineBusy(true);setOnlineError("");
  const {data,error}=await supabase.rpc("ludo_respond_reset",{p_code:activeRoomCode,p_token:getOnlineToken(),p_request_id:resetRequest.id,p_accept:accept});
  if(error)setOnlineError(error.message);else applyOnlineState(data);
  setOnlineBusy(false);
 };
 useEffect(()=>{
  if(!resetRequest||resetRequest.status!=="pending")return;
  const delay=Math.max(0,Number(resetRequest.expiresAt)-Date.now());
  const timer=window.setTimeout(()=>setResetRequest((current:any)=>current?.id===resetRequest.id?{...current,status:"expired"}:current),delay);
  return()=>window.clearTimeout(timer);
 },[resetRequest?.id,resetRequest?.status]);

 const clearTimers=()=>{if(rollTimer.current!==undefined)window.clearTimeout(rollTimer.current);if(passTimer.current!==undefined)window.clearTimeout(passTimer.current);if(aiTimer.current!==undefined)window.clearTimeout(aiTimer.current);};
 const resetGame=()=>{clearTimers();setPlayers(createPlayers(count,mode,playerNames));setTurn(0);setDice(null);setChoices([]);setMessage("Roll the dice to begin.");setChampion(null);setBusy(false);setPassPending(false);setStarted(true);};
 const exitOnlineRoom=async()=>{
  if(activeRoomCode&&roomChannelRef.current){
   const channel=roomChannelRef.current;
   try{
    await channel.untrack();
    await new Promise(resolve=>window.setTimeout(resolve,250));
    const remaining=Object.values(channel.presenceState() as Record<string,unknown[]>).flat().length;
    if(remaining===0)await supabase.rpc("ludo_chat_clear",{p_code:activeRoomCode,p_token:getOnlineToken()});
   }catch{/* Chat cleanup is best-effort if the connection is already gone. */}
  }
  setMode("local");setActiveRoomCode(null);localStorage.removeItem("mishads-ludo-online-session");setOnlineError("");
 };
 const backToSetup=()=>{clearTimers();if(mode==="online")void exitOnlineRoom();setStarted(false);setBusy(false);setPassPending(false);setDice(null);setChoices([]);};
 const nextTurn=(nextPlayers:Player[]=players)=>{clearTimers();const next=(turn+1)%nextPlayers.length;if(mode==="online"){void syncOnlineState({players:nextPlayers,turn:next,dice:null,choices:[],message:"Next player’s turn.",champion:null,started:true});}else{setPlayers(nextPlayers);setTurn(next);setDice(null);setChoices([]);setBusy(false);setPassPending(false);}};
 const rollDice=async()=>{
  if(!started||!current||dice!==null||busy||champion||passPending||resetRequest?.status==="pending")return;
  if(mode==="online"){setBusy(true);const {data,error}=await supabase.rpc("ludo_roll_dice",{p_code:activeRoomCode,p_token:getOnlineToken()});if(error){setOnlineError(error.message);setBusy(false);return;}const rolled=Number(data);const legal=legalTokens(current,rolled,players);setBusy(false);if(!legal.length){if(rolled===6){void syncOnlineState({players,turn,dice:null,choices:[],message:"Six! No token can move. Roll again.",champion:null,started:true});}else{setPassPending(true);void syncOnlineState({players,turn:(turn+1)%players.length,dice:null,choices:[],message:"No legal move. Turn passes.",champion:null,started:true});}return;}setDice(rolled);setChoices(legal);setMessage(rolled===6?"Six! Choose a token to move.":"Choose one of the highlighted tokens.");return;}
  setBusy(true);
  playSound("roll");
  // Use an unbiased cryptographic roll: reject the four excess uint32 values
  // so every face has exactly the same probability.
  const rollBuffer = new Uint32Array(1);
  const rollLimit = 0x100000000 - (0x100000000 % 6);
  let randomValue: number;
  do {
   window.crypto.getRandomValues(rollBuffer);
   randomValue = rollBuffer[0];
  } while (randomValue >= rollLimit);
  const rolled = (randomValue % 6) + 1;
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
  if(dice===null||!choices.includes(tokenIndex)||!current||champion||resetRequest?.status==="pending")return;
  const rolled=dice;
  const result=moveToken(players,turn,tokenIndex,rolled);
  if(result.players===players)return;
  setPlayers(result.players);
  playSound(result.captured>0?"capture":"move");
  if(winner(result.players[turn])){
   playSound("win");
   clearTimers();setChampion(current.name);setMessage(current.name+" wins the game!");setDice(null);setChoices([]);if(mode==="online")void syncOnlineState({players:result.players,turn,dice:null,choices:[],message:current.name+" wins the game!",champion:current.name,started:true});
   setMatchHistory(history=>[{id:Date.now(),date:new Date().toISOString(),mode,players:result.players.map(player=>player.name),winner:current.name},...history].slice(0,50));
   return;
  }
  if(rolled===6||result.captured>0||result.finished){
   const msg=result.finished?"Token reached the centre! You get another turn.":result.captured>0?"Captured "+result.captured+" opponent token"+(result.captured>1?"s":"")+"! You get another turn.":"Six! You get another turn.";setDice(null);setChoices([]);setMessage(msg);if(mode==="online")void syncOnlineState({players:result.players,turn,dice:null,choices:[],message:msg,champion:null,started:true});
   return;
  }
  nextTurn(result.players);
 };
 useEffect(()=>{
  if(!started||mode==="online"||!current?.ai||champion||busy||passPending)return;
  aiTimer.current=window.setTimeout(()=>{
   if(dice===null)rollDice();
   else if(choices.length)moveSelected(chooseAiToken(players,turn,dice,choices));
  },850);
  return()=>{if(aiTimer.current!==undefined)window.clearTimeout(aiTimer.current)};
 },[started,current?.ai,turn,dice,choices,busy,champion,passPending,players]);
 useEffect(()=>()=>clearTimers(),[]);
 useEffect(()=>{
  if(!activeRoomCode||mode!=="online")return;
  let cancelled=false;
  const refreshRoom=async()=>{
   const {data,error}=await supabase.rpc("ludo_get_room",{p_code:activeRoomCode,p_token:getOnlineToken()});
   if(cancelled)return;
   if(error){setOnlineError(error.message);return;}
   const row=Array.isArray(data)?data[0]:data;
   if(row?.room_state)applyOnlineState(row.room_state);
  };
  setPresenceReady(false);
  setOnlinePlayers([]);
  const channel=supabase.channel("ludo-room-"+activeRoomCode+"-"+reconnectKey);roomChannelRef.current=channel;
  channel
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"ludo_rooms",filter:"code=eq."+activeRoomCode},payload=>{
    if(!cancelled)applyOnlineState((payload.new as any).state);
   })
   .on("presence",{event:"sync"},()=>{
    if(cancelled)return;
    const state=channel.presenceState<{playerIndex:number;name:string}>();
    const connected=Object.values(state).flat().map(meta=>meta.playerIndex).filter(index=>Number.isInteger(index));
    setOnlinePlayers(Array.from(new Set(connected)));
    setPresenceReady(true);
   })
   .subscribe(status=>{
    if(status==="SUBSCRIBED"){
     void refreshRoom();
     void channel.track({playerIndex:onlineIndex,name:onlineName.trim(),onlineAt:new Date().toISOString()});
    }
    else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
     setOnlineError("Room connection interrupted. Reconnecting…");
    }
   });
  return()=>{cancelled=true;if(roomChannelRef.current===channel)roomChannelRef.current=null;void supabase.removeChannel(channel);};
 },[activeRoomCode,mode,reconnectKey,onlineIndex,onlineName]);
 useEffect(()=>{
  if(!activeRoomCode||mode!=="online")return;
  const reconnect=()=>{if(document.visibilityState==="visible"&&navigator.onLine){setOnlineError("");setReconnectKey(value=>value+1);}};
  window.addEventListener("online",reconnect);
  window.addEventListener("pageshow",reconnect);
  document.addEventListener("visibilitychange",reconnect);
  return()=>{window.removeEventListener("online",reconnect);window.removeEventListener("pageshow",reconnect);document.removeEventListener("visibilitychange",reconnect);};
 },[activeRoomCode,mode]);
 useEffect(()=>{try{localStorage.setItem("mishads-ludo-history",JSON.stringify(matchHistory));}catch{/* History remains available for this session if storage is unavailable. */}},[matchHistory]);
 useEffect(()=>{try{localStorage.setItem("mishads-ludo-theme",theme);}catch{/* Theme remains available for this session if storage is unavailable. */}},[theme]);
 const playerStats=matchHistory.reduce<Record<string,{played:number;won:number}>>((stats,match)=>{
  for(const name of match.players){stats[name]??={played:0,won:0};stats[name].played+=1;if(name===match.winner)stats[name].won+=1;}
  return stats;
 },{});
 const rankedStats=Object.entries(playerStats).sort((a,b)=>b[1].won-a[1].won||b[1].played-a[1].played);
 const currentColor=current?PALETTE[current.color]:"#fff";
 return <main className="app-shell" data-theme={theme}>
  <header className="topbar"><div className="brand"><div className="brand-mark">M</div><div><strong>MISHAD'S LUDO</strong><small>THE CLASSIC. YOUR WAY.</small></div></div><div className="header-actions"><button className="theme-toggle" type="button" onClick={()=>setTheme(value=>value==="light"?"dark":"light")} aria-label={theme==="light"?"Switch to night mode":"Switch to light mode"} aria-pressed={theme==="dark"}><span aria-hidden="true">{theme==="light"?"☾":"☀"}</span><span>{theme==="light"?"Night Mode":"Light Mode"}</span></button><span className="edition">A MISHAD ORIGINAL</span></div></header>
  {mode==="online"&&activeRoomCode&&<div className="room-communication"><RoomChat roomCode={activeRoomCode} playerIndex={onlineIndex}/></div>}
  {!started?<section className="setup-wrap">
   <div className="hero"><span className="eyebrow">A timeless game, made for good company</span><h1>Gather around.<br/><em>Let’s play.</em></h1><p>Bring everyone together for a classic game of Ludo.</p></div>
   
   <div className="setup-card"><span className="step">01 / GAME SETUP</span><h2>Choose how you want to play</h2>
    {mode==="online"?<OnlinePanel name={onlineName} setName={setOnlineName} code={joinCode} setCode={setJoinCode} activeCode={activeRoomCode} players={players} onlineIndex={onlineIndex} onlinePlayers={onlinePlayers} presenceReady={presenceReady} error={onlineError} busy={onlineBusy} onCreate={createOnlineRoom} onJoin={joinOnlineRoom} onStart={startOnlineRoom} onBack={()=>void exitOnlineRoom()}/>:<>
    <div className="mode-grid">
     <button className={"mode-card "+(mode==="local"?"selected":"")} onClick={()=>setMode("local")}><span className="mode-icon">♟</span><span><b>Local Player</b><small>Pass one device between players</small></span></button>
     <button className={"mode-card "+(mode==="ai"?"selected":"")} onClick={()=>setMode("ai")}><span className="mode-icon">✦</span><span><b>AI Player</b><small>Play against computer opponents</small></span></button>
     <button className="mode-card" onClick={()=>setMode("online")}><span className="mode-icon">◎</span><span><b>Online Player</b><small>Create a room or join friends</small></span></button>
    </div>
    <label className="field-label">NUMBER OF PLAYERS</label><div className="player-count">{[2,3,4].map(number=><button key={number} className={count===number?"selected":""} onClick={()=>setCount(number)}>{number} Players</button>)}</div>
    <label className="field-label name-field-label">PLAYER NAMES</label><div className="name-fields">{Array.from({length:count},(_,index)=><label className="name-field" key={index}><span>{mode==="ai"&&index>0?"COMPUTER":"PLAYER "+(index+1)}</span><input value={mode==="ai"&&index>0?"Computer":playerNames[index]} disabled={mode==="ai"&&index>0} maxLength={20} onChange={event=>setPlayerNames(values=>values.map((name,i)=>i===index?event.target.value:name))} placeholder={"Player "+(index+1)}/></label>)}</div>
    <button className="primary-btn" onClick={resetGame}>START NEW GAME <span>→</span></button><p className="footnote">Free to play · No account needed · Made by Mishad</p>
    </>}
   </div>
   {matchHistory.length>0&&<section className="history-panel"><div className="history-heading"><div><span className="step">YOUR LOCAL RECORD</span><h2>Match History &amp; Statistics</h2></div><span className="history-total">{matchHistory.length} MATCHES</span></div>
    <div className="history-stats"><div><strong>{matchHistory.length}</strong><span>Matches played</span></div><div><strong>{matchHistory.filter(match=>match.mode==="local").length}</strong><span>Local matches</span></div><div><strong>{matchHistory.filter(match=>match.mode==="ai").length}</strong><span>Vs AI matches</span></div></div>
    <div className="history-columns"><div className="history-block"><h3>Player Statistics</h3>{rankedStats.map(([name,stat])=><div className="history-player" key={name}><span>{name}</span><small>{stat.won} wins · {stat.played} played</small><b>{stat.played?Math.round(stat.won/stat.played*100):0}%</b></div>)}</div>
     <div className="history-block"><h3>Recent Matches</h3>{matchHistory.slice(0,8).map(match=><div className="history-match" key={match.id}><div><b>{match.winner} won</b><small>{new Date(match.date).toLocaleDateString()} · {match.mode==="ai"?"Vs AI":"Local"} · {match.players.length} players</small></div><span>✓</span></div>)}</div></div>
   </section>}

  </section>:<section className="play-wrap">
   {champion&&<div className="winner-celebration" role="status" aria-live="assertive"><div className="winner-confetti" aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{"--piece":i} as React.CSSProperties}/>)}</div><div className="winner-content"><span className="winner-kicker">GAME COMPLETE</span><strong>{champion} wins!</strong><p>Well played. Ready for another round?</p><button className="winner-replay" onClick={resetGame} disabled={mode==="online"}>PLAY AGAIN <span>↻</span></button></div></div>}
   {mode==="online"&&resetRequest&&<div className="reset-request" role="status">
    {resetRequest.status==="pending"?<>
     <b>Host requested a game reset</b>
     <p>Approval: {(resetRequest.approvals||[]).length}/{resetRequest.required} players · 60-second response window.</p>
     {onlineIndex!==0&&<div className="reset-actions"><button type="button" disabled={onlineBusy||Date.now()>Number(resetRequest.expiresAt)} onClick={()=>void respondOnlineReset(true)}>ACCEPT RESET</button><button type="button" disabled={onlineBusy||Date.now()>Number(resetRequest.expiresAt)} onClick={()=>void respondOnlineReset(false)}>DECLINE</button></div>}
    </>:resetRequest.status==="declined"?<p>A player declined the reset. The game was not reset.</p>:resetRequest.status==="expired"?<p>Reset request expired. The game was not reset.</p>:resetRequest.status==="approved"?<p>Everyone approved. The game has been reset.</p>:null}
   </div>}
   <div className="game-heading"><button className="back-btn" onClick={backToSetup}>← Setup</button><div className="turn-label"><i style={{background:currentColor}}/>{champion?champion+" wins":(current?.name??"Player")+"'s turn"}</div>{mode==="online"?(onlineIndex===0?<button className="back-btn" onClick={()=>void requestOnlineReset()} disabled={onlineBusy||resetRequest?.status==="pending"}>↻ Request Reset</button>:null):<button className="back-btn" onClick={resetGame}>↻ Restart</button>}</div>
   <div className="game-layout"><div className="board-frame"><Board players={players} turn={turn} choices={mode==="online"&&(onlineIndex!==turn||resetRequest?.status==="pending")?[]:choices} dice={dice} rolling={busy} canRoll={started&&dice===null&&!busy&&!champion&&!passPending&&!current?.ai&&resetRequest?.status!=="pending"&&(mode!=="online"||onlineIndex===turn)} onRoll={()=>void rollDice()} onMove={moveSelected}/></div>
    <aside className="game-side"><span className="step">{champion?"GAME FINISHED":mode==="online"&&onlineIndex!==turn?"OPPONENT TURN":current?.ai?"COMPUTER TURN":"YOUR MOVE"}</span>
     <div className="game-controls"><button type="button" className="sound-toggle" aria-pressed={soundEnabled} onClick={()=>setSoundEnabled(value=>!value)}>{soundEnabled?"🔊 Sound On":"🔇 Sound Off"}</button></div>
     <button className="roll-btn" onClick={rollDice} disabled={dice!==null||busy||!!champion||passPending||!!current?.ai||resetRequest?.status==="pending"||(mode==="online"&&onlineIndex!==turn)}>{busy?"ROLLING…":passPending?"PASSING TURN":current?.ai?"COMPUTER PLAYING":"ROLL DICE"}</button>
     <p className="game-message" aria-live="polite">{message}</p>{mode==="online"&&<><p className="online-room-badge">ONLINE ROOM · {activeRoomCode}</p></>}{onlineError&&<p className="online-error" role="alert">{onlineError}</p>}
     <div className="score-list">{players.map((player,index)=><div key={player.color} className={"score-row "+(index===turn?"is-turn":"")}><i style={{background:PALETTE[player.color]}}/><span>{player.name}{player.ai?" · AI":""}</span>{mode==="online"&&<small className={"presence-status "+(onlinePlayers.includes(index)?"is-online":"is-offline")}>{presenceReady?(onlinePlayers.includes(index)?"Online":"Offline"):"Checking…"}</small>}<small>{player.tokens.filter(token=>token.progress===56).length}/4 finished</small></div>)}</div>
     <p className="rule-note">A six brings a token out. Landing on an opponent sends it home. Safe squares protect tokens. You need an exact roll to finish.</p>
     {champion&&mode!=="online"&&<button className="primary-btn replay-btn" onClick={resetGame}>PLAY AGAIN</button>}
    </aside>
   </div>
  </section>}
  <footer>© {new Date().getFullYear()} Mishad's Ludo <span>·</span> MISHAD EDITION</footer>
 </main>;
}
