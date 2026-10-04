import * as THREE from 'three/webgpu';
import gsap from 'gsap';

// GPU-rendered impact effects: ion trails, an expanding shock ring, and brief arcs.
// No screen-space confetti; every effect originates at a board position.
export function energyBurst(scene, point, player = 0, winning = false, aspect = {x:1,y:1}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const group = new THREE.Group();
  group.position.set(point.x, point.y, 220);
  group.scale.set(aspect.x, aspect.y, 1);
  scene.add(group);
  const color = player === 0 ? 0xffa34f : 0x5cffee;
  const material = (opacity = 1) => new THREE.MeshBasicMaterial({color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide});
  const ring = new THREE.Mesh(new THREE.RingGeometry(27, 29, 48), material(.9));
  group.add(ring);
  gsap.to(ring.scale,{x:winning?8:3.5,y:winning?8:3.5,duration:.55,ease:'power2.out'});
  gsap.to(ring.material,{opacity:0,duration:.55,ease:'power2.in'});
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(100,2), material(1));
  group.add(flash);gsap.to(flash.scale,{x:winning?4:1.8,y:0,duration:.3});
  const count=winning?65:23;
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,range=35+Math.random()*(winning?240:95);
    const spark=new THREE.Mesh(new THREE.PlaneGeometry(4+Math.random()*13,.8+Math.random()*1.5),material(.85));
    spark.rotation.z=a;group.add(spark);
    gsap.to(spark.position,{x:Math.cos(a)*range,y:Math.sin(a)*range,duration:.3+Math.random()*.4,ease:'power3.out'});
    gsap.to(spark.material,{opacity:0,delay:.12,duration:.4});
    gsap.to(spark.scale,{x:.1,y:.1,delay:.12,duration:.5});
  }
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3+Math.random(),points=[];
    for(let j=0;j<6;j++){const r=j*18;points.push(new THREE.Vector3(Math.cos(a)*r+(Math.random()-.5)*17,Math.sin(a)*r+(Math.random()-.5)*17,0));}
    const arc=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    group.add(arc);gsap.to(arc.material,{opacity:0,duration:.18,delay:i*.025});
  }
  gsap.delayedCall(.9,()=>{scene.remove(group);group.traverse(obj=>{obj.geometry?.dispose();obj.material?.dispose();});});
}
