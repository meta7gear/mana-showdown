import test from 'node:test';
import assert from 'node:assert/strict';
import {createEndGameController} from '../end-game.js';
import {newGame,draw,castSpell} from '../game.js';
import {createUndoHistory} from '../undo.js';

function fixture(){
 const pending=new Map(),shown=[];let next=0;
 const controller=createEndGameController({show:winner=>shown.push(winner),hide:()=>{},schedule:fn=>{pending.set(++next,fn);return next;},cancel:id=>pending.delete(id)});
 return {controller,pending,shown,flush(){const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn());}};
}

test('undo during the defeat delay still presents the opponent win',()=>{
 const state=newGame(),history=createUndoHistory(),f=fixture();
 state.players[1].health=5;
 history.begin(state,1);draw(state,1);history.commit(state);
 state.players[0].spells[0]={id:'lethal',name:'Lethal',cost:Array(4).fill('fire'),damage:5};
 state.players[0].columns[0]=[5,4,3,2].map(rank=>({id:`lethal-${rank}`,kind:'number',color:rank%2?'red':'black',rank,player:0}));
 history.begin(state,0);castSpell(state,0,0);history.commit(state);
 f.controller.sync(state.winner,2500);
 const restored=history.undo(state);
 assert.equal(restored.winner,0);
 f.controller.sync(restored.winner,2500);
 assert.equal(f.pending.size,1);
 f.flush();assert.deepEqual(f.shown,[0]);
 // Repeated layout or undo does not hide or duplicate the result.
 f.controller.sync(restored.winner);assert.equal(f.pending.size,0);
});

test('undo that revives play cancels the pending result',()=>{
 const f=fixture();f.controller.sync(1,2500);f.controller.sync(null);f.flush();
 assert.deepEqual(f.shown,[]);
});

test('a fresh match cancels the old result and can present a new winner',()=>{
 const f=fixture();f.controller.sync(0,2500);f.controller.sync(null);f.controller.sync(1,2500);f.flush();
 assert.deepEqual(f.shown,[1]);
});
