import {useEffect,useRef} from "react";
import * as THREE from "three";
import {BASE_SPOTS,BASES,COLORS,HOME_LANES,PALETTE,SAFE,START,TRACK,tokenPosition,type Color,type Player} from "./game";

type Props={
 players:Player[];turn:number;choices:number[];dice:number|null;lastDice:number|null;
 rolling:boolean;canRoll:boolean;onRoll:()=>void;onMove:(index:number)=>void;
 animatedToken:{playerIndex:number;tokenIndex:number;pos:[number,number]}|null;
 turnSeconds:number;timerActive:boolean;
};
const faceLayout:Record<number,{top:number;side:number;front:number}>={1:{top:1,side:3,front:1},2:{top:2,side:4,front:2},3:{top:3,side:5,front:3},4:{top:4,side:6,front:4},5:{top:5,side:1,front:5},6:{top:6,side:2,front:6}};
const darken=(hex:string,factor:number)=>new THREE.Color(hex).multiplyScalar(factor);
const mat=(color:string,roughness=.72,metalness=.02)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function addBox(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){
 const geometry=new THREE.BoxGeometry(w,h,d);
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function addCircle(parent:THREE.Group,x:number,y:number,z:number,r:number,depth:number,material:THREE.Material){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,28),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function addTriangle(parent:THREE.Group,points:[number,number][],color:string){
 const shape=new THREE.Shape();shape.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);shape.closePath();
 const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat(color));mesh.rotation.x=-Math.PI/2;mesh.position.y=.73;mesh.receiveShadow=true;parent.add(mesh);
}
function addStar(parent:THREE.Group,x:number,z:number){
 const shape=new THREE.Shape();
 for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2===0?.29:.13,px=Math.cos(angle)*r,pz=Math.sin(angle)*r;if(i===0)shape.moveTo(px,pz);else shape.lineTo(px,pz);}
 shape.closePath();
 const glow=new THREE.Mesh(new THREE.CircleGeometry(.34,32),new THREE.MeshBasicMaterial({color:"#e8c77e",transparent:true,opacity:.24,side:THREE.DoubleSide}));glow.rotation.x=-Math.PI/2;glow.position.set(x,.596,z);parent.add(glow);
 const star=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:"#d4a94f",emissive:"#8b6425",emissiveIntensity:.32,metalness:.55,roughness:.3,side:THREE.DoubleSide}));star.rotation.x=-Math.PI/2;star.position.set(x,.606,z);star.castShadow=true;parent.add(star);
 const center=new THREE.Mesh(new THREE.SphereGeometry(.045,12,10),mat("#fff0bd",.25,.45));center.position.set(x,.635,z);parent.add(center);
}
function addProgressLabel(parent:THREE.Group,percent:number,rank:string,x:number,z:number){
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=160;const ctx=canvas.getContext("2d");if(!ctx)return;
 ctx.fillStyle="rgba(17,39,31,.96)";ctx.beginPath();ctx.roundRect(8,8,496,144,28);ctx.fill();ctx.strokeStyle="#e2c27d";ctx.lineWidth=7;ctx.stroke();
 ctx.fillStyle="#f4dba8";ctx.font="bold 25px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("PLAYER PROGRESS",256,48);
 ctx.fillStyle="#fff8e8";ctx.font="bold 58px Arial";ctx.fillText(percent+"%",rank?218:256,108);
 if(rank){ctx.fillStyle="#f4d28a";ctx.font="bold 24px Arial";ctx.fillText(rank,405,108);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.position.set(x,1.08,z);sprite.scale.set(2.35,.74,1);parent.add(sprite);
}
function addTimerLabel(parent:THREE.Group,seconds:number,x:number,z:number){
 const canvas=document.createElement("canvas");canvas.width=320;canvas.height=112;const ctx=canvas.getContext("2d");if(!ctx)return;
 ctx.fillStyle="rgba(17,39,31,.97)";ctx.beginPath();ctx.roundRect(5,5,310,102,24);ctx.fill();ctx.strokeStyle="#e2c27d";ctx.lineWidth=5;ctx.stroke();
 ctx.fillStyle="#f4dba8";ctx.font="bold 23px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("AUTO MOVE IN",160,34);
 ctx.fillStyle="#fff8e8";ctx.font="bold 42px Arial";ctx.fillText(seconds+"s",160,75);
 ctx.fillStyle="#ffffff55";ctx.fillRect(42,91,236,7);ctx.fillStyle="#f4d28a";ctx.fillRect(42,91,236*Math.max(0,Math.min(45,seconds))/45,7);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.position.set(x,1.12,z);sprite.scale.set(1.72,.60,1);parent.add(sprite);
}
function addNameLabel(parent:THREE.Group,name:string,x:number,z:number){
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext("2d");if(!ctx)return;
 ctx.fillStyle="#fff8e9";ctx.font="bold 48px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.shadowColor="#17251f";ctx.shadowBlur=5;ctx.fillText(name.slice(0,18),256,64,480);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
 sprite.position.set(x,1.02,z);sprite.scale.set(2.7,.68,1);parent.add(sprite);
}
function buildBoard(group:THREE.Group,players:Player[]){
 const wood=mat("#263a32"),edge=mat("#182c26"),white=mat("#fffdf7");
 addBox(group,0,-.22,0,15.45,.62,15.45,wood);
 addBox(group,0,-.53,0,15.78,.14,15.78,edge);
 // Layered walnut-style rim with fine brass inlay makes the board read as a finished table.
 const rim=mat("#765b36",.38,.48),brass=mat("#d2b16b",.3,.72);
 addBox(group,0,.105,-7.48,15.12,.12,.16,rim);
 addBox(group,0,.105,7.48,15.12,.12,.16,rim);
 addBox(group,-7.48,.105,0,.16,.12,15.12,rim);
 addBox(group,7.48,.105,0,.16,.12,15.12,rim);
 addBox(group,0,.17,-7.48,14.82,.025,.035,brass);
 addBox(group,0,.17,7.48,14.82,.025,.035,brass);
 addBox(group,-7.48,.17,0,.035,.025,14.82,brass);
 addBox(group,7.48,.17,0,.035,.025,14.82,brass);
 // Small corner studs add a subtle handcrafted finish.
 for(const x of [-7.18,7.18])for(const z of [-7.18,7.18]){
  const stud=new THREE.Mesh(new THREE.SphereGeometry(.075,16,12),brass);
  stud.position.set(x,.19,z);stud.castShadow=true;group.add(stud);
 }
 // Four raised home platforms and their inset token bays.
 for(const color of COLORS){
  const base=BASES[color],cx=base.x+2.5-7,cz=base.y+2.5-7,shade=mat(darken(PALETTE[color],.68).getStyle());
  addBox(group,cx,.16,cz,6,.48,6,shade);
  addBox(group,cx,.43,cz,5.96,.18,5.96,mat(PALETTE[color]));
  addBox(group,cx,.55,cz,4.3,.12,4.3,white);
  const spots=BASE_SPOTS[color];
  for(const [sx,sy] of spots){
   const px=sx-7.5,pz=sy-7.5;
   addCircle(group,px,.64,pz,.34,.12,mat("#d7d2c5"));
   addCircle(group,px,.72,pz,.29,.10,mat(PALETTE[color]));
   addCircle(group,px,.78,pz,.20,.045,mat(darken(PALETTE[color],1.15).getStyle()));
  }
  const playerName=players.find(p=>p.color===color)?.name||color.toUpperCase();
  addNameLabel(group,playerName,cx,cz-2.55);
 }
 // Shared 52-cell track.
 for(let i=0;i<TRACK.length;i++){
  const [x,z]=TRACK[i],safe=SAFE.has(i),start=Object.entries(START).find(([,v])=>v===i)?.[0] as Color|undefined;
  const tile=addBox(group,x-7,.47,z-7,.96,.22,.96,mat(start?PALETTE[start]:safe?"#f2e8cb":"#fffdf7"));
  tile.userData={trackIndex:i};
  addBox(group,x-7,.32,z-7,.99,.12,.99,mat("#8c8779"));
  if(safe)addStar(group,x-7,z-7);
 }
 // Private six-cell home lanes.
 for(const color of COLORS)for(const [x,z] of HOME_LANES[color]){
  addBox(group,x-7,.48,z-7,.96,.24,.96,mat(PALETTE[color]));
  addBox(group,x-7,.32,z-7,.99,.12,.99,mat(darken(PALETTE[color],.65).getStyle()));
 }
 // Central four-colour finish triangle.
 addBox(group,0,.43,0,3,.22,3,white);
 addTriangle(group,[[-1.5,-1.5],[1.5,-1.5],[0,0]],PALETTE.green);
 addTriangle(group,[[1.5,-1.5],[1.5,1.5],[0,0]],PALETTE.yellow);
 addTriangle(group,[[1.5,1.5],[-1.5,1.5],[0,0]],PALETTE.blue);
 addTriangle(group,[[-1.5,1.5],[-1.5,-1.5],[0,0]],PALETTE.red);
}
function makeToken(parent:THREE.Group,color:string,index:number,x:number,z:number,selectable:boolean,onClick:()=>void){
 const token=new THREE.Group();token.position.set(x,.82,z);token.userData={kind:"token",index,onClick};
 const body=mat(color,.24,.16),dark=mat(darken(color,.52).getStyle(),.3,.28);
 // One continuous lathed pawn silhouette: broad foot, tapered neck and rounded crown.
 const profile=[
  new THREE.Vector2(0,.08),new THREE.Vector2(.22,.08),new THREE.Vector2(.285,.12),
  new THREE.Vector2(.30,.18),new THREE.Vector2(.27,.23),new THREE.Vector2(.18,.27),
  new THREE.Vector2(.145,.34),new THREE.Vector2(.15,.45),new THREE.Vector2(.205,.54),
  new THREE.Vector2(.235,.63),new THREE.Vector2(.22,.72),new THREE.Vector2(.17,.80),
  new THREE.Vector2(.09,.85),new THREE.Vector2(0,.86)
 ];
 const pawn=new THREE.Mesh(new THREE.LatheGeometry(profile,40),body);
 pawn.castShadow=true;pawn.receiveShadow=true;token.add(pawn);
 const foot=new THREE.Mesh(new THREE.CylinderGeometry(.285,.30,.075,40),dark);
 foot.position.y=.115;foot.castShadow=true;token.add(foot);
 const collar=new THREE.Mesh(new THREE.TorusGeometry(.205,.025,10,40),mat("#e6c77f",.25,.72));
 collar.rotation.x=Math.PI/2;collar.position.y=.265;token.add(collar);
 const crown=new THREE.Mesh(new THREE.SphereGeometry(.055,16,12),new THREE.MeshStandardMaterial({color:"#fff7df",roughness:.16,metalness:.08}));
 crown.position.set(-.075,.77,-.105);token.add(crown);
 if(selectable){
  const ring=new THREE.Mesh(new THREE.RingGeometry(.34,.41,48),new THREE.MeshBasicMaterial({color:"#f0cf82",side:THREE.DoubleSide,transparent:true,opacity:.95}));
  ring.rotation.x=-Math.PI/2;ring.position.y=-.045;ring.userData.isSelectionRing=true;token.add(ring);
 }
 token.traverse(object=>{if((object as THREE.Mesh).isMesh)object.userData={kind:"token",index,onClick};});
 parent.add(token);return token;
}
function makePips(parent:THREE.Group,face:number,axis:"top"|"front"|"side"){
 const spots:Record<number,[number,number][]>={
  1:[[0,0]],2:[[-.17,-.17],[.17,.17]],3:[[-.17,-.17],[0,0],[.17,.17]],
  4:[[-.17,-.17],[.17,-.17],[-.17,.17],[.17,.17]],
  5:[[-.17,-.17],[.17,-.17],[0,0],[-.17,.17],[.17,.17]],
  6:[[-.17,-.2],[.17,-.2],[-.17,0],[.17,0],[-.17,.2],[.17,.2]]
 };
 for(const [a,b] of spots[face]){
  const pip=new THREE.Mesh(new THREE.SphereGeometry(.065,12,10),mat("#173b30",.4));
  if(axis==="top")pip.position.set(a,.49,b);
  else if(axis==="front")pip.position.set(a,b,.49);
  else pip.position.set(.49,b,a);
  parent.add(pip);
 }
}
export default function ThreeBoard(props:Props){
 const mountRef=useRef<HTMLDivElement|null>(null);
 const piecesRef=useRef<THREE.Group|null>(null),diceRef=useRef<THREE.Group|null>(null),tokenLayerRef=useRef<THREE.Group|null>(null),ringLayerRef=useRef<THREE.Group|null>(null),progressLayerRef=useRef<THREE.Group|null>(null),tokenMapRef=useRef<Map<string,THREE.Group>>(new Map()),resetViewRef=useRef<()=>void>(()=>{}),callbacksRef=useRef({onRoll:props.onRoll,onMove:props.onMove,canRoll:props.canRoll});
 callbacksRef.current={onRoll:props.onRoll,onMove:props.onMove,canRoll:props.canRoll};
 useEffect(()=>{
  const mount=mountRef.current;if(!mount)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});}catch{return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.domElement.className="ludo-3d-canvas";renderer.domElement.setAttribute("aria-label","Interactive three dimensional Ludo board");
  mount.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color("#d9c9a7");scene.fog=new THREE.Fog("#d9c9a7",32,62);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),mat("#b7a27d",.92));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.62;ground.receiveShadow=true;scene.add(ground);
  const camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(11.5,20,22);camera.lookAt(0,.1,0);
  const cameraTarget=new THREE.Vector3(0,.1,0);let radius=camera.position.distanceTo(cameraTarget),theta=Math.atan2(camera.position.x-cameraTarget.x,camera.position.z-cameraTarget.z),phi=Math.acos((camera.position.y-cameraTarget.y)/radius);
  const updateCamera=()=>{phi=THREE.MathUtils.clamp(phi,.28,Math.PI/2.05);radius=THREE.MathUtils.clamp(radius,15,42);camera.position.set(cameraTarget.x+radius*Math.sin(phi)*Math.sin(theta),cameraTarget.y+radius*Math.cos(phi),cameraTarget.z+radius*Math.sin(phi)*Math.cos(theta));camera.lookAt(cameraTarget);};
  const resetCamera=()=>{cameraTarget.set(0,.1,0);radius=30;theta=Math.atan2(11.5,22);phi=Math.acos(20/Math.sqrt(11.5*11.5+20*20+22*22));updateCamera();};resetViewRef.current=resetCamera;
  scene.add(new THREE.HemisphereLight("#fff4dc","#42564a",1.75));
  const ambient=new THREE.AmbientLight("#fff8e8",.38);scene.add(ambient);
  const key=new THREE.DirectionalLight("#fff0d2",3.0);key.position.set(-8,18,10);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;scene.add(key);
  const fill=new THREE.DirectionalLight("#c3d9ff",.9);fill.position.set(10,9,-12);scene.add(fill);
  const rimLight=new THREE.DirectionalLight("#f4d49a",.65);rimLight.position.set(3,8,14);scene.add(rimLight);
  const board=new THREE.Group();scene.add(board);buildBoard(board,props.players);
  const progressLayer=new THREE.Group();scene.add(progressLayer);progressLayerRef.current=progressLayer;
  const pieces=new THREE.Group(),dice=new THREE.Group(),tokenLayer=new THREE.Group(),ringLayer=new THREE.Group();pieces.add(ringLayer,tokenLayer);scene.add(pieces,dice);
  piecesRef.current=pieces;diceRef.current=dice;tokenLayerRef.current=tokenLayer;ringLayerRef.current=ringLayer;tokenMapRef.current.clear();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),activePointers=new Map<number,{x:number;y:number}>();
  let previousCentroid={x:0,y:0},previousDistance=0,gestureMoved=false;
  const centroid=()=>{const values=[...activePointers.values()];return {x:values.reduce((s,p)=>s+p.x,0)/values.length,y:values.reduce((s,p)=>s+p.y,0)/values.length};};
  const distance=()=>{const values=[...activePointers.values()];return values.length<2?0:Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);};
  const onPointerDown=(event:PointerEvent)=>{activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});renderer.domElement.setPointerCapture(event.pointerId);previousCentroid=centroid();previousDistance=distance();gestureMoved=false;};
  const onPointerMove=(event:PointerEvent)=>{if(!activePointers.has(event.pointerId))return;const old=activePointers.get(event.pointerId)!;activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const center=centroid();if(activePointers.size===1){const dx=center.x-old.x,dy=center.y-old.y;if(Math.abs(dx)+Math.abs(dy)>2)gestureMoved=true;const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);const scale=radius*.0017;cameraTarget.addScaledVector(right,-dx*scale);cameraTarget.addScaledVector(up,dy*scale);updateCamera();}else if(activePointers.size>=2){const dist=distance();if(previousDistance>0&&dist>0){const dx=center.x-previousCentroid.x,dy=center.y-previousCentroid.y;theta-=dx*.008;phi=THREE.MathUtils.clamp(phi+dy*.006,.28,Math.PI/2.05);radius=THREE.MathUtils.clamp(radius*(previousDistance/dist),15,42);updateCamera();if(Math.abs(dx)+Math.abs(dy)>1||Math.abs(dist-previousDistance)>1)gestureMoved=true;}previousDistance=dist;}previousCentroid=center;};
  const onPointerUp=(event:PointerEvent)=>{const wasTap=!gestureMoved&&activePointers.size===1;activePointers.delete(event.pointerId);if(wasTap){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([tokenLayer,dice],true).find(item=>item.object.userData.kind);if(hit){const data=hit.object.userData;if(data.kind==="dice"&&callbacksRef.current.canRoll)callbacksRef.current.onRoll();if(data.kind==="token"&&typeof data.index==="number"&&typeof data.onClick==="function")data.onClick();}}if(activePointers.size===0){gestureMoved=false;previousDistance=0;}else{previousCentroid=centroid();previousDistance=distance();}};
  const onWheel=(event:WheelEvent)=>{event.preventDefault();radius=THREE.MathUtils.clamp(radius*Math.exp(event.deltaY*.001),15,42);updateCamera();};
  renderer.domElement.addEventListener("pointerdown",onPointerDown);renderer.domElement.addEventListener("pointermove",onPointerMove);renderer.domElement.addEventListener("pointerup",onPointerUp);renderer.domElement.addEventListener("pointercancel",onPointerUp);renderer.domElement.addEventListener("wheel",onWheel,{passive:false});
  const resize=()=>{const width=mount.clientWidth||600,height=mount.clientHeight||width;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(mount);resize();
  let frame=0;const clock=new THREE.Clock();const render=()=>{frame=requestAnimationFrame(render);const delta=Math.min(clock.getDelta(),.05);for(const token of tokenLayer.children as THREE.Group[]){const target=token.userData.target as THREE.Vector3|undefined;if(target){token.position.lerp(target,1-Math.exp(-delta*16));if(token.position.distanceToSquared(target)<.0004)token.position.copy(target);}token.children.forEach(child=>{if(child.userData.isSelectionRing){const pulse=1+Math.sin(clock.elapsedTime*5)*.055;child.scale.setScalar(pulse);}});}for(const die of dice.children as THREE.Group[]){if(die.userData.isRolling){die.rotation.x+=delta*30;die.rotation.y+=delta*38;die.rotation.z+=delta*24;die.position.y=1.28+Math.sin(clock.elapsedTime*18)*.07;}}renderer.render(scene,camera);};render();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("pointerdown",onPointerDown);renderer.domElement.removeEventListener("pointermove",onPointerMove);renderer.domElement.removeEventListener("pointerup",onPointerUp);renderer.domElement.removeEventListener("pointercancel",onPointerUp);renderer.domElement.removeEventListener("wheel",onWheel);resetViewRef.current=()=>{};renderer.dispose();mount.removeChild(renderer.domElement);scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials?.forEach(material=>material?.dispose());});piecesRef.current=null;diceRef.current=null;tokenLayerRef.current=null;ringLayerRef.current=null;progressLayerRef.current=null;tokenMapRef.current.clear();};
 },[]);
 useEffect(()=>{
  const tokenLayer=tokenLayerRef.current,ringLayer=ringLayerRef.current,dice=diceRef.current,progressLayer=progressLayerRef.current;if(!tokenLayer||!ringLayer||!dice||!progressLayer)return;
  ringLayer.clear();dice.clear();
  progressLayer.traverse(object=>{const sprite=object as THREE.Sprite;if((sprite as any).isSprite&&sprite.material){const material=sprite.material as THREE.SpriteMaterial;material.map?.dispose();material.dispose();}});progressLayer.clear();
  const activeColor=props.players[props.turn]?.color;
  if(activeColor){const base=BASES[activeColor],cx=base.x+2.5-7,cz=base.y+2.5-7;const ring=new THREE.Mesh(new THREE.RingGeometry(3.02,3.12,64),new THREE.MeshBasicMaterial({color:"#f4d28a",side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(cx,.545,cz);ringLayer.add(ring);}
  const all=props.players.flatMap((player,playerIndex)=>player.tokens.map((token,tokenIndex)=>({player,playerIndex,tokenIndex,pos:props.animatedToken?.playerIndex===playerIndex&&props.animatedToken.tokenIndex===tokenIndex?props.animatedToken.pos:tokenPosition(player.color,token,tokenIndex),moving:props.animatedToken?.playerIndex===playerIndex&&props.animatedToken.tokenIndex===tokenIndex})));
  for(const piece of all){
   const [gx,gy]=piece.pos;const home=piece.player.tokens[piece.tokenIndex].progress===-1&&!piece.moving;
   const x=home?gx-7.5:gx-7,z=home?gy-7.5:gy-7;
   const stacked=all.filter(other=>other.pos[0]===gx&&other.pos[1]===gy);
   const stackIndex=stacked.findIndex(other=>other.playerIndex===piece.playerIndex&&other.tokenIndex===piece.tokenIndex);
   const dx=stacked.length>1?(stackIndex%2)*.27-.135:0,dz=stacked.length>1?Math.floor(stackIndex/2)*.27-.135:0;
   const selectable=piece.playerIndex===props.turn&&props.choices.includes(piece.tokenIndex);
   const key=piece.playerIndex+"-"+piece.tokenIndex;
   const target=new THREE.Vector3(x+dx,.82,z+dz);
   let token=tokenMapRef.current.get(key);
   if(!token){token=makeToken(tokenLayer,PALETTE[piece.player.color],piece.tokenIndex,x+dx,z+dz,selectable,()=>selectable&&callbacksRef.current.onMove(piece.tokenIndex)) as THREE.Group;token.userData.target=target.clone();tokenMapRef.current.set(key,token);}
   else {token.userData.target=target;token.userData.onClick=()=>selectable&&callbacksRef.current.onMove(piece.tokenIndex);token.traverse(object=>{if(object.userData.kind==="token")object.userData.onClick=token!.userData.onClick;});}
  }
  for(const player of props.players){const base=BASES[player.color],cx=base.x+2.5-7,cz=base.y+2.5-7;const total=player.tokens.reduce((sum,token)=>sum+Math.max(0,Math.min(56,token.progress)),0);const percent=Math.round(total/(player.tokens.length*56)*100);const rank=player.rank?`${player.rank===1?"1ST":player.rank===2?"2ND":player.rank===3?"3RD":player.rank+"TH"}`:"";addProgressLabel(progressLayer,percent,rank,cx,cz-1.65);if(props.timerActive&&props.players[props.turn]?.color===player.color)addTimerLabel(progressLayer,props.turnSeconds,cx,cz-0.78);}
  const color=props.players[props.turn]?.color;
  if(color){
   const base=BASES[color],px=base.x+(color==="red"||color==="blue"?5.25:.75)-7.5,pz=base.y+(color==="red"||color==="green"?5.25:.75)-7.5;
   const cube=new THREE.Group();cube.position.set(px,1.28,pz);cube.rotation.set(-.12,.25,.08);cube.userData={kind:"dice",isRolling:props.rolling};
   const cubeMesh=new THREE.Mesh(new THREE.BoxGeometry(.92,.92,.92),[
    mat("#fffdf5",.22,.06),mat("#e9e3d6",.3,.04),mat("#fffdf5",.22,.06),
    mat("#ddd5c5",.34,.03),mat("#fffdf5",.22,.06),mat("#77796f",.5,.02)
   ]);
   cubeMesh.castShadow=true;cubeMesh.receiveShadow=true;cubeMesh.userData={kind:"dice"};cube.add(cubeMesh);
   const bevelLines=new THREE.LineSegments(new THREE.EdgesGeometry(cubeMesh.geometry,18),new THREE.LineBasicMaterial({color:"#b9ad98",transparent:true,opacity:.72}));
   bevelLines.userData={kind:"dice"};cube.add(bevelLines);
   const value=props.dice??props.lastDice??5,layout=faceLayout[value];
   makePips(cube,layout.top,"top");makePips(cube,layout.front,"front");makePips(cube,layout.side,"side");
   cube.traverse(object=>{object.userData.kind="dice";});dice.add(cube);
  }
 },[props.players,props.turn,props.choices,props.dice,props.lastDice,props.rolling,props.animatedToken,props.turnSeconds,props.timerActive]);
 return <div className="board-3d-wrap">
  <div className="board-3d-stage" ref={mountRef} role="group" aria-label="3D Ludo board">
   <span className="board-3d-caption">3D BOARD · INTERACTIVE</span>
  </div>
  <div className="board-3d-tools"><span>Drag to move · Two fingers to rotate · Pinch or scroll to zoom</span><button type="button" onClick={()=>resetViewRef.current()}>↺ Reset View</button></div>
 </div>;
}
