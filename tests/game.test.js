import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,draw,move,canMove,pullAce,shuffleStock,charges,castSpell,validRun,hints,MANAS,SPELLS,canCast,spellAttack} from '../game.js';
let id=0;
const card=(rank,color=rank%2?'red':'black')=>({id:`test-${id++}`,rank,color,kind:rank===1?'ace':'number',player:1});
const waste={type:'waste',player:1},column=index=>({type:'column',player:1,index});
const ids=s=>s.players.flatMap(p=>[...p.stock,...p.waste,...p.columns.flat()]).map(c=>c.id).sort();
test('36-card decks contain only A–9 in two suits and start with four empty columns',()=>{
 const s=newGame();assert.equal(new Set(ids(s)).size,72);
 for(const p of s.players){assert.equal(p.stock.length,36);assert.equal('life' in p,false);assert.deepEqual(p.columns,[[],[],[],[]]);
 for(const color of ['red','black'])for(let rank=1;rank<=9;rank++)assert.equal(p.stock.filter(c=>c.color===color&&c.rank===rank).length,2);}
 assert.deepEqual(s.players[1].spells.map(s=>s.cost[0]),MANAS);
});
test('draw and recycle preserve deck order',()=>{const s=newGame(),original=[...s.players[1].stock];while(s.players[1].stock.length)draw(s,1);draw(s,1);assert.deepEqual(s.players[1].stock,original);});
for(let i=0;i<4;i++)test(`column ${i} generates a charge for every card`,()=>{
 const s=newGame();s.players[1].waste=[card(5)];assert.equal(move(s,waste,0,column(i)),true);assert.equal(charges(s,1)[MANAS[i]],1);
 s.players[1].waste=[card(4)];assert.equal(move(s,waste,0,column(i)),true);assert.equal(charges(s,1)[MANAS[i]],2);
 s.players[1].waste=[card(6)];assert.equal(move(s,waste,0,{...column(i),side:'top'}),true);
 assert.deepEqual(s.players[1].columns[i].map(c=>c.rank),[6,5,4]);
});
test('Aces serve as 10 or 1 without wrapping; removed ranks and hearts are rejected',()=>{
 assert.equal(validRun([card(1,'black'),card(9,'red'),card(8,'black')]),true);
 assert.equal(validRun([card(3,'red'),card(2,'black'),card(1,'red')]),true);
 assert.equal(validRun([card(2,'black'),card(1,'red'),card(9,'black')]),false);
 assert.equal(validRun([card(10)]),false);assert.equal(validRun([card(7,'white')]),false);
 const s=newGame();s.players[1].columns[0]=[card(9,'red')];s.players[1].waste=[card(1,'black')];assert.equal(move(s,waste,0,column(0)),true);
});
test('invalid colors, gaps, opponent destinations and direct spell payments fail',()=>{
 const s=newGame();s.players[1].columns[0]=[card(5,'red')];for(const c of [card(4,'red'),card(3,'black')]){s.players[1].waste=[c];assert.equal(canMove(s,waste,0,column(0)),false);}
 assert.equal(canMove(s,waste,0,{type:'column',player:0,index:0}),false);assert.equal(canMove(s,waste,0,{type:'foundation',index:0}),false);
 const before=structuredClone(s);assert.equal(castSpell(s,1,0),false);assert.deepEqual(s,before);
});
test('moving runs redistributes charge without creating cards or mana',()=>{
 const s=newGame();s.players[1].columns[0]=[card(7),card(6),card(5)];const before=ids(s);
 assert.equal(move(s,column(0),1,column(3)),true);assert.deepEqual(charges(s,1),{fire:1,earth:0,water:0,white:2});assert.deepEqual(ids(s),before);
});
test('casting spends exact card cost, preserves unused charge and replaces only its slot',()=>{
 const s=newGame();s.players[1].spells[0]={id:'test',name:'Test',cost:Array(4).fill('fire'),damage:5};s.players[1].columns[0]=[7,6,5,4,3,2,1].map(rank=>card(rank));const before=ids(s),stock=s.players[1].stock.length,others=structuredClone(s.players[1].spells.slice(1));
 assert.equal(castSpell(s,1,0,()=>0),true);assert.equal(charges(s,1).fire,3);assert.equal(s.players[1].stock.length,stock+4);assert.equal(s.players[0].health,85);assert.deepEqual(ids(s),before);assert.deepEqual(s.players[1].spells.slice(1),others);
 s.players[1].spells[0]=structuredClone(SPELLS.find(spell=>spell.cost[0]==='fire'&&spell.cost.length===4));s.players[1].waste=[card(8)];move(s,waste,0,column(0));castSpell(s,1,0);assert.deepEqual(s.players[1].columns[0],[]);
});
test('Life heals its caster, caps HP and returns spent cards',()=>{
 const s=newGame();s.players[1].health=95;s.players[1].columns[3]=[7,6,5,4].map(rank=>card(rank));s.players[1].spells[3]={id:'test',name:'Mend',cost:Array(4).fill('white'),heal:10,damage:0};const before=ids(s);
 assert.equal(castSpell(s,1,3),true);assert.equal(s.players[1].health,100);assert.equal(s.players[0].health,100);assert.deepEqual(s.players[1].columns[3],[]);assert.equal(s.players[1].spells[3].cost[0],'white');assert.deepEqual(ids(s),before);
});
test('lethal damage wins and locks actions',()=>{const s=newGame();s.players[0].health=5;s.players[1].columns[0]=[7,6,5,4].map(rank=>card(rank));s.players[1].spells[0]={id:'test',cost:Array(4).fill('fire'),damage:5};castSpell(s,1,0);assert.equal(s.winner,1);assert.equal(draw(s,1),false);assert.deepEqual(hints(s),[]);});
test('Ace pull uses only stock; shuffle conserves cards and charge',()=>{const s=newGame();s.players[1].columns[3]=[card(7)];draw(s,1);const before=ids(s),charge=charges(s,1);shuffleStock(s,1,()=>.1);assert.deepEqual(ids(s),before);assert.deepEqual(charges(s,1),charge);assert.equal(pullAce(s,1).source,'stock');s.players[1].stock=[];assert.equal(pullAce(s,1),false);});

