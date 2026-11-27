import {useEffect,useRef} from "react";
import * as THREE from "three";
import {BASE_SPOTS,BASES,COLORS,HOME_LANES,PALETTE,SAFE,START,TRACK,tokenPosition,type Color,type Player} from "./game";

type Props={
 players:Player[];turn:number;choices:number[];dice:number|null;lastDice:number|null;
 rolling:boolean;canRoll:boolean;onRoll:()=>void;onMove:(index:number)=>void;
 animatedToken:{playerIndex:number;tokenIndex:number;pos:[number,number]}|null;
};
const faceLayout:Record<number,{top:number;side:number;front:number}>={1:{top:1,side:3,front:1},2:{top:2,side:4,front:2},3:{top:3,side:5,front:3},4:{top:4,side:6,front:4},5:{top:5,side:1,front:5},6:{top:6,side:2,front:6}};
const darken=(hex:string,factor:number)=>new THREE.Color(hex).multiplyScalar(factor);
const mat=(color:string,roughness=.72)=>new THREE.MeshStandardMaterial({color,roughness,metalness:.02});
function addBox(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material,bevel=0){
 const geometry=bevel>0?new THREE.BoxGeometry(w,h,d):new THREE.BoxGeometry(w,h,d);
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function addCircle(parent:THREE.Group,x:number,y:number,z:number,r:number,depth:number,material:THREE.Material){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,28),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function addTriangle(parent:THREE.Group,points:[number,number][],color:string){
 const shape=new THREE.Shape();shape.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);shape.closePath();
 const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat(color));mesh.rotation.x=-Math.PI/2;mesh.position.y=.73;mesh.receiveShadow=true;parent.add(mesh);
}
function addNameLabel(parent:THREE.Group,name:string,color:string,x:number,z:number){
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext("2d");if(!ctx)return;
 ctx.fillStyle="#fff8e9";ctx.font="bold 48px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.shadowColor="#17251f";ctx.shadowBlur=5;ctx.fillText(name.slice(0,18),256,64,480);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
 sprite.position.set(x,1.02,z);sprite.scale.set(2.7,.68,1);parent.add(sprite);
}
function buildBoard(group:THREE.Group,players:Player[],turn:number){
 const wood=mat("#263a32"),edge=mat("#182c26"),white=mat("#fffdf7"),line=mat("#b9b8aa");
 addBox(group,0,-.18,0,15.45,.55,15.45,wood);
 addBox(group,0,-.48,0,15.7,.12,15.7,edge);
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
  addNameLabel(group,playerName,color,cx,cz-2.55);
 }
 // Shared 52-cell track.
 for(let i=0;i<TRACK.length;i++){
  const [x,z]=TRACK[i],safe=SAFE.has(i),start=Object.entries(START).find(([,v])=>v===i)?.[0] as Color|undefined;
  const tile=addBox(group,x-7,.47,z-7,.96,.22,.96,mat(start?PALETTE[start]:safe?"#f2e8cb":"#fffdf7"));
  tile.userData={trackIndex:i};
  addBox(group,x-7,.32,z-7,.99,.12,.99,mat("#8c8779"));
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
 const body=mat(color,.36),highlight=new THREE.MeshStandardMaterial({color:"#ffffff",roughness:.22,metalness:.08});
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.25,.28,.16,28),mat(darken(color,.58).getStyle()));base.position.y=.02;base.castShadow=true;token.add(base);
 const stem=new THREE.Mesh(new THREE.ConeGeometry(.22,.48,28),body);stem.position.y=.31;stem.castShadow=true;token.add(stem);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.19,24,18),highlight);head.material=mat(color,.3);head.position.y=.59;head.castShadow=true;token.add(head);
 const glint=new THREE.Mesh(new THREE.SphereGeometry(.055,12,10),new THREE.MeshBasicMaterial({color:"#ffffff"}));glint.position.set(-.07,.68,-.11);token.add(glint);
 if(selectable){const ring=new THREE.Mesh(new THREE.RingGeometry(.31,.37,32),new THREE.MeshBasicMaterial({color:"#e5c47e",side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.05;token.add(ring);}
 token.traverse(object=>{if((object as THREE.Mesh).isMesh)object.userData={kind:"token",index,onClick};});
 parent.add(token);
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
 const sceneRef=useRef<THREE.Scene|null>(null),cameraRef=useRef<THREE.PerspectiveCamera|null>(null),rendererRef=useRef<THREE.WebGLRenderer|null>(null);
 const piecesRef=useRef<THREE.Group|null>(null),diceRef=useRef<THREE.Group|null>(null),callbacksRef=useRef({onRoll:props.onRoll,onMove:props.onMove,canRoll:props.canRoll});
 callbacksRef.current={onRoll:props.onRoll,onMove:props.onMove,canRoll:props.canRoll};
 useEffect(()=>{
  const mount=mountRef.current;if(!mount)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});}catch{return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.domElement.className="ludo-3d-canvas";renderer.domElement.setAttribute("aria-label","Interactive three dimensional Ludo board");
  mount.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color("#d9c9a7");scene.fog=new THREE.Fog("#d9c9a7",28,55);
  const camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(11.5,20,22);camera.lookAt(0,.1,0);
  scene.add(new THREE.HemisphereLight("#fff4dc","#42564a",2.1));
  const key=new THREE.DirectionalLight("#fff0d2",3.2);key.position.set(-8,17,10);key.castShadow=true;key.shadow.mapSize.set(1536,1536);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;scene.add(key);
  const fill=new THREE.DirectionalLight("#b7d4ff",.75);fill.position.set(10,9,-12);scene.add(fill);
  const board=new THREE.Group();scene.add(board);buildBoard(board,props.players,props.turn);
  const pieces=new THREE.Group(),dice=new THREE.Group();scene.add(pieces,dice);
  sceneRef.current=scene;cameraRef.current=camera;rendererRef.current=renderer;piecesRef.current=pieces;diceRef.current=dice;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const onPointer=(event:PointerEvent)=>{
   const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
   raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([pieces,dice],true).find(item=>item.object.userData.kind);
   if(!hit)return;const data=hit.object.userData;
   if(data.kind==="dice"&&callbacksRef.current.canRoll)callbacksRef.current.onRoll();
   if(data.kind==="token"&&typeof data.index==="number"&&typeof data.onClick==="function")data.onClick();
  };
  renderer.domElement.addEventListener("pointerdown",onPointer);
  const resize=()=>{const width=mount.clientWidth||600,height=mount.clientHeight||width;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(mount);resize();
  let frame=0;const render=()=>{frame=requestAnimationFrame(render);renderer.render(scene,camera);};render();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("pointerdown",onPointer);renderer.dispose();mount.removeChild(renderer.domElement);scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials?.forEach(material=>material?.dispose());});sceneRef.current=null;cameraRef.current=null;rendererRef.current=null;piecesRef.current=null;diceRef.current=null;};
 },[]);
 useEffect(()=>{
  const pieces=piecesRef.current,dice=diceRef.current;if(!pieces||!dice)return;
  pieces.clear();dice.clear();
  const activeColor=props.players[props.turn]?.color;
  if(activeColor){const base=BASES[activeColor],cx=base.x+2.5-7,cz=base.y+2.5-7;const ring=new THREE.Mesh(new THREE.RingGeometry(3.02,3.12,64),new THREE.MeshBasicMaterial({color:"#f4d28a",side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(cx,.545,cz);pieces.add(ring);}
  const all=props.players.flatMap((player,playerIndex)=>player.tokens.map((token,tokenIndex)=>({player,playerIndex,tokenIndex,pos:props.animatedToken?.playerIndex===playerIndex&&props.animatedToken.tokenIndex===tokenIndex?props.animatedToken.pos:tokenPosition(player.color,token,tokenIndex),moving:props.animatedToken?.playerIndex===playerIndex&&props.animatedToken.tokenIndex===tokenIndex})));
  for(const piece of all){
   const [gx,gy]=piece.pos;const home=piece.player.tokens[piece.tokenIndex].progress===-1&&!piece.moving;
   const x=home?gx-7.5:gx-7,z=home?gy-7.5:gy-7;
   const stacked=all.filter(other=>other.pos[0]===gx&&other.pos[1]===gy);
   const stackIndex=stacked.findIndex(other=>other.playerIndex===piece.playerIndex&&other.tokenIndex===piece.tokenIndex);
   const dx=stacked.length>1?(stackIndex%2)*.27-.135:0,dz=stacked.length>1?Math.floor(stackIndex/2)*.27-.135:0;
   const selectable=piece.playerIndex===props.turn&&props.choices.includes(piece.tokenIndex);
   makeToken(pieces,PALETTE[piece.player.color],piece.tokenIndex,x+dx,z+dz,selectable,()=>selectable&&callbacksRef.current.onMove(piece.tokenIndex));
  }
  const color=props.players[props.turn]?.color;
  if(color){
   const base=BASES[color],px=base.x+(color==="red"||color==="blue"?5.25:.75)-7.5,pz=base.y+(color==="red"||color==="green"?5.25:.75)-7.5;
   const cube=new THREE.Group();cube.position.set(px,1.28,pz);cube.rotation.set(-.12,.25,.08);cube.userData={kind:"dice"};
   const cubeMesh=new THREE.Mesh(new THREE.BoxGeometry(.92,.92,.92),[mat("#fffdf5"),mat("#e9e3d6"),mat("#fffdf5"),mat("#ddd5c5"),mat("#fffdf5"),mat("#77796f")]);
   cubeMesh.castShadow=true;cubeMesh.receiveShadow=true;cubeMesh.userData={kind:"dice"};cube.add(cubeMesh);
   const value=props.dice??props.lastDice??5,layout=faceLayout[value];
   makePips(cube,layout.top,"top");makePips(cube,layout.front,"front");makePips(cube,layout.side,"side");
   if(props.rolling){cube.rotation.x+=.5;cube.rotation.y+=.8;}
   cube.traverse(object=>{object.userData={kind:"dice"};});dice.add(cube);
  }
 },[props.players,props.turn,props.choices,props.dice,props.lastDice,props.rolling,props.canRoll,props.animatedToken]);
 return <div className="board-3d-stage" ref={mountRef} role="group" aria-label="3D Ludo board">
  <span className="board-3d-caption">3D BOARD · INTERACTIVE</span>
 </div>;
}
