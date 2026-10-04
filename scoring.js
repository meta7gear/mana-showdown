// Edit these weights to rebalance scores. Difficulty multiplies the entire subtotal.
export const SCORE_WEIGHTS = {
  difficultyMultipliers: {easy: 1, medium: 1.5, hard: 2},
  tableauCards: 10,
  centerCards: 100,
  lifeCards: 150,
  combos3: 250,
  combos4: 500,
  comboBreakers: 200,
  denied: 125,
  // Victory-only bonus: maximum at 0 seconds, half at 180 seconds.
  speedMaximum: 3000,
  speedHalfLifeSeconds: 180,
};
export const HIGH_SCORE_KEY = 'mana-showdown.high-score';

export function createScoreStats() {
  return {tableauCards:0,centerCards:0,lifeCards:0,combos3:0,combos4:0,comboBreakers:0,denied:0,tableauCardIds:[]};
}

// Called after move validation, before the combat streak changes.
export function recordScoreMove(stats,cards,from,to,combat) {
  if(to.type==='column')for(const card of cards) {
    // Count each card once, including cards in moved runs, to prevent cycling for points.
    if(!stats.tableauCardIds.includes(card.id)) {
      stats.tableauCardIds.push(card.id);
      stats.tableauCards++;
    }
  }
  if(from.type==='life')stats.lifeCards+=cards.length;
  if(to.type!=='foundation')return;
  stats.centerCards+=cards.length;
  if(combat.lastScorer===from.player) {
    if(combat.streak===1)stats.combos3++;
    if(combat.streak===2)stats.combos4++;
  } else {
    if(combat.streak===2)stats.comboBreakers++;
  }
}

export function calculateScore(stats,elapsedSeconds,won,difficulty='easy',weights=SCORE_WEIGHTS) {
  const seconds=Math.max(0,elapsedSeconds);
  const rows=[
    ['tableauCards','Tableau cards'],['centerCards','Center-zone cards'],
    ['lifeCards','Life cards cleared'],['combos3','2-attack combos'],['combos4','3-attack combos'],
    ['comboBreakers','Combo breakers'],['denied','Denied'],
  ].map(([key,label])=>({key,label,count:stats[key],points:Math.round(stats[key]*weights[key])}));
  // Legacy score keys combos3/combos4 now track the 2x/3x attack milestones.
  const speedBonus=won?Math.round(weights.speedMaximum/(1+seconds/weights.speedHalfLifeSeconds)):0;
  const subtotal=rows.reduce((sum,row)=>sum+row.points,speedBonus);
  const multiplier=weights.difficultyMultipliers[difficulty]??weights.difficultyMultipliers.easy;
  return {rows,elapsedSeconds:seconds,speedBonus,subtotal,difficulty,multiplier,total:Math.round(subtotal*multiplier)};
}

export function createMatchClock(now=()=>performance.now()) {
  let started=null,finished=null;
  return {
    start(){started=now();finished=null;},
    finish(){if(started!==null&&finished===null)finished=now();},
    reset(){started=null;finished=null;},
    seconds(){return started===null?0:Math.max(0,((finished??now())-started)/1000);},
  };
}

export function saveHighScore(score,getStorage=()=>globalThis.localStorage) {
  let previous=0;
  try {
    const storage=getStorage(),stored=Number(storage.getItem(HIGH_SCORE_KEY));
    previous=Number.isSafeInteger(stored)&&stored>=0?stored:0;
    if(score>previous)storage.setItem(HIGH_SCORE_KEY,String(score));
  } catch {
    // Storage restrictions must never prevent the match result from appearing.
  }
  return {highScore:Math.max(previous,score),isNewRecord:score>previous};
}