for(const mana of MANAS.slice(0,3))for(const [cost,damage] of [[4,5],[5,10],[6,20],[7,30],[8,40],[9,50]])test(`${mana}: ${cost}-card run deals ${damage} damage`,()=>{
 const s=newGame(),index=MANAS.indexOf(mana);s.players[1].spells[index]=structuredClone(SPELLS.find(spell=>spell.cost[0]===mana&&spell.cost.length===cost));
 s.players[1].columns[index]=Array.from({length:cost-1},(_,i)=>card(9-i));assert.equal(canCast(s,1,index),false);
 s.players[1].columns[index]=Array.from({length:cost},(_,i)=>card(9-i));const before=ids(s);assert.equal(castSpell(s,1,index),true);assert.equal(s.players[0].health,100-damage-(cost===9?10:0));assert.deepEqual(s.players[1].columns[index],[]);assert.deepEqual(ids(s),before);
});
test('every spell requires at least four cards and invalid runs cannot cast',()=>{
 assert.ok(SPELLS.every(spell=>spell.cost.length>=4));const s=newGame();s.players[1].spells[0]=structuredClone(SPELLS.find(spell=>spell.cost[0]==='fire'&&spell.cost.length===4));
 s.players[1].columns[0]=[9,8,7].map(rank=>card(rank));assert.equal(canCast(s,1,0),false);
 s.players[1].columns[0]=[9,7,6,5].map(rank=>card(rank));assert.equal(canCast(s,1,0),false);
 s.players[1].spells[0].cost=['fire'];assert.equal(canCast(s,1,0),false);
});

test('spell slots start at their first tier regardless of randomness',()=>{
 for(const roll of [0,.5,.99]){const s=newGame(()=>roll);assert.deepEqual(s.players[1].spells.map(spell=>spell.cost.length),[4,4,4,4]);assert.deepEqual(s.players[1].spells.map(spell=>spell.damage),[5,5,5,0]);assert.equal(s.players[1].spells[3].heal,10);}
});
for(const mana of MANAS.slice(0,3))for(const player of [0,1])test(`${mana} grows independently for player ${player} and stays at the final tier`,()=>{
 const s=newGame(),index=MANAS.indexOf(mana),other=structuredClone(s.players[1-player].spells),others=structuredClone(s.players[player].spells.filter((_,i)=>i!==index));
 for(const [turn,cost] of [4,5,6,7,8,9,9].entries()){
  assert.equal(s.players[player].spells[index].cost.length,cost);
  s.players[player].columns[index]=Array.from({length:cost},(_,i)=>({...card(9-i),player}));s.players[1-player].health=100;s.combat={lastScorer:null,streak:0};
  assert.equal(castSpell(s,player,index),true);assert.equal(s.players[player].spells[index].cost.length,[5,6,7,8,9,9,9][turn]);
  assert.deepEqual(s.players[player].spells.filter((_,i)=>i!==index),others);assert.deepEqual(s.players[1-player].spells,other);
 }
});
test('Life keeps the same spell after repeated casts',()=>{
 const s=newGame(),original=structuredClone(s.players[1].spells[3]);
 for(let i=0;i<3;i++){s.players[1].health=50;s.players[1].columns[3]=[7,6,5,4].map(rank=>card(rank));assert.equal(castSpell(s,1,3),true);assert.equal(s.players[1].health,60);assert.deepEqual(s.players[1].spells[3],original);}
});

