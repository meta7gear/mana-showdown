import {hints, move, canMove, canCast, castSpell, spellAttack, spellCost, MANAS, MAX_HEALTH} from './game.js';

export const DIFFICULTIES = {
  easy: {minDelay:1800,maxDelay:4000,missChance:0.2},
  medium: {minDelay:1500,maxDelay:3500,missChance:0.15},
  hard: {minDelay:600,maxDelay:1900,missChance:0.1}
};

const tableauKey = (state, player) => JSON.stringify(state.players[player].columns.map(cards => cards.map(card => card.id)));

export function createAbilityState() {
  return {ace:{cooldown:30000,cooldownUntil:0},drawOne:{duration:30000,cooldown:60000,activeUntil:0,cooldownUntil:0},shuffle:{cooldown:60000,cooldownUntil:0}};
}

export function abilityReady(state, abilities, name, player, now=Date.now()) {
  if (state.winner !== null || now < abilities[name].cooldownUntil) return false;
  const cards=state.players[player];
  if (name==='ace') return cards.stock.some(card=>card.kind==='ace');
  if (name==='shuffle') return cards.stock.length+cards.waste.length>1;
  return name==='drawOne';
}

// Search affordable attack sequences using the actual Ace, combo and spell-tier rules.
function lethalSpell(state, player) {
  const immediate=state.players[player].spells.findIndex((spell,index)=>!spell.heal&&canCast(state,player,index)&&spellAttack(state,player,index).damage>=state.players[1-player].health);
  if (immediate!==-1) return immediate;
  for (let index=0; index<state.players[player].spells.length; index++) {
    if (state.players[player].spells[index].heal || !canCast(state,player,index)) continue;
    const preview=structuredClone(state);
    castSpell(preview,player,index,()=>0.5);
    if (preview.winner===player || lethalSpell(preview,player)!==null) return index;
  }
  return null;
}

function spellValue(state, player, index) {
  const spell=state.players[player].spells[index];
  if (spell.heal) {
    // Recover only while in danger; stop investing in Life once HP reaches 40.
    const health=state.players[player].health;
    return health<40 ? 100+Math.min(spellAttack(state,player,index).heal,MAX_HEALTH-health) : 0;
  }
  return spellAttack(state,player,index).damage;
}

export function chooseOpponentAction(state, seen = new Set(), player = 0, abilities = null, now = Date.now()) {
  if (state.winner !== null) return null;
  const lethal=lethalSpell(state,player);
  if (lethal!==null) return {type:'cast',index:lethal,player};
  const ready=state.players[player].spells.map((_,index)=>index).filter(index=>canCast(state,player,index)&&spellValue(state,player,index)>0);
  ready.sort((a,b)=>spellValue(state,player,b)-spellValue(state,player,a));
  if (ready.length) return {type:'cast',index:ready[0],player};

  seen.add(tableauKey(state, player));
  const candidates = hints(state).filter(candidate => candidate.from.player === player);
  // Whole runs may change mana columns, but only to unlock a useful spell below.
  state.players[player].columns.forEach((cards,index)=>{
    if (!cards.length) return;
    state.players[player].columns.forEach((dest,target)=>{
      const from={type:'column',player,index},to={type:'column',player,index:target};
      if (!dest.length && canMove(state,from,0,to)) candidates.push({from,index:0,to});
    });
  });
  const ranked=candidates.flatMap(candidate=>{
    const preview=structuredClone(state);
    move(preview,candidate.from,candidate.index,candidate.to);
    if (seen.has(tableauKey(preview,player))) return [];
    const useful=preview.players[player].spells.map((_,index)=>index).filter(index=>spellValue(preview,player,index)>0);
    const unlocked=useful.filter(index=>!canCast(state,player,index)&&canCast(preview,player,index));
    // Never spend a turn rearranging tableau cards without unlocking a cast.
    if (candidate.from.type==='column' && !unlocked.length) return [];
    const mana=MANAS[candidate.to.index];
    const targets=useful.filter(index=>spellCost(preview.players[player].spells[index])[mana]>0);
    if (!targets.length) return [];
    const lethal=unlocked.length>0 && lethalSpell(preview,player)!==null;
    const value=unlocked.reduce((best,index)=>Math.max(best,spellValue(preview,player,index)),0);
    // Build toward the current spell costs, favouring the fewest missing charges.
    const progress=Math.max(...targets.map(index=>{
      const cost=spellCost(preview.players[player].spells[index]);
      const missing=MANAS.reduce((total,mana,column)=>total+Math.max(0,cost[mana]-preview.players[player].columns[column].length),0);
      return 100/(1+missing)+spellValue(preview,player,index)/preview.players[player].spells[index].cost.length;
    }));
    return [{candidate,score:(lethal?10000:0)+(unlocked.length?1000:0)+value+progress}];
  });
  ranked.sort((a,b)=>b.score-a.score);
  if (ranked.length) return {type:'move',...ranked[0].candidate};
  const opponent = state.players[player];
  if (abilities) {
    let name=null;
    if (abilityReady(state,abilities,'ace',player,now)) name='ace';
    else if (opponent.stock.length+opponent.waste.length>0 && abilityReady(state,abilities,'drawOne',player,now)) name='drawOne';
    else if (!opponent.stock.length && now>=abilities.drawOne.activeUntil && abilityReady(state,abilities,'shuffle',player,now)) name='shuffle';
    if (name) return {type:'ability',name,player};
  }
  return opponent.stock.length || opponent.waste.length ? {type: 'draw', player} : null;
}

export function createOpponent({getState, play, draw, cast = () => false, getAbilities = () => null, useAbility = () => false, now = Date.now, paused = () => false, random = Math.random, schedule = setTimeout, cancel = clearTimeout, difficulty = 'hard'}) {
  let timer = null;
  let running = false;
  let settings = DIFFICULTIES[difficulty] ?? DIFFICULTIES.hard;
  const seen = new Set();
  function queue() {
    if (running && getState().winner === null) timer = schedule(think, settings.minDelay + random() * (settings.maxDelay-settings.minDelay));
  }
  function think() {
    timer = null;
    if (!running || getState().winner !== null) return;
    if (!paused() && random() >= settings.missChance) {
      const state = getState();
      const action = chooseOpponentAction(state, seen, 0, getAbilities(), now());
      if (action?.type === 'move') {
        if (play(action.from, action.index, action.to) && (action.from.type !== 'column' || action.to.type === 'foundation')) seen.clear();
      } else if (action?.type === 'cast') {
        if (cast(action.index, action.player)) seen.clear();
      } else if (action?.type === 'ability') {
        if (useAbility(action.name, action.player)) seen.clear();
      } else if (action?.type === 'draw') {
        draw(action.player);
      }
    }
    queue();
  }
  function stop() {
    running = false;
    if (timer !== null) cancel(timer);
    timer = null;
    seen.clear();
  }
  return {stop, start() {stop(); running = true; queue();}, setDifficulty(value) {
    if (!Object.hasOwn(DIFFICULTIES,value)) return;
    settings = DIFFICULTIES[value];
    if (timer !== null) cancel(timer);
    timer = null;
    queue();
  }};
}
