import {MAX_HEALTH} from './game.js';

// Reverse only the human action; later opponent actions remain in the match.
export function createUndoHistory(){
 const entries=[];let pending=null,opponentActions=0,opponentAttacks=0;
 const canUndo=state=>state.winner===null&&entries.length>0;
 return {
  begin(state,player){pending={before:structuredClone(state),player};},
  cancel(){pending=null;},
  clear(){entries.length=0;pending=null;opponentActions=0;opponentAttacks=0;},
  commit(state){
   if(!pending)return;
   const {before,player}=pending;pending=null;
   if(player===0){
    opponentActions++;
    if(state.combat.lastScorer!==before.combat.lastScorer||state.combat.streak!==before.combat.streak)opponentAttacks++;
    return;
   }
   entries.push({before,after:structuredClone(state),opponentActions,opponentAttacks});
   if(entries.length>100)entries.shift();
  },
  canUndo,
  undo(state){
   if(!canUndo(state))return state;
   const entry=entries.pop(),{before,after}=entry,result=structuredClone(state);
   result.players[1]=structuredClone(before.players[1]);
   for(const player of [0,1]){
    const change=after.players[player].health-before.players[player].health;
    result.players[player].health=Math.max(0,Math.min(MAX_HEALTH,state.players[player].health-change));
   }
   result.moves=Math.max(0,state.moves-(after.moves-before.moves));
   if(entry.opponentAttacks===opponentAttacks)result.combat=structuredClone(before.combat);
   result.lastCast=entry.opponentActions===opponentActions?structuredClone(before.lastCast):state.lastCast?.player===0?structuredClone(state.lastCast):null;
   // Removing healing can expose lethal damage that the opponent already dealt.
   if(result.players[1].health===0){result.winner=0;result.winReason='health';}
   return result;
  },
 };
}