for(const player of [0,1])test(`player ${player} gets one Ace bonus on damage, preserving cards`,()=>{
 const s=newGame();s.players[player].columns[0]=[4,3,2,1].map(rank=>({...card(rank),player}));const before=ids(s);
 assert.equal(castSpell(s,player,0),true);assert.equal(s.players[1-player].health,85);assert.equal(s.lastCast.aceBonus,10);assert.equal(s.lastCast.damage,15);assert.deepEqual(ids(s),before);
});
test('an unspent high Ace gives no bonus',()=>{
 const s=newGame();s.players[1].columns[0]=[card(1,'black'),card(9),card(8),card(7),card(6)];castSpell(s,1,0);assert.equal(s.lastCast.aceBonus,0);assert.equal(s.players[0].health,95);assert.equal(s.players[1].columns[0][0].kind,'ace');
});
test('Life casts containing a spent Ace heal an extra 10 HP',()=>{
 const s=newGame();s.players[1].health=50;s.players[1].columns[3]=[4,3,2,1].map(rank=>card(rank));castSpell(s,1,3);assert.equal(s.players[1].health,70);assert.equal(s.players[0].health,100);assert.equal(s.lastCast.aceBonus,10);assert.equal(s.lastCast.heal,20);assert.equal(s.lastCast.damage,0);
});
test('Ace bonus adds exactly 10 damage at every tier',()=>{
 for(const [cost,damage] of [[4,5],[5,10],[6,20],[7,30],[8,40],[9,50]]){
  const s=newGame();s.players[1].spells[0]=structuredClone(SPELLS.find(spell=>spell.cost[0]==='fire'&&spell.cost.length===cost));s.players[1].columns[0]=Array.from({length:cost},(_,i)=>card(cost-i));castSpell(s,1,0);assert.equal(s.lastCast.damage,damage+10);assert.equal(s.players[0].health,100-damage-10);
 }
});

function attack(s,player,index=0,ace=false){
 const cost=s.players[player].spells[index].cost.length;
 s.players[player].columns[index]=Array.from({length:cost},(_,i)=>({...card((ace?cost:9)-i),player}));
 s.players[1-player].health=100;
 assert.equal(castSpell(s,player,index),true);
 return s.lastCast;
}
for(const player of [0,1])test(`player ${player}'s second consecutive attack receives a +5 damage combo`,()=>{
 const s=newGame();
 for(let i=0;i<4;i++){
  const base=s.players[player].spells[0].damage,cast=attack(s,player);
  assert.equal(cast.combo,i===1||i===2);assert.equal(cast.damage,base+(i===2?15:i===1?5:0));assert.equal(s.combat.streak,(i+1)%3);
 }
 assert.equal(s.players[player].score.combos3,1);
});
test('an opponent attack interrupts the streak and each player can build a fresh combo',()=>{
 const s=newGame();attack(s,1);attack(s,1);assert.equal(attack(s,0).combo,false);assert.deepEqual(s.combat,{lastScorer:0,streak:1});
 assert.equal(attack(s,1).combo,false);assert.equal(attack(s,1).combo,true);assert.equal(attack(s,1).combo,true);
});
test('draw, move, healing and a failed cast do not advance or interrupt attack streaks',()=>{
 const s=newGame();attack(s,1);attack(s,1);const before=structuredClone(s.combat);
 draw(s,0);s.players[0].waste=[card(7)];move(s,{type:'waste',player:0},0,{type:'column',player:0,index:1});
 s.players[0].columns[3]=[7,6,5,4].map(rank=>({...card(rank),player:0}));castSpell(s,0,3);
 s.players[1].columns[0]=[];assert.equal(castSpell(s,1,0),false);assert.deepEqual(s.combat,before);assert.equal(attack(s,1,1).combo,true);
});
test('third attack preview and cast add Ace and combo bonuses',()=>{
 const s=newGame();attack(s,1);attack(s,1);s.players[1].columns[1]=[4,3,2,1].map(rank=>card(rank));
 const preview=spellAttack(s,1,1);assert.equal(preview.damage,30);assert.equal(preview.aceBonus+preview.comboBonus,25);
 s.players[0].health=100;castSpell(s,1,1);assert.equal(s.players[0].health,70);assert.equal(s.lastCast.damage,30);assert.equal(s.lastCast.combo,true);
});

