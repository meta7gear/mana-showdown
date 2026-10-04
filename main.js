import {manaIcon,drawManaIcon} from './mana-icons.js';
import {calculateScore,createMatchClock,saveHighScore} from './scoring.js';
import {createLoadedAudio,trackAsset,loadAssets} from './asset-loader.js';
import {createUndoHistory} from './undo.js';
import {createEndGameController} from './end-game.js';
import * as THREE from 'three/webgpu';
import gsap from 'gsap';
import {energyBurst} from './effects.js';
import {createFoundationGlow} from './foundation-glow.js';
import {createCombatEffects} from './combat-effects.js';
import {createDamageAudio} from './damage-audio.js';
import {createSpeechAudio} from './speech-audio.js';
import {decorateBoard} from './decorations.js';
import {createPortraitController} from './portraits.js';
import {portraitFlash, clearPortraitFlash, portraitSpeech, clearPortraitSpeech} from './portrait-effects.js';
import {createIcons, RotateCw, Undo2, Lightbulb, VolumeX, Volume2, CircleHelp, Shuffle} from 'lucide';
import {createOpponent,createAbilityState,abilityReady} from './opponent.js';
import {newGame,pile,movable,canMove,move,draw,hints,MANAS,MANA,charges,spellCost,spellAttack,canCast,castSpell,pullAce,recycleWaste,shuffleStock,MAX_HEALTH} from './game.js';
const icons={RotateCw,Undo2,Lightbulb,VolumeX,Volume2,CircleHelp,Shuffle};
createIcons({icons});
decorateBoard();
const W=1160,H=820,CW=90,CH=126;
const foundationGlow=createFoundationGlow(CW,CH);
const host=document.querySelector('#game-canvas');
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(0,W,0,H,0.1,2000);camera.position.z=1000;
const renderer=new THREE.WebGPURenderer({alpha:true,antialias:true,forceWebGL:new URLSearchParams(window.location.search).has('webgl')});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);
let state=newGame(),history=createUndoHistory(),meshes=new Map(),slots=[],dragging=null,sound=true,audioContext=null,toastTimer;
const backgroundMusic=createLoadedAudio('/bgm/ArcadeRush.m4a');
const victoryMusic=createLoadedAudio('/bgm/victory.m4a');
const defeatMusic=createLoadedAudio('/bgm/defeat.m4a');
for(const track of [backgroundMusic,victoryMusic,defeatMusic]){
 track.loop=true;
 track.preload='auto';
 track.volume=.25;
}
let currentMusic=backgroundMusic,assetsReady=false;
function startBackgroundMusic(){
 if(assetsReady&&sound&&currentMusic.paused)void currentMusic.play().catch(()=>{});
}
function selectMusic(track){
 if(currentMusic!==track){
  currentMusic.pause();currentMusic.currentTime=0;
  currentMusic=track;
 }
 startBackgroundMusic();
}
// Audible autoplay may need a user gesture; keep retrying until playback starts.
for(const event of ['pointerdown','click','keydown'])document.addEventListener(event,e=>{
 if(!e.target.closest?.('#sound'))startBackgroundMusic();
 if(sound){audioContext??=new AudioContext();void audioContext.resume().catch(()=>{});}
});
startBackgroundMusic();
const abilityPlayer=1;
let matchStarted=false;
const matchClock=createMatchClock();
let matchScore=null,matchDifficulty='easy';
const matchDialog=document.querySelector('#match-dialog');

const playerAbilities=[createAbilityState(),createAbilityState()];
const abilityState=playerAbilities[abilityPlayer];
const abilityButtons={
 ace:document.querySelector('[data-ability="ace"]'),
 drawOne:document.querySelector('[data-ability="draw-one"]'),
 shuffle:document.querySelector('[data-ability="shuffle"]')
};
const drawOneProgress=document.querySelector('#draw-one-progress');
const textures=new Map();
const cardAspect={x:1,y:1};
const drawOrigins=new Map();
const speechAudio=createSpeechAudio({enabled:()=>sound,createAudio:createLoadedAudio,onSpeakerChange:player=>{
 for(const panel of document.querySelectorAll('.portrait[data-player]')){
  if(player!==null&&Number(panel.dataset.player)===player)portraitSpeech(panel);
  else clearPortraitSpeech(panel);
 }
}});
const damageAudio=createDamageAudio({enabled:()=>sound,getContext:()=>audioContext??=new AudioContext()});
trackAsset('Damage sounds',damageAudio.ready);
const combatEffects=createCombatEffects({onRapidHit:()=>{void damageAudio.hit({rapid:true});},onClear:()=>damageAudio.stop()});
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const endGame=createEndGameController({show:showWinner,hide:()=>{document.querySelector('#win-dialog').close();selectMusic(backgroundMusic);}});
const portraitImages=new Map();
function loadPortrait(source){
 if(!portraitImages.has(source)){
  const image=new Image();image.src=source;
  portraitImages.set(source,image.decode().catch(error=>{portraitImages.delete(source);throw error;}));
 }
 return portraitImages.get(source);
}
const portraitPanels=[...document.querySelectorAll('.portrait[data-player]')];
const updatePortraits=createPortraitController({panels:portraitPanels,loadImage:loadPortrait,flash:portraitFlash,clearFlash:clearPortraitFlash,reducedMotion:()=>matchMedia('(prefers-reduced-motion: reduce)').matches});
for(const panel of portraitPanels)for(const source of [panel.querySelector('img').getAttribute('src'),panel.dataset.jacketOff,panel.dataset.swimsuit,panel.dataset.defeated].filter(Boolean))trackAsset(source,loadPortrait(source));

