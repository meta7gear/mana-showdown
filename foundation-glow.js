import * as THREE from 'three/webgpu';
import {canMove} from './game.js';

// A shared, transparent rim texture keeps card faces readable and costs no
// per-frame canvas uploads. Children inherit card position, tilt and sizing.
export function createFoundationGlow(width,height){
 const padding=20,canvas=document.createElement('canvas'),ratio=3;
 canvas.width=(width+padding*2)*ratio;canvas.height=(height+padding*2)*ratio;
 const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
 const rim=()=>{ctx.beginPath();ctx.roundRect(padding,padding,width,height,6);};
 for(const [blur,color,line] of [[12,'#ef571d',3],[5,'#ff9b38',2],[2,'#ffe1a0',1]]){
  ctx.shadowBlur=blur*ratio;ctx.shadowColor=color;ctx.strokeStyle=color;ctx.lineWidth=line;rim();ctx.stroke();
 }
 // Small tapered flame tongues climb the outside edges, with varied heights.
 ctx.shadowBlur=4*ratio;ctx.shadowColor='#ff792b';
 for(let side=0;side<2;side++)for(let i=0;i<7;i++){
  const x=padding+side*width,y=padding+14+i*16,direction=side?1:-1;
  const reach=5+(i%3)*2,rise=9+(i%4)*3;
  ctx.fillStyle=i%2?'#ffae48':'#f97428';ctx.beginPath();ctx.moveTo(x,y+5);
  ctx.bezierCurveTo(x+direction*reach,y,x+direction*2,y-rise/2,x+direction*(reach-2),y-rise);
  ctx.bezierCurveTo(x+direction*(reach+3),y-3,x+direction*8,y+4,x,y+5);ctx.fill();
 }
 // Remove glow from the interior, leaving just a fine warm edge.
 ctx.shadowBlur=0;ctx.globalCompositeOperation='destination-out';
 ctx.beginPath();ctx.roundRect(padding+1.5,padding+1.5,width-3,height-3,5);ctx.fill();
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 // Board coordinates point down; flip the plane UVs to keep flames rising.
 const geometry=new THREE.PlaneGeometry(width+padding*2,height+padding*2);
 const uv=geometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
 const glows=new Map();
 return {
  sync(state,meshes){
   for(const glow of glows.values())glow.visible=false;
   for(const mesh of meshes.values()){
    const {ref,index,back}=mesh.userData;
    if(!mesh.visible||back||!['life','waste','column'].includes(ref.type))continue;
    if(!state.players[ref.player].columns.some((_,indexTo)=>canMove(state,ref,index,{type:'column',player:ref.player,index:indexTo})))continue;
    let glow=glows.get(mesh);
    if(!glow){
     glow=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
     glow.position.z=.1;mesh.add(glow);glows.set(mesh,glow);
    }
    glow.visible=true;
   }
  },
  update(time,{reducedMotion,active,dragging}){
   // A soft 1.6-second flicker followed by a quiet interval, every four seconds.
   const phase=(time/1000)%4;
   const envelope=phase<1.6?Math.sin(Math.PI*phase/1.6)**2:0;
   const flicker=.88+.08*Math.sin(time*.019)+.04*Math.sin(time*.037);
   for(const [mesh,glow] of glows){
    if(!glow.visible)continue;
    const hidden=!active||dragging?.group.includes(mesh);
    glow.material.opacity=hidden?0:reducedMotion?.16:envelope*flicker*.38;
    glow.scale.y=reducedMotion?1:1+envelope*.012*Math.sin(time*.008);
   }
  }
 };
}