for(const player of [0,1])test(`player ${player}'s third attack gets +15 damage and the next attack is normal`,()=>{
 const s=newGame();for(let i=0;i<2;i++)attack(s,player);
 const base=s.players[player].spells[0].damage,cast=attack(s,player);assert.equal(cast.comboBonus,15);assert.equal(cast.damage,base+15);assert.equal(s.players[player].score.combos4,1);assert.equal(attack(s,player).comboBonus,0);
});
test('third attack adds both the 15 damage combo and 10 damage Ace bonuses',()=>{
 const s=newGame();s.combat={lastScorer:1,streak:2};s.players[1].columns[0]=[4,3,2,1].map(rank=>card(rank));castSpell(s,1,0);assert.equal(s.lastCast.damage,30);assert.equal(s.lastCast.aceBonus+s.lastCast.comboBonus,25);assert.equal(s.players[0].health,70);
});
test('an opponent attack prevents a pending third-attack combo',()=>{
 const s=newGame();for(let i=0;i<2;i++)attack(s,1);attack(s,0);assert.equal(attack(s,1).comboBonus,0);
});

test('both players start fresh and casting never raises the other player’s requirement',()=>{
 const s=newGame();
 for(const player of [0,1])assert.deepEqual(s.players[player].spells.map(spell=>spell.cost.length),[4,4,4,4]);
 s.players[0].columns[0]=[9,8,7,6].map(rank=>card(rank));s.players[1].columns[0]=[9,8,7,6].map(rank=>card(rank));
 castSpell(s,0,0);assert.equal(s.players[0].spells[0].cost.length,5);assert.equal(canCast(s,1,0),true);assert.equal(spellAttack(s,1,0).damage,5);
 castSpell(s,1,0);assert.equal(s.players[1].spells[0].cost.length,5);assert.equal(s.players[0].spells[0].cost.length,5);
 assert.deepEqual(newGame().players.map(p=>p.spells.map(spell=>spell.cost.length)),[[4,4,4,4],[4,4,4,4]]);
});

for(const player of [0,1])for(const streak of [1,2,3,4,5])test(`player ${player} interrupts attack streak ${streak} with the right announcement and score`,()=>{
 const s=newGame();s.combat={lastScorer:1-player,streak};s.players[player].columns[0]=[7,6,5,4].map(rank=>card(rank));
 const expected=streak===1?'denied':streak===2?'break':null;
 assert.equal(spellAttack(s,player,0).comboBreak,expected);castSpell(s,player,0);
 assert.equal(s.lastCast.comboBreak,expected);assert.equal(s.players[player].score.denied,0);assert.equal(s.players[player].score.comboBreakers,streak===2?1:0);
 assert.deepEqual(s.combat,{lastScorer:player,streak:1});
});
for(const player of [0,1])test(`player ${player} gets capped Ace healing without breaking an opponent combo`,()=>{
 const s=newGame();s.players[player].health=95;s.combat={lastScorer:1-player,streak:3};s.players[player].columns[3]=[4,3,2,1].map(rank=>card(rank));
 const before=structuredClone(s.combat),preview=spellAttack(s,player,3);assert.equal(preview.heal,20);assert.equal(preview.comboBreak,null);
 castSpell(s,player,3);assert.equal(s.players[player].health,100);assert.deepEqual(s.combat,before);assert.equal(s.lastCast.comboBonus,0);assert.equal(s.players[player].score.comboBreakers,0);
});
test('an unspent Ace does not add healing',()=>{
 const s=newGame();s.players[1].health=50;s.players[1].columns[3]=[card(1,'black'),card(9),card(8),card(7),card(6)];
 assert.equal(spellAttack(s,1,3).heal,10);castSpell(s,1,3);assert.equal(s.players[1].health,60);assert.equal(s.lastCast.aceBonus,0);
});
test('continuing your own combo never announces an interruption',()=>{
 const s=newGame();s.combat={lastScorer:1,streak:3};s.players[1].columns[0]=[7,6,5,4].map(rank=>card(rank));
 castSpell(s,1,0);assert.equal(s.lastCast.comboBreak,null);assert.equal(s.players[1].score.comboBreakers,0);
});

for(const player of [0,1])test(`player ${player} can repeat complete combo cycles`,()=>{
 const s=newGame();
 for(let i=0;i<9;i++){
  const cast=attack(s,player),step=i%3+1;
  assert.equal(cast.attackStreak,step);assert.equal(cast.comboBonus,[0,5,15][step-1]);
  assert.deepEqual(s.combat,{lastScorer:step===3?null:player,streak:step%3});
 }
 assert.equal(s.players[player].score.combos3,3);assert.equal(s.players[player].score.combos4,3);
});
test('attacking after an opponent completes 3x starts fresh without a Combo Break',()=>{
 const s=newGame();attack(s,0);attack(s,0);const completed=attack(s,0);
 assert.equal(completed.attackStreak,3);assert.deepEqual(s.combat,{lastScorer:null,streak:0});
 const next=attack(s,1);assert.equal(next.comboBreak,null);assert.equal(next.attackStreak,1);assert.equal(next.comboBonus,0);
});
