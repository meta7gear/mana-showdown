import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,draw,move,pullAce,shuffleStock,castSpell} from '../game.js';
import {createUndoHistory} from '../undo.js';
function act(h,s,fn){h.begin(s,1);fn();h.commit(s);}
for(const action of [s=>draw(s,1),s=>pullAce(s,1),s=>shuffleStock(s,1,()=>.5)])test('undo restores draw, Ace pull or shuffle completely',()=>{
 const s=newGame(),h=createUndoHistory(),before=structuredClone(s);act(h,s,()=>action(s));assert.deepEqual(h.undo(s),before);
});
test('undo casting restores exact deck order, column charge, spell, HP and score',()=>{
 const s=newGame(),h=createUndoHistory();s.players[1].spells[0]={id:'test',name:'Test',cost:Array(4).fill('fire'),damage:5};s.players[1].columns[0]=[7,6,5,4].map(rank=>({id:`test-${rank}`,kind:'number',color:rank%2?'red':'black',rank,player:1}));const before=structuredClone(s);
 act(h,s,()=>castSpell(s,1,0));assert.equal(s.players[0].health,95);assert.deepEqual(h.undo(s),before);
});
test('undo tableau placement removes its charge and restores the card',()=>{
 const s=newGame(),h=createUndoHistory();s.players[1].columns[0]=[{id:'base',kind:'number',color:'red',rank:5,player:1}];s.players[1].waste=[{id:'charge',kind:'number',color:'black',rank:4,player:1}];const before=structuredClone(s);
 act(h,s,()=>move(s,{type:'waste',player:1},0,{type:'column',player:1,index:0}));assert.deepEqual(h.undo(s),before);
});
test('repeated undo restores original state',()=>{const s=newGame(),h=createUndoHistory(),before=structuredClone(s);act(h,s,()=>draw(s,1));act(h,s,()=>draw(s,1));assert.deepEqual(h.undo(h.undo(s)),before);});
test('game over locks undo',()=>{const s=newGame(),h=createUndoHistory();act(h,s,()=>draw(s,1));s.winner=1;assert.equal(h.canUndo(s),false);});

test('undo a combo restores the streak and replay receives the same bonus',()=>{
 const s=newGame(),h=createUndoHistory();s.combat={lastScorer:1,streak:2};s.players[1].columns[0]=[7,6,5,4].map(rank=>({id:`combo-${rank}`,kind:'number',color:rank%2?'red':'black',rank,player:1}));const before=structuredClone(s);
 act(h,s,()=>castSpell(s,1,0));assert.equal(s.lastCast.damage,20);assert.equal(s.combat.streak,0);const restored=h.undo(s);assert.deepEqual(restored,before);castSpell(restored,1,0);assert.equal(restored.lastCast.combo,true);assert.equal(restored.lastCast.damage,20);
});

const run=(player,prefix)=>[7,6,5,4].map(rank=>({id:`${prefix}-${rank}`,kind:'number',color:rank%2?'red':'black',rank,player}));
function opponentAct(h,s,fn){h.begin(s,0);fn();h.commit(s);}
test('undo stays available after opponent draws and preserves their deck',()=>{
 const s=newGame(),h=createUndoHistory(),human=structuredClone(s.players[1]);
 act(h,s,()=>draw(s,1));opponentAct(h,s,()=>draw(s,0));const opponent=structuredClone(s.players[0]);
 assert.equal(h.canUndo(s),true);const restored=h.undo(s);
 assert.deepEqual(restored.players[0],opponent);assert.deepEqual(restored.players[1],human);assert.equal(restored.moves,1);
});
test('undo a player spell keeps opponent spell progression, damage, score and combo',()=>{
 const s=newGame(),h=createUndoHistory();s.players[1].columns[0]=run(1,'human');s.players[0].columns[0]=run(0,'ai');const human=structuredClone(s.players[1]);
 act(h,s,()=>castSpell(s,1,0));opponentAct(h,s,()=>castSpell(s,0,0));const opponent=structuredClone(s.players[0]),combat=structuredClone(s.combat),lastCast=structuredClone(s.lastCast);
 const restored=h.undo(s);opponent.health=100;human.health=95;
 assert.deepEqual(restored.players[0],opponent);assert.deepEqual(restored.players[1],human);assert.deepEqual(restored.combat,combat);assert.deepEqual(restored.lastCast,lastCast);assert.equal(restored.moves,1);
});
test('multiple undos across opponent actions preserve all opponent moves',()=>{
 let s=newGame();const h=createUndoHistory(),human=structuredClone(s.players[1]);
 act(h,s,()=>draw(s,1));opponentAct(h,s,()=>draw(s,0));act(h,s,()=>draw(s,1));opponentAct(h,s,()=>draw(s,0));const opponent=structuredClone(s.players[0]);
 s=h.undo(s);s=h.undo(s);assert.deepEqual(s.players[1],human);assert.deepEqual(s.players[0],opponent);assert.equal(s.moves,2);assert.equal(h.canUndo(s),false);
});
test('undo healing removes only actual healing and retains subsequent incoming damage',()=>{
 const s=newGame(),h=createUndoHistory();s.players[1].health=95;s.players[1].columns[3]=run(1,'life');s.players[0].columns[0]=run(0,'ai');
 act(h,s,()=>castSpell(s,1,3));opponentAct(h,s,()=>castSpell(s,0,0));const restored=h.undo(s);
 assert.equal(restored.players[1].health,90);assert.equal(restored.players[1].columns[3].length,4);assert.equal(restored.players[0].spells[0].cost.length,5);
});
test('opponent drawing after its attack does not prevent restoring a later player combo',()=>{
 const s=newGame(),h=createUndoHistory();s.players[0].columns[0]=run(0,'ai');opponentAct(h,s,()=>castSpell(s,0,0));const combat=structuredClone(s.combat);
 s.players[1].columns[0]=run(1,'human');act(h,s,()=>castSpell(s,1,0));opponentAct(h,s,()=>draw(s,0));
 assert.deepEqual(h.undo(s).combat,combat);
});
test('undo cannot erase a later opponent heal or exceed maximum health',()=>{
 const s=newGame(),h=createUndoHistory();s.players[1].columns[0]=run(1,'human');s.players[0].columns[3]=run(0,'life');
 act(h,s,()=>castSpell(s,1,0));opponentAct(h,s,()=>castSpell(s,0,3));const opponent=structuredClone(s.players[0]);
 assert.deepEqual(h.undo(s).players[0],opponent);
});
test('undoing healing can expose lethal opponent damage',()=>{
 const s=newGame(),h=createUndoHistory();s.players[1].health=3;s.players[1].columns[3]=run(1,'life');s.players[0].columns[0]=run(0,'ai');
 act(h,s,()=>castSpell(s,1,3));opponentAct(h,s,()=>castSpell(s,0,0));const restored=h.undo(s);
 assert.equal(restored.players[1].health,0);assert.equal(restored.winner,0);assert.equal(restored.winReason,'health');
});
