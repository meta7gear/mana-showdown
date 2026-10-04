import {createScoreStats,recordScoreMove} from './scoring.js';
export const MANAS = ['fire','earth','water','white'];
export const MANA = {fire:{name:'Fire',color:'#df4949'},earth:{name:'Earth',color:'#45be78'},water:{name:'Water',color:'#2859b9'},white:{name:'Life',color:'#f5eddc'}};
export const MAX_HEALTH = 100;
// Prototype spell costs and damage.
export const SPELLS = [
 {id:'mend',name:'Mend',cost:Array(4).fill('white'),heal:10,damage:0},
 ...[
  ['fire',['spark','wildfire','inferno','firestorm','supernova','cataclysm'],['Spark','Wildfire','Inferno','Firestorm','Supernova','Cataclysm']],
  ['earth',['thorn','roots','quake','landslide','tectonic','worldbreaker'],['Thorn Strike','Root Surge','Earthquake','Landslide','Tectonic Surge','Worldbreaker']],
  ['water',['torrent','tidal','maelstrom','tsunami','oceanwrath','deluge'],['Torrent','Tidal Surge','Maelstrom','Tsunami','Ocean Wrath','Deluge']],
 ].flatMap(([mana,ids,names])=>[[4,5],[5,10],[6,20],[7,30],[8,40],[9,50]].map(([cost,damage],i)=>({id:ids[i],name:names[i],cost:Array(cost).fill(mana),damage}))),
];
function nextSpell(spell){
 if(spell.cost[0]==='white')return structuredClone(spell);
 const tiers=SPELLS.filter(candidate=>candidate.cost[0]===spell.cost[0]);
 return structuredClone(tiers.find(candidate=>candidate.cost.length>spell.cost.length)??tiers.at(-1));
}
export function newGame(random = Math.random) {
 const players=[0,1].map(player=>{
  const deck=['black','red'].flatMap(color=>Array.from({length:18},(_,i)=>{const rank=1+i%9;return {id:`${player}-${color}-${i}`,kind:rank===1?'ace':'number',color,rank,player};}));
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  const columns=MANAS.map(()=>[]);
  return {columns,stock:deck,waste:[],drawn:0,health:MAX_HEALTH,spells:MANAS.map(mana=>structuredClone(SPELLS.find(spell=>spell.cost[0]===mana))),score:createScoreStats()};
 });
 return {players,lastCast:null,combat:{lastScorer:null,streak:0},moves:0,winner:null,winReason:null};
}
export function pile(state,ref){return ref.type==='column'?state.players[ref.player].columns[ref.index]:state.players[ref.player][ref.type];}
const samePile=(a,b)=>a.type===b.type&&a.player===b.player&&a.index===b.index;
// Every tableau card stores one charge.
export function charges(state,player){return Object.fromEntries(MANAS.map((mana,index)=>[mana,state.players[player].columns[index]?.length ?? 0]));}
export function spellCost(spell){return Object.fromEntries(MANAS.map(mana=>[mana,spell.cost.filter(m=>m===mana).length]));}
export function spellAttack(state,player,index){
 const spell=state.players[player].spells[index],cost=spellCost(spell);
 const hasAce=MANAS.some((mana,i)=>cost[mana]&&state.players[player].columns[i].slice(-cost[mana]).some(card=>card.kind==='ace'));
 const attackStreak=spell.heal?0:state.combat.lastScorer===player?state.combat.streak+1:1;
 const combo=attackStreak===2||attackStreak===3,aceBonus=hasAce?10:0,comboBonus=attackStreak===3?15:attackStreak===2?5:0;
 const interrupted=!spell.heal&&state.combat.lastScorer!==null&&state.combat.lastScorer!==player;
 const comboBreak=interrupted?(state.combat.streak===1?'denied':state.combat.streak===2?'break':null):null;
 return {damage:spell.heal?0:spell.damage+aceBonus+comboBonus,heal:spell.heal?spell.heal+aceBonus:0,aceBonus,comboBonus,combo,attackStreak,comboBreak};
}
export function canCast(state,player,index){
 if(state.winner!==null||!state.players[player]||!state.players[player].spells[index])return false;
 const available=charges(state,player),cost=spellCost(state.players[player].spells[index]);
 return MANAS.every((mana,i)=>!cost[mana]||(cost[mana]>=4&&available[mana]>=cost[mana]&&validRun(state.players[player].columns[i])));
}
export function castSpell(state,player,index,random=Math.random){
 if(!canCast(state,player,index))return false;
 const p=state.players[player],spell=state.players[player].spells[index],cost=spellCost(spell),attack=spellAttack(state,player,index);
 const returned=MANAS.flatMap((mana,i)=>{
  if(!cost[mana])return [];
  const column=p.columns[i],cards=column.splice(-cost[mana]);
  return cards;
 });
 p.stock.push(...returned);
 for(let i=p.stock.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[p.stock[i],p.stock[j]]=[p.stock[j],p.stock[i]];}
 p.score.centerCards+=spell.cost.length;
 state.lastCast={...structuredClone(spell),...attack,player,index};state.moves++;
 const opponent=state.players[1-player];
 if(spell.heal)p.health=Math.min(MAX_HEALTH,p.health+attack.heal);
 else {
  opponent.health=Math.max(0,opponent.health-attack.damage);
  if(attack.comboBreak==='break')p.score.comboBreakers++;
  // Keep the completed attack in lastCast for its cinematic, then start a fresh cycle.
  state.combat.lastScorer=attack.attackStreak===3?null:player;
  state.combat.streak=attack.attackStreak===3?0:attack.attackStreak;
  if(attack.attackStreak===2)p.score.combos3++;
  if(attack.attackStreak===3)p.score.combos4++;
 }
 state.players[player].spells[index]=nextSpell(spell);
 if(!opponent.health){state.winner=player;state.winReason='health';}
 return true;
}
// Check a whole run so an Ace cannot act as both 1 and 10 within one stack.
export function validRun(cards){
 if(!cards.length)return true;
 if(cards.some(card=>!['red','black'].includes(card.color)||!Number.isInteger(card.rank)||card.rank<1||card.rank>9))return false;
 const values=card=>card.kind==='ace'?[1,10]:[card.rank];
 return values(cards[0]).some(start=>['red','black'].some(first=>cards.every((card,index)=>
  values(card).includes(start-index)&&card.color===(index%2?(first==='red'?'black':'red'):first))));
}
export function movable(state,ref,index){
 if(!['column','waste'].includes(ref.type))return false;
 const cards=pile(state,ref);
 if(state.winner!==null||index<0||index>=cards.length)return false;
 if(ref.type!=='column')return index===cards.length-1;
 return validRun(cards.slice(index));
}
export function canMove(state,from,index,to){
 if(!movable(state,from,index)||samePile(from,to))return false;
 const source=pile(state,from);
 if(to.type!=='column'||from.player!==to.player||!Number.isInteger(to.index)||to.index<0||to.index>=MANAS.length)return false;
 const dest=pile(state,to);if(!dest.length)return true;
 const run=source.slice(index),top=validRun([...run,...dest]),bottom=validRun([...dest,...run]);
 return to.side==='top'?top:to.side==='bottom'?bottom:top||bottom;
}
export function move(state,from,index,to){
 if(!canMove(state,from,index,to))return false;
 const cards=pile(state,from).splice(index),dest=pile(state,to);
 recordScoreMove(state.players[from.player].score,cards,from,to,state.combat);
 const addToTop=to.type==='column'&&dest.length&&(to.side==='top'||(to.side!=='bottom'&&!validRun([...dest,...cards])));
 if(addToTop)dest.unshift(...cards);else dest.push(...cards);
 state.moves++;state.lastCast=null;

 return true;
}
export function draw(state,player,count=3){
  if(state.winner!==null)return false;
  const p=state.players[player];
  if(!p.stock.length){if(!p.waste.length)return false;recycleWaste(state,player);}
  else {p.drawn=Math.min(count,p.stock.length);for(let i=0;i<p.drawn;i++)p.waste.push(p.stock.pop());}
  state.moves++;return true;
}
export function recycleWaste(state,player){
  const p=state.players[player];
  if(!p.waste.length)return false;
  p.stock=[...p.waste.reverse(),...p.stock];p.waste=[];p.drawn=0;return true;
}
export function pullAce(state,player){
  if(state.winner!==null)return false;
  const p=state.players[player];
  const stockIndex=p.stock.findLastIndex(card=>card.kind==='ace');
  if(stockIndex<0)return false;
  const [card]=p.stock.splice(stockIndex,1);p.waste.push(card);p.drawn=1;state.moves++;
  return {card,source:'stock'};
}
export function shuffleStock(state,player,random=Math.random,drawCount=3){
 if(state.winner!==null)return false;
 const p=state.players[player],stock=[...p.stock,...p.waste];
 if(stock.length<2)return false;
 for(const cards of [stock])for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
 if(random()<.25){
  const preview=structuredClone(state),from={type:'waste',player};
  const options=[{cards:stock,target:stock.length-Math.min(drawCount,stock.length)}].filter(option=>option.cards.length);
  const candidates=options.flatMap(option=>option.cards.flatMap((card,index)=>{
   preview.players[player].waste=[card];
   return p.columns.some((_,i)=>canMove(preview,from,0,{type:'column',player,index:i}))?[{...option,index}]:[];
  }));
  if(candidates.length){const {cards,index,target}=candidates[Math.floor(random()*candidates.length)];[cards[index],cards[target]]=[cards[target],cards[index]];}
 }
 p.stock=stock;p.waste=[];p.drawn=0;state.moves++;return true;
}
export function hints(state){
  const results=[];
  state.players.forEach((p,player)=>{
    const sources=[{type:'waste',player},...p.columns.map((_,index)=>({type:'column',player,index}))];
    const targets=[...p.columns.map((_,index)=>({type:'column',player,index}))];
    for(const from of sources)for(let i=0;i<pile(state,from).length;i++)for(const to of targets)if(canMove(state,from,i,to)&&!(from.type==='column'&&i===0&&to.type==='column'&&!pile(state,to).length))results.push({from,index:i,to});
  });return results;
}