function cardSize(ref){return 1;}
function scaleFor(ref,factor=1){const size=cardSize(ref)*factor;return {x:cardAspect.x*size,y:cardAspect.y*size};}
const rounded=new THREE.Shape();
rounded.moveTo(-CW/2+6,-CH/2);rounded.lineTo(CW/2-6,-CH/2);rounded.quadraticCurveTo(CW/2,-CH/2,CW/2,-CH/2+6);rounded.lineTo(CW/2,CH/2-6);rounded.quadraticCurveTo(CW/2,CH/2,CW/2-6,CH/2);rounded.lineTo(-CW/2+6,CH/2);rounded.quadraticCurveTo(-CW/2,CH/2,-CW/2,CH/2-6);rounded.lineTo(-CW/2,-CH/2+6);rounded.quadraticCurveTo(-CW/2,-CH/2,-CW/2+6,-CH/2);
const geometry=new THREE.ShapeGeometry(rounded);
const uv=geometry.attributes.uv,pos=geometry.attributes.position;
for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+CW/2)/CW,1-(pos.getY(i)+CH/2)/CH);
function texture(card,back=false,owner=0,slot=false){
 const key=slot?'slot':back?`back-${owner}`:`${card.kind}-${card.color}-${card.rank}`;
 if(textures.has(key))return textures.get(key);
 const canvas=document.createElement('canvas');canvas.width=270;canvas.height=378;const c=canvas.getContext('2d');
 c.fillStyle=back?'#101b2e':'#edf5ff';c.fillRect(0,0,270,378);
 if(back){
  const accent=owner===0?'#c1d4ed':'#e9c694';
  c.fillStyle=owner===0?'#302e49':'#372936';c.fillRect(0,0,270,378);
  c.strokeStyle=accent;c.lineWidth=2;c.strokeRect(8,8,254,362);c.strokeRect(17,17,236,344);
  c.save();c.translate(135,189);c.strokeStyle=accent;
  for(const r of [87,101,114]){c.beginPath();c.ellipse(0,0,r,r*1.42,0,0,Math.PI*2);c.stroke();}
  c.lineWidth=1;c.globalAlpha=.6;
  for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.beginPath();c.moveTo(0,-164);c.bezierCurveTo(85,-100,25,-60,0,-20);c.bezierCurveTo(-25,-60,-85,-100,0,-164);c.stroke();c.restore();}
  c.globalAlpha=1;c.lineWidth=2;
  c.beginPath();c.moveTo(0,-173);c.lineTo(109,0);c.lineTo(0,173);c.lineTo(-109,0);c.closePath();c.stroke();
  // Symmetric fox-mask crest and filigree, matching the duel's fantasy styling.
  c.fillStyle=accent;c.beginPath();c.moveTo(0,67);c.bezierCurveTo(-19,27,-59,18,-62,-21);c.lineTo(-68,-83);c.lineTo(-30,-42);c.quadraticCurveTo(0,-57,30,-42);c.lineTo(68,-83);c.lineTo(62,-21);c.bezierCurveTo(59,18,19,27,0,67);c.fill();
  c.fillStyle=owner===0?'#302e49':'#372936';
  c.beginPath();c.moveTo(-48,-7);c.quadraticCurveTo(-18,-9,-12,8);c.quadraticCurveTo(-32,14,-48,-7);c.fill();
  c.beginPath();c.moveTo(48,-7);c.quadraticCurveTo(18,-9,12,8);c.quadraticCurveTo(32,14,48,-7);c.fill();
  c.beginPath();c.moveTo(-7,30);c.lineTo(7,30);c.lineTo(0,40);c.closePath();c.fill();
  c.strokeStyle=c.fillStyle;c.beginPath();c.moveTo(0,-40);c.lineTo(-8,-20);c.lineTo(0,-1);c.lineTo(8,-20);c.closePath();c.stroke();
  c.strokeStyle=accent;c.lineWidth=1;
  for(const side of [-1,1]){c.save();c.scale(side,1);c.beginPath();c.moveTo(3,100);c.bezierCurveTo(95,43,104,-54,69,-113);c.bezierCurveTo(92,-102,67,-60,64,-47);c.stroke();c.restore();}
  c.restore();

 }else{
  const ace=card.kind==='ace',red=card.color==='red',ink=red?'#c4253c':'#18202c',suit=red?'♦':'♠';
  c.fillStyle='#fffdf8';c.fillRect(0,0,270,378);
  c.strokeStyle='#b7b4ac';c.lineWidth=2;c.strokeRect(4,4,262,370);c.fillStyle=ink;
  function corner(){c.textAlign='center';c.font='bold 38px Georgia,serif';c.fillText(ace?'A':card.rank,30,43);c.font='29px Georgia,serif';c.fillText(suit,30,73);}
  corner();c.save();c.translate(270,378);c.rotate(Math.PI);corner();c.restore();
  c.textAlign='center';
  if(ace){c.font='125px Georgia,serif';c.fillText(suit,135,230);c.font='24px sans-serif';c.fillText('+10 HP bonus',135,293);}
  else {
   const pips={2:[[.5,0],[.5,1]],3:[[.5,0],[.5,.5],[.5,1]],4:[[0,0],[1,0],[0,1],[1,1]],5:[[0,0],[1,0],[.5,.5],[0,1],[1,1]],6:[[0,0],[1,0],[0,.5],[1,.5],[0,1],[1,1]],7:[[0,0],[1,0],[.5,.25],[0,.5],[1,.5],[0,1],[1,1]],8:[[0,0],[1,0],[.5,.25],[0,.5],[1,.5],[.5,.75],[0,1],[1,1]],9:[[0,0],[1,0],[0,.33],[1,.33],[.5,.5],[0,.67],[1,.67],[0,1],[1,1]],10:[[0,0],[1,0],[.5,.16],[0,.33],[1,.33],[0,.67],[1,.67],[.5,.84],[0,1],[1,1]]};
   c.font='46px Georgia,serif';
   for(const [x,y] of pips[card.rank]){c.save();c.translate(88+x*94,94+y*190);if(y>.5)c.rotate(Math.PI);c.fillText(suit,0,15);c.restore();}
  }


 }
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;textures.set(key,t);return t;
}
function meshFor(id,card,back,owner){
 if(meshes.has(id))return meshes.get(id);
 const material=new THREE.MeshBasicMaterial({map:texture(card,back,owner),side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;
 const shadow=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.18,depthWrite:false}));shadow.position.set(2,5,-.5);mesh.add(shadow);scene.add(mesh);meshes.set(id,mesh);return mesh;
}
function location(ref){
 if(ref.type==='foundation')return {x:location({type:'column',player:1,index:ref.index}).x,y:410};
 const y=ref.player===0?201:664;
 if(ref.type==='stock')return{x:250,y};
 if(ref.type==='waste')return{x:350,y};
 // Keep the full tableau fan inside its player's framed half. The previous
 // centres put the top rail into the shared band and the bottom rail under
 // the board-frame decoration.
 return{x:530+ref.index*160,y:ref.player===0?178:641};
}
// Use the card scene's coordinates for the background outlines as well.
function alignTableauRails(){
 for(let player=0;player<2;player++){
  const rails=document.querySelector(player===0?'.top-rails':'.bottom-rails');
  const size=scaleFor({type:'column',player});
  const width=CW*size.x,height=CH*size.y,padding=6;
  [...rails.children].forEach((rail,index)=>{
   const {x,y}=location({type:'column',player,index});
   rail.dataset.mana=MANA[MANAS[index]].name;
   rail.style.setProperty('--mana-color',MANA[MANAS[index]].color);
   rail.style.left=`${(x-width/2-padding)/W*100}%`;
   rail.style.top=`${(y-height/2-padding)/H*100}%`;
   rail.style.width=`${(width+padding*2)/W*100}%`;
   rail.style.height=`${(height+88+padding*2)/H*100}%`;
  });
 }
}
function makeSlots(){
 const refs=[];
 for(let player=0;player<2;player++){refs.push({type:'stock',player},{type:'waste',player});for(let index=0;index<MANAS.length;index++)refs.push({type:'column',player,index});}
 for(const ref of refs){
  const {x,y}=location(ref);const cv=document.createElement('canvas');cv.width=810;cv.height=1134;const ctx=cv.getContext('2d');ctx.scale(3,3);
  ctx.strokeStyle=ref.type==='foundation'?'#e0e8f3a0':ref.player===0?'#ffe3b5a0':'#adfff2a0';ctx.lineWidth=3;ctx.setLineDash(ref.type==='column'?[9,7]:[]);ctx.beginPath();ctx.roundRect(3,3,264,372,15);ctx.stroke();
  ctx.fillStyle='#d6f5efaa';
  if(ref.type==='column'){ctx.fillStyle={fire:'#ff8b69',earth:'#78dfa2',water:'#7ab9ff',white:'#fff0ca'}[MANAS[ref.index]];drawManaIcon(ctx,MANAS[ref.index],135,189,84);}
  else if(ref.type==='stock'){ctx.textAlign='center';ctx.font='40px Georgia';ctx.fillText('↻',135,210);}
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.position.set(x,y,0);const size=scaleFor(ref);m.scale.set(size.x,size.y,1);if(ref.type==='foundation')m.visible=false;scene.add(m);slots.push({ref,x,y,mesh:m});
 }
}
function layout(animate=true,resetPortraits=false,resultDelay=reducedMotion?1400:2500,deferDefeat=false){
 history.commit(state);
 if(state.winner!==null&&matchScore===null){
  matchClock.finish();
  const result=calculateScore(state.players[abilityPlayer].score,matchClock.seconds(),state.winner===abilityPlayer,matchDifficulty);
  matchScore={...result,...saveHighScore(result.total)};
 }
 endGame.sync(state.winner,resultDelay);
 void updatePortraits(state.players.map(player=>deferDefeat?Math.max(1,player.health):player.health),{animate,reset:resetPortraits});
 const active=new Set();
 function place(id,card,ref,index,x,y,z,back=false){
  active.add(id);const m=meshFor(id,card,back,ref.player),origin=drawOrigins.get(id),wasVisible=m.visible;
  gsap.killTweensOf(m.position);gsap.killTweensOf(m.rotation);gsap.killTweensOf(m.scale);
  // Newly revealed cards start at their pile, never the centre or a stale position.
  if(origin){m.position.set(origin.x,origin.y,20+origin.order);m.rotation.set(0,-.65,-.05);}
  else if(!wasVisible){m.position.set(x,y,z);m.rotation.set(0,0,0);}
  m.userData={ref,index,card,back,x,y,z};m.visible=true;
  const size=scaleFor(ref);if(!wasVisible||origin)m.scale.set(size.x,size.y,1);gsap.to(m.scale,{...size,duration:animate?.25:0});
  if(animate&&!reducedMotion){const delay=origin?origin.order*.065:0;gsap.to(m.position,{x,y,z,duration:origin?.36:.42,delay,ease:'power3.out'});gsap.to(m.rotation,{x:0,y:0,z:0,delay,duration:.45,ease:'power2.out'});}else{m.position.set(x,y,z);m.rotation.set(0,0,0);}
 }
 state.players.forEach((p,player)=>{
  for(const type of ['stock','waste']){
   const ref={type,player},{x,y}=location(ref),cards=p[type];
   if(type==='stock'){if(cards.length)for(let k=0;k<3;k++)place(`stock-${player}-${k}`,null,ref,cards.length-1,x+k*.8,y-k*1.2,2+k*.1,true);}
   if(type==='waste'){const n=Math.min(3,Math.max(1,p.drawn),cards.length);cards.slice(-n).forEach((card,i)=>place(card.id,card,ref,cards.length-n+i,x+i*19,y,5+i));}
  }
  p.columns.forEach((cards,index)=>{const ref={type:'column',player,index},{x,y}=location(ref);const step=Math.min(26,88/Math.max(1,cards.length-1));cards.forEach((card,i)=>place(card.id,card,ref,i,x,y+i*step,5+i));});
  displayHealth(player,p.health);
  const deckCount=document.querySelector(`#stock-${player}`);
  deckCount.textContent=p.stock.length?`${p.stock.length} cards`:'';
  deckCount.style.left=`${location({type:'stock',player}).x/W*100}%`;
  deckCount.style.transform='translateX(-50%)';

 });
 renderSpells();
 for(const [id,m]of meshes)if(!active.has(id))m.visible=false;
 foundationGlow.sync(state,meshes);
 drawOrigins.clear();
 document.querySelector('#moves').textContent=state.moves;document.querySelector('#undo').disabled=!history.canUndo(state);updateAbilityUI();
}
function displayHealth(player,health){
 const hpTotal=document.querySelector(`#hp-total-${player}`),panel=document.querySelector(`#health-panel-${player}`);
 hpTotal.textContent=health;hpTotal.parentElement.setAttribute('aria-label',`${player===0?'Opponent':'Player'}: ${health} HP remaining`);hpTotal.parentElement.classList.toggle('is-critical',health<=25);
 document.querySelector(`#health-${player}`).textContent=health;document.querySelector(`#health-fill-${player}`).style.setProperty('--health',health/MAX_HEALTH);
 const progress=state.combat.lastScorer===player?Math.min(3,state.combat.streak):0;
 const globes=document.querySelector(`#combo-progress-${player}`);
 [...globes.children].forEach((globe,index)=>globe.classList.toggle('is-lit',index<progress));
 globes.title=`${progress} of 3 combo attacks · 2x: +5 HP · 3x: +15 HP`;
 panel.setAttribute('aria-valuenow',health);panel.setAttribute('aria-valuetext',`${health} health remaining; combo progress ${progress} of 3`);panel.classList.toggle('is-critical',health<=25);
}
function notify(message){clearTimeout(toastTimer);const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');toastTimer=setTimeout(()=>el.classList.remove('visible'),3000);}
function beep(win=false){if(!sound)return;audioContext??=new AudioContext();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(win?650:440,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(win?1200:260,audioContext.currentTime+.14);g.gain.setValueAtTime(.06,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.18);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+.2);}
function snapshot(player){history.begin(state,player);}
function burst(ref,winning=false,player=0){energyBurst(scene,location(ref),player,winning,cardAspect);}
function healthFeedback(player,amount,{combo=false,comboText,comboBreakText=null,onFatal,source,heal=amount>0,delay=.42}={}){
 if(!amount&&!heal)return;
 const panel=document.querySelector(`#health-panel-${player}`).getBoundingClientRect();
 const board=host.getBoundingClientRect();
 combatEffects.play({source:{x:board.left+source.x/W*board.width,y:board.top+source.y/H*board.height},
  target:{x:panel.left+panel.width/2,y:panel.top+panel.height/2},amount,combo,comboText,comboBreakText,onFatal,heal,delay});
}
function drawOneActive(player=abilityPlayer,now=Date.now()){return now<playerAbilities[player].drawOne.activeUntil;}
function abilityLabel(button,label,status){const text=`${label} — ${status}`;button.setAttribute('aria-label',text);button.title=text;}
function updateCooldown(button,remaining,total){
 const cooling=remaining>0;button.classList.toggle('is-cooling',cooling);
 button.style.setProperty('--cooldown-progress',cooling?remaining/total:0);
 button.querySelector('.ability-cooldown').textContent=cooling?Math.ceil(remaining/1000):'';
}
function updateAbilityUI(now=Date.now()){
 const player=state.players[abilityPlayer],finished=state.winner!==null;
 const hasAce=player.stock.some(card=>card.kind==='ace');
 const aceRemaining=Math.max(0,abilityState.ace.cooldownUntil-now);
 abilityButtons.ace.disabled=finished||aceRemaining>0||!hasAce;
 updateCooldown(abilityButtons.ace,aceRemaining,abilityState.ace.cooldown);
 abilityLabel(abilityButtons.ace,'Pull an Ace',aceRemaining?`${Math.ceil(aceRemaining/1000)} seconds until ready`:hasAce?'ready':'no Aces available');

 const activeRemaining=Math.max(0,abilityState.drawOne.activeUntil-now);
 const drawCooldownRemaining=Math.max(0,abilityState.drawOne.cooldownUntil-now);
 const active=activeRemaining>0;
 abilityButtons.drawOne.disabled=finished||drawCooldownRemaining>0;
 abilityButtons.drawOne.classList.toggle('is-active',active);
 updateCooldown(abilityButtons.drawOne,drawCooldownRemaining,abilityState.drawOne.cooldown);
 abilityLabel(abilityButtons.drawOne,'Draw one card at a time',active?`active for ${Math.ceil(activeRemaining/1000)} more seconds; ${Math.ceil(drawCooldownRemaining/1000)} seconds until ready`:drawCooldownRemaining?`${Math.ceil(drawCooldownRemaining/1000)} seconds until ready`:'ready');
 drawOneProgress.hidden=!active;
 if(active){
  drawOneProgress.style.setProperty('--ability-progress',activeRemaining/abilityState.drawOne.duration);
  drawOneProgress.querySelector('span').textContent=`${Math.ceil(activeRemaining/1000)}s`;
  drawOneProgress.setAttribute('aria-label',`Draw one ability active for ${Math.ceil(activeRemaining/1000)} more seconds`);
 }else drawOneProgress.setAttribute('aria-label','Draw one ability inactive');

 const shuffleRemaining=Math.max(0,abilityState.shuffle.cooldownUntil-now),canShuffle=player.stock.length+player.waste.length>1;
 abilityButtons.shuffle.disabled=finished||shuffleRemaining>0||!canShuffle;
 updateCooldown(abilityButtons.shuffle,shuffleRemaining,abilityState.shuffle.cooldown);
 abilityLabel(abilityButtons.shuffle,'Shuffle draw deck',shuffleRemaining?`${Math.ceil(shuffleRemaining/1000)} seconds until ready`:canShuffle?'ready':'not enough cards to shuffle');
}
function resetAbilities(){
 for(const abilities of playerAbilities)for(const ability of Object.values(abilities)){ability.cooldownUntil=0;if('activeUntil'in ability)ability.activeUntil=0;}
 updateAbilityUI();
}
function showWinner(player,{result=matchScore,preview=false}={}){
 if(!preview)speechAudio.end(player);
 const format=value=>value.toLocaleString();
 document.querySelector('#final-score').textContent=format(result.total);
 document.querySelector('#high-score').textContent=format(result.highScore);
 document.querySelector('#score-record').hidden=!result.isNewRecord;
 const seconds=Math.floor(result.elapsedSeconds);
 document.querySelector('#match-duration').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 const breakdown=document.querySelector('#score-breakdown');
 breakdown.replaceChildren();
 for(const row of [...result.rows.filter(row=>['tableauCards','centerCards'].includes(row.key)),{label:'Victory speed bonus',count:null,points:result.speedBonus}]){
  const label=document.createElement('dt'),value=document.createElement('dd');
  label.textContent=row.label+(row.count===null?'':` (${row.count})`);
  value.textContent=`+${format(row.points)}`;
  breakdown.append(label,value);
 }
 const name=player===0?'Opponent':'Player';
 document.querySelector('#winner-name').textContent=`${name} Wins`;
 const portrait=document.querySelector(`.portrait[data-player="${player}"] img`);
 const thumbnail=document.querySelector('#winner-avatar');
 thumbnail.dataset.player=player;
 thumbnail.src=portrait.currentSrc||portrait.src;
 thumbnail.alt=`${name} avatar`;
 document.querySelector('#win-dialog').showModal();
 if(!preview)selectMusic(player===abilityPlayer?victoryMusic:defeatMusic);
}
function drawFromStock(player){
 if(combatEffects.busy||dragging||state.winner!==null)return;
 const p=state.players[player];
 if(!p.stock.length&&!p.waste.length)return;
 snapshot(player);
 const origin=location({type:'stock',player});
 const count=drawOneActive(player)?1:3;
 p.stock.slice(-count).reverse().forEach((card,order)=>drawOrigins.set(card.id,{...origin,order}));
 draw(state,player,count);layout();beep();
}

function highlightSpell(index){
 for(const panel of document.querySelectorAll('.spell-card'))panel.classList.toggle('is-target',Number(panel.dataset.spell)===index);
}
function renderCharges(){
 const zone=document.querySelector('#charge-zone');
 for(let player=0;player<2;player++){
  const available=charges(state,player);
  MANAS.forEach((mana,index)=>{
   let badge=zone.querySelector(`[data-charge-player="${player}"][data-mana="${mana}"]`);
   if(!badge){
    badge=document.createElement('div');badge.className='charge-badge';badge.dataset.chargePlayer=player;badge.dataset.mana=mana;
    badge.innerHTML='<div class="electric-charge"><b>0</b></div>';
    badge.style.setProperty('--mana-color',MANA[mana].color);zone.append(badge);
   }
   const position=location({type:'column',player,index}),size=scaleFor({type:'column',player});
   badge.style.left=`${position.x/W*100}%`;badge.style.top=`${(position.y-CH*size.y/2-43)/H*100}%`;
   badge.querySelector('b').textContent=available[mana];badge.setAttribute('aria-label',`${player===1?'Player':'Opponent'} ${MANA[mana].name}: ${available[mana]} charge`);
  });
 }
}
function sparkCharge(player,index,amount){
 const badge=document.querySelector(`[data-charge-player="${player}"][data-mana="${MANAS[index]}"]`);
 if(!badge||amount<=0||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const circle=badge.querySelector('.electric-charge');
 gsap.fromTo(circle,{scale:1.25,filter:'brightness(1.8)'},{scale:1,filter:'brightness(1)',duration:.5,ease:'power2.out',overwrite:true});
 for(let i=0;i<Math.min(28,10+amount*4);i++){
  const spark=document.createElement('i'),angle=Math.random()*Math.PI*2,distance=28+Math.random()*35;
  spark.className='charge-spark';circle.append(spark);
  gsap.fromTo(spark,{x:Math.cos(angle)*16,y:Math.sin(angle)*16,rotation:angle*180/Math.PI,opacity:1,scale:1},{x:Math.cos(angle)*distance,y:Math.sin(angle)*distance,opacity:0,scale:.2,duration:.35+Math.random()*.3,ease:'power2.out',onComplete:()=>spark.remove()});
 }
}
function renderSpells(){
 renderCharges();
 document.querySelector('#spell-zone').innerHTML=MANAS.map((mana,index)=>{
  const sides=state.players.map((p,player)=>{
   const spell=p.spells[index],required=spell.cost.length,available=charges(state,player)[mana];
   const ready=matchStarted&&canCast(state,player,index);
   const effect=spellAttack(state,player,index),amount=spell.heal?effect.heal:effect.damage;
   const pips=Array.from({length:required},(_,i)=>`<i class="${i<available?'is-filled':''}"></i>`).join('');
   return {ready,amount,healing:Boolean(spell.heal),label:`${player===0?'Opponent':'Player'}: ${amount} ${spell.heal?'healing':'damage'}, costs ${required} charges, ${available} available. ${ready?'Ready to cast':'Unavailable'}`,
    meter:`<div class="spell-charge-cost ${ready?'is-ready':''}" data-player="${player}" aria-hidden="true"><b>${required}</b><div class="spell-charge-pips">${pips}</div></div>`};
  });
  const position=location({type:'foundation',index}),ready=sides[1].ready;
  const particles=Array.from({length:6},(_,i)=>`<i style="--particle-angle:${i*60}deg;--particle-delay:${i*-.4}s"></i>`).join('');
  return `<button type="button" class="spell-card ${ready?'is-ready':''}" data-mana="${mana}" style="left:${position.x/W*100}%;top:${position.y/H*100}%" data-spell="${index}" aria-label="${MANA[mana].name}. ${sides.map(side=>side.label).join('. ')}" ${!ready?'disabled':''}><div class="spell-particles" aria-hidden="true">${particles}</div>${sides[0].meter}<div class="spell-center" aria-hidden="true"><div class="spell-sigil">${manaIcon(mana)}</div><div class="spell-effect"><b data-player="0">${sides[0].healing?'+':''}${sides[0].amount}</b><b data-player="1">${sides[1].healing?'+':''}${sides[1].amount}</b></div></div>${sides[1].meter}</button>`;
 }).join('');
}
function perform(from,index,to){
 if(combatEffects.busy||!canMove(state,from,index,to))return false;
 const source=location(from),healthBefore=state.players[from.player].health,chargeBefore=charges(state,from.player)[MANAS[to.index]];
 snapshot(from.player);move(state,from,index,to);layout();beep();
 sparkCharge(from.player,to.index,charges(state,from.player)[MANAS[to.index]]-chargeBefore);
 const mana=MANAS[to.index];notify(`${MANA[mana].name}: ${charges(state,from.player)[mana]} charge.`);
 return true;
}
function performCast(index,player=1){
 if(!matchStarted||dragging||combatEffects.busy||!canCast(state,player,index))return false;
 const healing=Boolean(state.players[player].spells[index].heal),target=healing?player:1-player,before=state.players[target].health,source=location({type:'foundation',index});
 snapshot(player);castSpell(state,player,index);
 const comboBreakText=state.lastCast.comboBreak==='denied'?'Denied':state.lastCast.comboBreak==='break'?'Combo Break':null;
 if(state.lastCast.comboBreak==='break')speechAudio.comboBreak();
 speechAudio.health(state.players);beep(true);
 const damage=before-state.players[target].health,cinematic=state.lastCast.attackStreak===3;
 const onFatal=state.winner!==null?()=>{void updatePortraits(state.players.map(p=>p.health),{animate:false});combatEffects.fatalImpact();}:undefined;
 if(cinematic){
  const duration=combatEffects.fourCombo(player,{damage,aceBonus:state.lastCast.aceBonus>0,onFatal,onHit:hits=>displayHealth(target,before-hits)});
  layout(true,false,(duration+.15)*1000,true);displayHealth(target,before);
 }else{
  layout(true,false,reducedMotion?1400:2500,true);
  if(!healing)void damageAudio.hit({combo:state.lastCast.combo});burst({type:'foundation',index},false,player);
  const comboText=[...(state.lastCast.combo?['2x combo +5 HP']:[]),...(state.lastCast.aceBonus>0?['Ace +10 HP']:[])];
  healthFeedback(target,-damage,{source,heal:healing,combo:state.lastCast.combo||state.lastCast.aceBonus>0,comboText,comboBreakText,onFatal});
 }
 notify(`${MANA[state.lastCast.cost[0]].name} — ${healing ? `${-damage} HP restored` : `${damage} damage`}. Spent cards shuffled into your draw deck.`);
 return true;
}
document.querySelector('#spell-zone').addEventListener('click',event=>{
 const button=event.target.closest('[data-spell]');if(button)performCast(Number(button.dataset.spell));
});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function point(e){const r=host.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
function hit(e){const p=point(e);pointer.set(p.x/W*2-1,1-p.y/H*2);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0]?.object;}
function nearest(p,from,index){return slots.flatMap(s=>{
 if(s.ref.type!=='column'||!pile(state,s.ref).length)return canMove(state,from,index,s.ref)?[{...s,to:s.ref,d:Math.hypot(s.x-p.x,s.y-p.y)}]:[];
 const cards=pile(state,s.ref),step=Math.min(26,88/Math.max(1,cards.length-1)),ends=[{side:'top',y:s.y},{side:'bottom',y:s.y+(cards.length-1)*step}];
 return ends.map(end=>({...s,to:{...s.ref,side:end.side},d:Math.hypot(s.x-p.x,end.y-p.y)})).filter(candidate=>canMove(state,from,index,candidate.to));
 }).filter(s=>s.ref.type==='foundation'?Math.abs(s.x-p.x)<W*.09&&Math.abs(s.y-p.y)<H*.085:s.d<95).sort((a,b)=>a.d-b.d)[0];}
host.addEventListener('pointerdown',e=>{
 if(!matchStarted||combatEffects.busy||e.button!==0||state.winner!==null)return;const m=hit(e),p=point(e);
 if(!m){const s=slots.find(s=>s.ref.type==='stock'&&Math.abs(p.x-s.x)<45&&Math.abs(p.y-s.y)<63);if(s?.ref.player===1){drawFromStock(1);}return;}
 const {ref,index,back}=m.userData;
 if(ref.player!==1)return;
 if(ref.type==='stock'){drawFromStock(ref.player);return;}
 if(back||!movable(state,ref,index))return;
 const cards=pile(state,ref).slice(index),group=cards.map(c=>meshes.get(c.id));
 dragging={ref,index,group,start:p,offset:{x:p.x-m.position.x,y:p.y-m.position.y},m,moved:false};host.setPointerCapture(e.pointerId);host.style.cursor='grabbing';
 group.forEach((obj,i)=>{gsap.killTweensOf(obj.position);gsap.to(obj.position,{z:100+i,duration:.15});gsap.to(obj.scale,{...scaleFor(ref,1.045),duration:.15});});
});
host.addEventListener('pointermove',e=>{
 if(!dragging){const m=hit(e);host.style.cursor=m&&m.userData.ref.player===1&&(m.userData.ref.type==='stock'||(!m.userData.back&&movable(state,m.userData.ref,m.userData.index)))?'grab':'default';return;}
 const p=point(e),d=dragging;d.moved||=Math.hypot(p.x-d.start.x,p.y-d.start.y)>5;
 const x=p.x-d.offset.x,y=p.y-d.offset.y,dx=x-d.m.position.x;
 d.group.forEach((m,i)=>{gsap.to(m.position,{x,y:y+(m.userData.y-d.m.userData.y),z:100+i,duration:.085,overwrite:true});gsap.to(m.rotation,{z:THREE.MathUtils.clamp(dx*.002,-.08,.08),y:THREE.MathUtils.clamp(dx*.004,-.15,.15),duration:.2,overwrite:true});});
 const target=nearest({x,y},d.ref,d.index);highlightSpell(target?.ref.type==='foundation'?target.ref.index:null);slots.forEach(s=>s.mesh.material.color.set(target&&JSON.stringify(target.ref)===JSON.stringify(s.ref)?'#f1d27d':'#ffffff'));
});
function endDrag(e,cancel=false){if(!dragging)return;const d=dragging,p=point(e);dragging=null;highlightSpell(null);d.group.forEach(m=>gsap.to(m.scale,{...scaleFor(m.userData.ref),duration:.25}));slots.forEach(s=>s.mesh.material.color.set('#ffffff'));const to=cancel?null:nearest({x:p.x-d.offset.x,y:p.y-d.offset.y},d.ref,d.index);if(d.moved&&to)perform(d.ref,d.index,to.to);else{layout();if(d.moved&&!cancel)notify('Stack down by number, alternating red and black, to build the column’s mana. Click a ready spell to cast.');}host.style.cursor='grab';}
host.addEventListener('pointerup',e=>endDrag(e));host.addEventListener('pointercancel',e=>endDrag(e,true));
host.addEventListener('dblclick',e=>{const m=hit(e);if(!matchStarted||!m||m.userData.back||m.userData.ref.player!==1||dragging)return;const {ref,index}=m.userData;const target=slots.find(s=>s.ref.type==='column'&&canMove(state,ref,index,s.ref));if(target)perform(ref,index,target.ref);else notify('No tableau placement. Alternate colors and descend by one; Aces count as 1 or 10.');});
function notifyAbility(player,message){notify(`${player===0?'Opponent':'Player'}: ${message}`);}
function useAbility(name,player){return {ace:useAce,drawOne:useDrawOne,shuffle:useShuffle}[name](player);}
function useAce(abilityPlayer){
 const abilityState=playerAbilities[abilityPlayer];
 const notify=message=>notifyAbility(abilityPlayer,message);
 if(combatEffects.busy||dragging||!abilityReady(state,abilityState,'ace',abilityPlayer))return false;
 const healthBefore=state.players[abilityPlayer].health;snapshot(abilityPlayer);const result=pullAce(state,abilityPlayer);
 if(!result){history.cancel();updateAbilityUI();return false;}
 abilityState.ace.cooldownUntil=Date.now()+abilityState.ace.cooldown;
 drawOrigins.set(result.card.id,{...location({type:result.source,player:abilityPlayer}),order:0});
 layout();burst({type:result.source,player:abilityPlayer},false,abilityPlayer);beep(true);
 notify(`Ace pulled from the draw deck.`);
 return true;
}
abilityButtons.ace.onclick=()=>useAbility('ace',abilityPlayer);
function useDrawOne(abilityPlayer){
 const abilityState=playerAbilities[abilityPlayer];
 const notify=message=>notifyAbility(abilityPlayer,message);
 if(combatEffects.busy||dragging||!abilityReady(state,abilityState,'drawOne',abilityPlayer))return false;
 const now=Date.now();snapshot(abilityPlayer);const recycled=recycleWaste(state,abilityPlayer);if(!recycled)history.cancel();
 abilityState.drawOne.activeUntil=now+abilityState.drawOne.duration;abilityState.drawOne.cooldownUntil=now+abilityState.drawOne.cooldown;
 layout();beep(true);notify(recycled?'Waste returned to the deck. Draw One is active for 30 seconds.':'Draw One is active for 30 seconds.');
 return true;
}
abilityButtons.drawOne.onclick=()=>useAbility('drawOne',abilityPlayer);
function useShuffle(abilityPlayer){
 const abilityState=playerAbilities[abilityPlayer];
 const notify=message=>notifyAbility(abilityPlayer,message);
 if(combatEffects.busy||dragging||!abilityReady(state,abilityState,'shuffle',abilityPlayer))return false;
 snapshot(abilityPlayer);
 if(!shuffleStock(state,abilityPlayer,Math.random,drawOneActive(abilityPlayer)?1:3)){history.cancel();updateAbilityUI();return false;}
 abilityState.shuffle.cooldownUntil=Date.now()+abilityState.shuffle.cooldown;
 layout();burst({type:'stock',player:abilityPlayer},false,abilityPlayer);beep(true);notify('Draw deck reshuffled.');
 return true;
}
abilityButtons.shuffle.onclick=()=>useAbility('shuffle',abilityPlayer);
setInterval(()=>updateAbilityUI(),100);
function undo(){if(!matchStarted||dragging||!history.canUndo(state))return;combatEffects.clear();state=history.undo(state);layout();notify('Your last action was undone.');}
document.querySelector('#undo').onclick=undo;
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}});
document.querySelector('#hint').onclick=()=>{
 if(dragging||!matchStarted)return;
 const ready=state.players[1].spells.findIndex((_,index)=>canCast(state,1,index));
 if(ready>=0){const panel=document.querySelector(`[data-spell="${ready}"]`);gsap.fromTo(panel,{filter:'brightness(1.8)'},{filter:'brightness(1)',duration:.7,yoyo:true,repeat:3});notify(`Your ${MANA[state.players[1].spells[ready].cost[0]].name} spell is ready.`);return;}
 const hint=hints(state).find(candidate=>candidate.from.player===1);if(!hint){notify('No tableau moves available. Try drawing or Shuffle.');return;}
 const card=pile(state,hint.from)[hint.index],m=meshes.get(card.id);gsap.fromTo(m.scale,scaleFor(hint.from),{...scaleFor(hint.from,1.1),duration:.4,yoyo:true,repeat:3});
 const slot=slots.find(s=>JSON.stringify(s.ref)===JSON.stringify(hint.to));gsap.fromTo(slot.mesh.material.color,{r:1,g:.75,b:.3},{r:1,g:1,b:1,duration:.7,yoyo:true,repeat:3});
 notify(`Move ${card.color} ${card.kind==='ace'?'Ace (1 or 10)':card.rank} to the ${MANA[MANAS[hint.to.index]].name} column.`);
};
document.querySelector('#sound').onclick=()=>{sound=!sound;if(sound)startBackgroundMusic();else {currentMusic.pause();damageAudio.stop();speechAudio.stop();}const b=document.querySelector('#sound');b.innerHTML=`<i data-lucide="${sound?'volume-2':'volume-x'}"></i>`;b.setAttribute('aria-label',sound?'Mute sound':'Enable sound');b.title=sound?'Mute sound':'Enable sound';createIcons({icons});beep();};
for(const id of ['rules'])document.querySelector(`#${id}`).onclick=()=>document.querySelector('#rules-dialog').showModal();
for(const el of document.querySelectorAll('.close-modal,.close-rules'))el.onclick=()=>document.querySelector('#rules-dialog').close();
function reset(){if(dragging)return;opponent.stop();matchStarted=false;matchClock.reset();matchScore=null;combatEffects.clear();speechAudio.reset();state=newGame();history.clear();resetAbilities();for(const m of meshes.values())m.visible=false;document.querySelector('#win-dialog').close();layout(false,true);matchDialog.showModal();}
const opponent=createOpponent({
 getState:()=>state,play:perform,draw:drawFromStock,cast:performCast,
 getAbilities:()=>playerAbilities[0],useAbility,
 paused:()=>!matchStarted||Boolean(dragging)||combatEffects.busy||Boolean(document.querySelector('dialog[open]'))
});
const matchForm=document.querySelector('#match-form');
const difficultyDescriptions={easy:'Easy: relaxed thinking, with frequent missed moves.',medium:'Medium: steady thinking, with some missed moves.',hard:'Hard: quick thinking, with an occasional missed move.'};
matchForm.addEventListener('change',()=>{document.querySelector('#difficulty-description').textContent=difficultyDescriptions[matchForm.elements.difficulty.value];});
matchDialog.addEventListener('cancel',event=>event.preventDefault());
matchForm.onsubmit=event=>{
 event.preventDefault();if(matchStarted)return;
 matchDifficulty=matchForm.elements.difficulty.value;matchStarted=true;matchClock.start();matchDialog.close();renderSpells();
 opponent.setDifficulty(matchDifficulty);opponent.start();
 notify(`${matchDifficulty[0].toUpperCase()+matchDifficulty.slice(1)} match started.`);
};
document.querySelector('#new-game').onclick=reset;document.querySelector('#play-again').onclick=reset;
const loadingScreen=document.querySelector('#loading');
let loadingFailed=false;
trackAsset('Arena renderer',renderer.init());
trackAsset('Game fonts',Promise.all([document.fonts.load('600 16px Orbitron'),document.fonts.load('500 16px Rajdhani')]));
try{
 await loadAssets(({loaded,total})=>{
  if(loadingFailed)return;
  loadingScreen.querySelector('progress').value=loaded/total;
  loadingScreen.querySelector('.loading-percent').textContent=`${Math.round(loaded/total*100)}%`;
  loadingScreen.querySelector('.loading-status').textContent=`Loading assets · ${loaded} / ${total}`;
 });
 for(const color of ['red','black','white']){for(let rank=2;rank<=10;rank++)texture({color,rank,kind:'number'});texture({color,rank:1,kind:'ace'});}
 texture(null,true,0);texture(null,true,1);
 assetsReady=true;host.appendChild(renderer.domElement);document.querySelector('#renderer-label').textContent=renderer.backend.isWebGPUBackend?'WEBGPU':'WEBGL 2';
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);const ratio=(host.clientHeight/H)/(host.clientWidth/W);cardAspect.x=Math.min(1,ratio);cardAspect.y=Math.min(1,1/ratio);alignTableauRails();for(const s of slots){const size=scaleFor(s.ref);s.mesh.scale.set(size.x,size.y,1);}if(meshes.size&&!dragging)layout(false);};new ResizeObserver(resize).observe(host);resize();makeSlots();layout(false);renderer.setAnimationLoop(time=>{
  foundationGlow.update(time,{reducedMotion,active:matchStarted&&state.winner===null,dragging});
  renderer.render(scene,camera);
 });document.querySelector('#loading').remove();matchDialog.showModal();
 // Console helpers: preview uses sample data and never saves a high score.
 window.showdown={
  getState:()=>structuredClone(state),
  getRenderer:()=>renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2',
  previewResult({difficulty='hard',won=true,seconds=120}={}){
   const stats={tableauCards:18,centerCards:22,lifeCards:10,combos3:4,combos4:2,comboBreakers:2,denied:3};
   const score=calculateScore(stats,seconds,won,difficulty);
   showWinner(won?abilityPlayer:1-abilityPlayer,{preview:true,result:{...score,highScore:score.total,isNewRecord:true}});
   return score;
  },
 };
}catch(error){loadingFailed=true;console.error(error);loadingScreen.querySelector('.loading-status').textContent='Could not load the arena. Check your connection and reload.';loadingScreen.querySelector('.loading-retry').hidden=false;}
