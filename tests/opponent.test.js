import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,castSpell,move,draw,canCast,MAX_HEALTH} from '../game.js';
import {createAbilityState,abilityReady,chooseOpponentAction,createOpponent,DIFFICULTIES} from '../opponent.js';
test('Ace ability recognizes mana Aces and respects cooldown and game over',()=>{
 const s=newGame(),a=createAbilityState();s.players[1].stock=[{kind:'ace',color:'red',rank:1}];assert.equal(abilityReady(s,a,'ace',1,1000),true);a.ace.cooldownUntil=2000;assert.equal(abilityReady(s,a,'ace',1,1000),false);assert.equal(abilityReady(s,a,'ace',1,2000),true);s.winner=0;assert.equal(abilityReady(s,a,'ace',1,2000),false);
});

const run=(length,prefix='run')=>Array.from({length},(_,i)=>({id:`${prefix}-${i}`,rank:9-i,kind:'number',color:i%2?'black':'red',player:0}));
function readyState(){const s=newGame();s.players[0].columns[0]=run(4);return s;}
test('heals only below 40 HP',()=>{
 const s=newGame();s.players[0].columns[3]=run(4);
 assert.notEqual(chooseOpponentAction(s).type,'cast');
 s.players[0].health=39;
 assert.deepEqual(chooseOpponentAction(s),{type:'cast',index:3,player:0});
});
test('lethal damage takes priority over healing',()=>{
 const s=readyState();s.players[0].health=1;s.players[0].columns[3]=run(4,'life');s.players[1].health=5;
 assert.deepEqual(chooseOpponentAction(s),{type:'cast',index:0,player:0});
});
test('lethal calculation includes additive Ace and combo bonuses',()=>{
 const s=readyState();s.players[0].columns[0]=[{id:'ace',kind:'ace',rank:1,color:'red',player:0},...run(3).map((c,i)=>({...c,color:i%2?'red':'black'}))];
 s.combat={lastScorer:0,streak:2};s.players[1].health=30;s.players[0].health=1;s.players[0].columns[3]=run(4,'life');
 const action=chooseOpponentAction(s);assert.equal(action.index,0);castSpell(s,0,action.index);assert.equal(s.winner,0);
});
test('finds lethal sequences including a flat combo bonus',()=>{
 const s=readyState();s.players[0].columns[1]=run(4,'earth');s.players[0].spells[1].damage=20;s.combat={lastScorer:0,streak:1};s.players[1].health=40;
 const before=structuredClone(s);assert.equal(chooseOpponentAction(s).index,0);assert.deepEqual(s,before);
 castSpell(s,0,0);const next=chooseOpponentAction(s);assert.equal(next.index,1);castSpell(s,0,1);assert.equal(s.winner,0);
});
test('can move a charged Life run to an empty attack column for lethal',()=>{
 const s=newGame();s.players[0].columns[3]=run(4);s.players[1].health=5;
 const action=chooseOpponentAction(s);assert.equal(action.type,'move');assert.equal(action.to.index,0);
});
test('does not repeat previously visited column layouts',()=>{
 const s=newGame();s.players[0].columns[3]=run(4);const seen=new Set();
 const action=chooseOpponentAction(s,seen);assert.equal(action.type,'move');
 assert.equal(chooseOpponentAction(s,new Set([...seen,JSON.stringify([run(4).map(c=>c.id),[],[],[]])])).to.index,1);
});
for(const [difficulty,min,max,miss] of [['easy',1800,4000,.2],['medium',1500,3500,.15],['hard',400,1500,.05]]){
 test(`${difficulty} preserves decision delays and missed-turn timing`,()=>{
  assert.deepEqual(DIFFICULTIES[difficulty],{minDelay:min,maxDelay:max,missChance:miss});
  const s=readyState();let value=0,callback,delay,casts=0,canceled=0;
  const ai=createOpponent({getState:()=>s,difficulty,random:()=>value,schedule:(fn,ms)=>{callback=fn;delay=ms;return 1;},cancel:()=>canceled++,cast:()=>{casts++;return true;}});
  ai.start();assert.equal(delay,min);value=miss-.01;callback();assert.equal(casts,0);assert.equal(delay,min+value*(max-min));
  value=miss;callback();assert.equal(casts,1);value=1;callback();assert.equal(delay,max);ai.stop();assert.equal(canceled,1);
 });
}
test('controller pauses, changes difficulty, and stops after victory',()=>{
 const s=readyState();let paused=true,callback,delay,calls=0,queued=0;
 const ai=createOpponent({getState:()=>s,paused:()=>paused,random:()=>.5,schedule:(fn,ms)=>{callback=fn;delay=ms;queued++;return queued;},cancel:()=>{},cast:()=>{calls++;s.winner=0;return true;}});
 ai.start();callback();assert.equal(calls,0);ai.setDifficulty('easy');assert.equal(delay,2900);const before=queued;paused=false;callback();assert.equal(calls,1);assert.equal(queued,before);assert.equal(chooseOpponentAction(s),null);
});
test('UI wires up selectable difficulty and AI lifecycle',()=>{
 const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(main,/createOpponent\(/);assert.match(main,/opponent\.start\(/);assert.match(main,/opponent\.stop\(/);
 for(const difficulty of Object.keys(DIFFICULTIES))assert.ok(html.includes(`value="${difficulty}"`));
});

test('takes an immediate lethal spell before a longer winning sequence',()=>{
 const s=readyState();s.players[0].columns[1]=run(4,'earth');s.players[0].spells[1].damage=20;s.players[1].health=20;
 assert.equal(chooseOpponentAction(s).index,1);
});

test('draws instead of moving a lone tableau card between empty columns',()=>{
 const s=newGame();s.players[0].columns[0]=run(1);
 assert.deepEqual(chooseOpponentAction(s),{type:'draw',player:0});
});
test('draws instead of merging runs that still fall short of the spell cost',()=>{
 const s=newGame();s.players[0].columns[0]=run(2);s.players[0].columns[1]=run(3).slice(2);
 assert.deepEqual(chooseOpponentAction(s),{type:'draw',player:0});
});
test('merges tableau runs when that unlocks an immediate cast',()=>{
 const s=newGame();s.players[0].columns[0]=run(2);s.players[0].columns[1]=run(4).slice(2);
 const a=chooseOpponentAction(s);assert.equal(a.type,'move');assert.equal(a.from.type,'column');
 move(s,a.from,a.index,a.to);assert.equal(canCast(s,0,a.to.index),true);
 const next=chooseOpponentAction(s);assert.equal(next.type,'cast');assert.equal(next.index,a.to.index);
});
test('does not relocate a run for a heal at full health',()=>{
 const s=newGame();s.players[0].columns[0]=run(4);
 for(let i=0;i<3;i++)s.players[0].spells[i].cost=Array(5).fill(['fire','earth','water'][i]);
 assert.deepEqual(chooseOpponentAction(s),{type:'draw',player:0});
 s.players[0].health=39;const a=chooseOpponentAction(s);assert.equal(a.type,'move');assert.equal(a.to.index,3);
});
test('places waste cards toward the current spell cost rather than the largest stack',()=>{
 const s=newGame();s.players[0].spells[0].cost=Array(9).fill('fire');s.players[0].columns[0]=run(7).slice(0,6);s.players[0].columns[1]=run(6).slice(3);
 s.players[0].waste=run(7).slice(6);
 const a=chooseOpponentAction(s);assert.equal(a.from.type,'waste');assert.equal(a.to.index,1);
});
test('continues drawing and building a spell without shuffling partial runs',()=>{
 const s=newGame();s.players[0].stock=run(4).reverse();s.players[0].waste=[];const seen=new Set();
 for(let turn=0;turn<4;turn++){
  assert.equal(chooseOpponentAction(s,seen).type,'draw');draw(s,0,1);
  const a=chooseOpponentAction(s,seen);assert.equal(a.type,'move');assert.equal(a.from.type,'waste');assert.equal(a.to.index,0);
  move(s,a.from,a.index,a.to);seen.clear();
 }
 assert.equal(chooseOpponentAction(s,seen).type,'cast');
});

test('AI uses its own spell cost and damage after player progression diverges',()=>{
 const s=readyState();s.players[1].spells[0].cost=Array(9).fill('fire');s.players[1].spells[0].damage=50;s.players[1].health=5;
 const action=chooseOpponentAction(s);assert.deepEqual(action,{type:'cast',index:0,player:0});
 castSpell(s,0,0);assert.equal(s.winner,0);assert.equal(s.lastCast.damage,5);assert.equal(s.players[1].spells[0].cost.length,9);
});

for(const health of [40,41,80,99,MAX_HEALTH])test(`AI ignores healing at ${health} HP even with a ready Life spell`,()=>{
 const s=readyState();s.players[0].health=health;s.players[0].columns[3]=run(4,'life');
 assert.deepEqual(chooseOpponentAction(s),{type:'cast',index:0,player:0});
 s.players[0].columns[0]=[];
 assert.notEqual(chooseOpponentAction(s).type,'cast');
});
test('below 40 HP, healing takes priority over a nonlethal attack',()=>{
 const s=readyState();s.players[0].health=39;s.players[0].columns[3]=run(4,'life');s.players[0].spells[0].damage=50;
 assert.deepEqual(chooseOpponentAction(s),{type:'cast',index:3,player:0});
 castSpell(s,0,3);assert.equal(s.players[0].health,49);
 s.players[0].columns[3]=run(4,'life-again');
 assert.deepEqual(chooseOpponentAction(s),{type:'cast',index:0,player:0});
});
test('Life stack building is preferred only below 40 HP',()=>{
 const s=newGame();s.players[0].columns[0]=run(2,'fire');s.players[0].columns[3]=run(2,'life');s.players[0].waste=run(3,'waste').slice(2);
 s.players[0].health=39;assert.equal(chooseOpponentAction(s).to.index,3);
 s.players[0].health=40;assert.equal(chooseOpponentAction(s).to.index,0);
});
