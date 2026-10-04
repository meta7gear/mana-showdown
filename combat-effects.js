import gsap from 'gsap';
import {comboBursts} from './combo-bursts.js';

// A screen-space layer keeps text crisp and connects scene cards to HUD targets.
export function createCombatEffects({onRapidHit=()=>{},onClear=()=>{}}={}) {
 const layer=document.createElement('div');
 layer.className='combat-effects';layer.setAttribute('aria-hidden','true');document.body.append(layer);
 const active=new Set();
 const shakes=new Set();
 let cinematic=false;
 function timeline(root){
  const tl=gsap.timeline({onComplete:()=>{root?.remove();active.delete(tl);}});
  active.add(tl);return tl;
 }
 function play({source,target,amount,heal=false,combo=false,comboText='2x combo +5 HP',comboBreakText=null,onFatal,delay=.42}){
  const root=document.createElement('div');root.className=`combat-event${heal?' is-heal':''}${combo?' is-combo':''}`;layer.append(root);
  const tl=timeline(root),quiet=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function node(className,text=''){
   const el=document.createElement('span');el.className=className;el.textContent=text;root.append(el);return el;
  }
  function at(el,p){gsap.set(el,{left:p.x,top:p.y,xPercent:-50,yPercent:-50});}
  const orb=node('combat-orb');at(orb,source);
  const icon=document.createElement('span');icon.className='combat-symbol';icon.textContent=heal?'♥':'✦';orb.append(icon);
  const value=document.createElement('strong');value.textContent=heal?(amount?`+${amount} HP`:'FULL HP'):`−${Math.abs(amount)} HP`;orb.append(value);
  const labels=[...(comboBreakText?[{text:comboBreakText,breaker:true}]:[]),...(combo?(Array.isArray(comboText)?comboText:[comboText]).map(text=>({text,breaker:false})):[])];
  const banners=labels.map(({text,breaker})=>{
   const banner=node(breaker?'combat-combo combat-combo-buster':'combat-combo',text);
   at(banner,{x:Math.max(110,Math.min(innerWidth-110,source.x)),y:source.y-65});
   gsap.set(banner,{opacity:0});return banner;
  });
  if(quiet){
   if(!heal)tl.call(()=>{onFatal?.();},[],0);
   banners.forEach((banner,index)=>{
    tl.set(banner,{opacity:1},index*.7).set(banner,{opacity:0},(index+1)*.7);
   });
   tl.set(root,{opacity:1},0).to(root,{opacity:0,duration:.2},Math.max(1.25,banners.length*.7));
   return;
  }
  gsap.set(root,{opacity:0});
  tl.set(root,{opacity:1},delay);
  tl.fromTo(orb,{scale:.15,opacity:0},{scale:combo?1.15:1,opacity:1,duration:.2,ease:'power2.out'},delay);
  banners.forEach((banner,index)=>{
   const start=delay+index*.95,hold=banners.length>1?.6:1.25,fade=banners.length>1?.3:.4;
   tl.fromTo(banner,{scale:.35,opacity:0,rotation:-8},{scale:1,opacity:1,rotation:-4,duration:.3,ease:'back.out(2)'},start)
    .to(banner,{y:-22,opacity:0,duration:fade},start+hold);
  });
  const launch=delay+.12,flight=.8,impact=launch+flight;
  if(!heal)tl.call(()=>{onFatal?.();},[],impact);
  const control={x:(source.x+target.x)/2+(heal?-32:32),y:(source.y+target.y)/2};
  // One continuously accelerating Bézier flight: no restart at a waypoint.
  function fly(el,start){
   const progress={t:0},setX=gsap.quickSetter(el,'left','px'),setY=gsap.quickSetter(el,'top','px');
   tl.to(progress,{t:1,duration:flight,ease:'power2.in',onUpdate:()=>{
    const t=progress.t,u=1-t;
    setX(u*u*source.x+2*u*t*control.x+t*t*target.x);
    setY(u*u*source.y+2*u*t*control.y+t*t*target.y);
   }},start);
  }
  fly(orb,launch);
  tl.to(orb,{scale:combo?1.3:1.1,duration:.12,ease:'power2.out'},impact)
   .to(orb,{y:heal?-35:18,scale:.85,opacity:0,duration:.45},impact+.2);
  // Staggered followers trace the same flight, then dissolve at the receiver.
  for(let i=0;i<(combo?14:8);i++){
   const spark=node('combat-trail',heal?'+':'');at(spark,source);gsap.set(spark,{opacity:0});
   const start=launch+i*.022;
   tl.set(spark,{opacity:.8,scale:1-i*.035},start);
   fly(spark,start);
   tl.to(spark,{opacity:0,scale:0,duration:.16},start+flight);
  }
  function explosion(point,time,big){
   const ring=node('combat-ring');at(ring,point);gsap.set(ring,{opacity:0});
   tl.fromTo(ring,{scale:.15,opacity:1},{immediateRender:false,scale:big?4:2,opacity:0,duration:.65,ease:'power2.out'},time);
   const flash=node('combat-flash');at(flash,point);gsap.set(flash,{opacity:0});
   tl.fromTo(flash,{scale:.2,opacity:.95},{immediateRender:false,scale:big?3.5:1.5,opacity:0,duration:.4},time);
   for(let i=0;i<(big?32:12);i++){
    const spark=node('combat-spark',heal?'+':'');at(spark,point);gsap.set(spark,{opacity:0});
    const angle=i*Math.PI*2/(big?32:12),distance=(big?90:35)+Math.random()*(big?110:45);
    tl.fromTo(spark,{opacity:1,scale:1.2,rotation:angle*180/Math.PI},{immediateRender:false,x:Math.cos(angle)*distance,y:Math.sin(angle)*distance,scale:.1,opacity:0,duration:.5+Math.random()*.25,ease:'power3.out'},time);
   }
  }
  explosion(source,delay,combo);explosion(target,impact,combo);
 }
 function fourCombo(attacker,{onFatal,onHit=()=>{},damage=20,aceBonus=false}={}){
  const bursts=comboBursts(damage);
  cinematic=true;
  const root=document.createElement('div');root.className='four-combo';layer.append(root);
  const quiet=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tl=timeline(root);tl.eventCallback('onComplete',()=>{root.remove();active.delete(tl);cinematic=false;});
  const shade=document.createElement('div');shade.className='four-combo-shade';root.append(shade);
  tl.fromTo(shade,{opacity:0},{opacity:1,duration:.25},0);
  const banner=document.createElement('div');banner.className='four-combo-title';banner.textContent='3x combo +15 HP';
  const caption=document.createElement('small');caption.textContent=`${damage} HP · ${bursts.length} HITS`;banner.append(caption);root.append(banner);
  tl.fromTo(banner,{opacity:0},{opacity:1,duration:.25},.2);
  const centers=[],avatars=[];
  for(const player of [0,1]){
   const original=document.querySelector(`.portrait[data-player="${player}"] img`),rect=original.getBoundingClientRect();
   const image=document.createElement('img');image.src=original.currentSrc||original.src;image.alt='';avatars[player]=image;
   image.className=`four-combo-avatar${player===attacker?' is-attacker':''}`;root.append(image);
   const attacking=player===attacker,width=Math.min(innerWidth*(attacking?.36:.28),innerHeight*(attacking?.65:.5));
   const height=width*1.25,x=innerWidth*(attacking?.27:.75),y=innerHeight*.54;
   centers[player]={x,y};
   const destination={left:x-width/2,top:y-height/2,width,height,opacity:1};
   if(quiet)gsap.set(image,destination);
   else tl.fromTo(image,{left:rect.left,top:rect.top,width:rect.width,height:rect.height,opacity:.5},
    {...destination,duration:.55,ease:'power3.out'},0);
  }
  const source=centers[attacker],target=centers[1-attacker];
  const launch=quiet?.5:aceBonus?1.85:.7,spacing=quiet?.025:.055;
  if(aceBonus){
   const bonus=document.createElement('div');bonus.className='four-combo-title';bonus.textContent='Ace +10 HP';root.append(bonus);
   gsap.set(bonus,{opacity:0});
   tl.to(banner,{opacity:0,duration:.2},quiet?.4:.85)
    .to(bonus,{opacity:1,duration:.2},quiet?.6:1.1)
    .to(bonus,{opacity:0,duration:.2},quiet?1.2:1.75);
  }
  for(let i=0;i<bursts.length;i++){
   const dealt=i===bursts.length-1?damage:bursts[0]*(i+1);
   tl.call(()=>{
    onRapidHit();onHit(dealt);
    if(onFatal&&i===bursts.length-1){
     const defeated=document.querySelector(`.portrait[data-player="${1-attacker}"]`).dataset.defeated;
     if(defeated)avatars[1-attacker].src=defeated;
     onFatal();
    }
   },[],launch+(quiet?0:.38)+i*spacing);
   const shot=document.createElement('span');shot.className='four-combo-shot';shot.textContent=`−${bursts[i]} HP`;root.append(shot);
   if(quiet){
    gsap.set(shot,{left:innerWidth/2+(i%5-2)*48,top:innerHeight*.5+(Math.floor(i%20/5)-2)*30,xPercent:-50,yPercent:-50});
    tl.fromTo(shot,{opacity:0},{opacity:1,duration:.1},launch+i*spacing).to(shot,{opacity:0,duration:.15},launch+i*spacing+.2);
   }else{
    const start=launch+i*spacing,lane=(i%5-2)*14;
    gsap.set(shot,{left:source.x,top:source.y+lane,xPercent:-50,yPercent:-50,opacity:0});
    tl.fromTo(shot,{opacity:0,scale:.6},{opacity:1,scale:1,duration:.07},start)
     .to(shot,{left:target.x,top:target.y+lane,duration:.38,ease:'power2.in'},start)
     .to(shot,{opacity:0,scale:1.35,duration:.15},start+.38);
   }
  }
  const finish=Math.max(2,launch+(bursts.length-1)*spacing+.8);
  tl.to(root,{opacity:0,duration:.35},finish);
  return finish+.35;
 }
 function fatalImpact(){
  const quiet=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flash=document.createElement('div');flash.className='fatal-impact-flash';layer.append(flash);
  timeline(flash).fromTo(flash,{opacity:quiet?.12:.92},{opacity:0,duration:quiet?.4:.65,ease:'power2.out'});
  if(quiet)return;
  // Individual translate preserves layout transforms and includes the cinematic layer.
  for(const element of document.querySelectorAll('.table,.avatar-strip,.combat-effects')){
   const animation=element.animate([{translate:'0 0'},{translate:'-12px 7px'},{translate:'11px -6px'},
    {translate:'-8px 4px'},{translate:'6px -3px'},{translate:'-3px 2px'},{translate:'0 0'}],{duration:520,easing:'ease-out'});
   shakes.add(animation);animation.finished.then(()=>shakes.delete(animation),()=>shakes.delete(animation));
  }
 }
 return {play,fourCombo,fatalImpact,get busy(){return cinematic;},after(seconds,callback){timeline().call(callback,[],seconds);},clear(){onClear();for(const animation of shakes)animation.cancel();shakes.clear();for(const tl of active)tl.kill();active.clear();cinematic=false;layer.replaceChildren();}};
}
