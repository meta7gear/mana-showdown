// Keep result presentation independent of combat animations, which undo can clear.
export function createEndGameController({show,hide,schedule=setTimeout,cancel=clearTimeout}) {
 let timer=null,currentWinner=null;
 return {
  sync(winner,delay=0) {
   if(winner===currentWinner)return;
   if(timer!==null){cancel(timer);timer=null;}
   currentWinner=winner;
   hide();
   if(winner!==null)timer=schedule(()=>{timer=null;show(winner);},delay);
  }
 };
}
