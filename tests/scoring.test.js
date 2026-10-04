import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,move,castSpell} from '../game.js';
import {createUndoHistory} from '../undo.js';
import {calculateScore,createScoreStats,createMatchClock,saveHighScore,HIGH_SCORE_KEY,SCORE_WEIGHTS} from '../scoring.js';
test('tableau builds and casts score, while undo restores the original score',()=>{
 const s=newGame(),p=s.players[1],h=createUndoHistory();s.players[1].spells[0]={id:'test',name:'Test',cost:Array(4).fill('fire'),damage:5};
 p.columns[0]=[5,4,3].map(rank=>({id:`base-${rank}`,kind:'number',color:rank%2?'red':'black',rank,player:1}));p.waste=[{id:'score-card',kind:'number',color:'black',rank:6,player:1}];
 h.begin(s,1);move(s,{type:'waste',player:1},0,{type:'column',player:1,index:0});castSpell(s,1,0);h.commit(s);
 assert.equal(p.score.centerCards,4);assert.equal(p.score.lifeCards,0);assert.equal(p.score.tableauCards,1);assert.equal(p.score.combos3,0);assert.deepEqual(h.undo(s).players[1].score,createScoreStats());
});

test('scores use editable weights, with a decreasing victory-only time bonus',()=>{
 const stats={...createScoreStats(),tableauCards:2,centerCards:3,lifeCards:1,combos3:1,combos4:1,comboBreakers:1,denied:1};
 const result=calculateScore(stats,180,true);
 assert.equal(result.total,3045);assert.equal(result.speedBonus,1500);
 assert.ok(calculateScore(stats,60,true).total>result.total);
 assert.equal(calculateScore(stats,180,false).speedBonus,0);
 assert.equal(calculateScore(stats,180,false,'easy',{...SCORE_WEIGHTS,tableauCards:20}).total,1565);
});

test('clock excludes pre-match and result animation time and resets between matches',()=>{
 let now=1000;const clock=createMatchClock(()=>now);
 assert.equal(clock.seconds(),0);clock.start();now=61000;clock.finish();now=65000;clock.finish();
 assert.equal(clock.seconds(),60);clock.reset();assert.equal(clock.seconds(),0);
 clock.start();now=66000;assert.equal(clock.seconds(),1);
});

test('high scores survive new trackers and lower scores never overwrite them',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 assert.deepEqual(saveHighScore(200,()=>storage),{highScore:200,isNewRecord:true});
 assert.deepEqual(saveHighScore(100,()=>storage),{highScore:200,isNewRecord:false});
 assert.equal(data.get(HIGH_SCORE_KEY),'200');
 assert.equal(saveHighScore(200,()=>storage).isNewRecord,false);
 for(const corrupt of ['NaN','-12','Infinity','bad']){
  data.set(HIGH_SCORE_KEY,corrupt);assert.equal(saveHighScore(300,()=>storage).highScore,300);
 }
 assert.doesNotThrow(()=>saveHighScore(100,()=>{throw Error('Blocked');}));
});


test('difficulty multiplies all points including speed, rounds totals, and saves the weighted score',()=>{
 const stats={...createScoreStats(),denied:1};
 for(const won of [false,true])for(const [difficulty,multiplier] of [['easy',1],['medium',1.5],['hard',2]]){
  const result=calculateScore(stats,180,won,difficulty);
  assert.equal(result.multiplier,multiplier);
  assert.equal(result.total,Math.round((125+(won?1500:0))*multiplier));
 }
 const result=calculateScore(stats,180,true,'hard');
 let stored=null;
 saveHighScore(result.total,()=>({getItem:()=>null,setItem:(_key,value)=>{stored=value;}}));
 assert.equal(stored,'3250');
 const weights={...SCORE_WEIGHTS,difficultyMultipliers:{easy:1,medium:2,hard:3}};
 assert.equal(calculateScore(stats,180,false,'hard',weights).total,375);
});
