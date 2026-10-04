// One shared queue keeps character emotes and announcements from talking over each other.
export function createSpeechAudio({enabled,onSpeakerChange=()=>{},createAudio=url=>new Audio(url)}) {
 const clips=new Map(['player-start','opponent-start','player-neardefeat','opponent-neardefeat',
  'opponent-defeated','player-victory','opponent-victory','announcer-combobreak'].map(name=>{
   const clip=createAudio(`/speech/${name}.mp3`);clip.preload='auto';
   if(name.startsWith('announcer-'))clip.volume=.6;
   return [name,clip];
  }));
 const queue=[],warned=new Set();
 let current=null,finished=false,generation=0;
 function next(){
  if(current||!enabled())return;
  const name=queue.shift();
  if(!name)return;
  const clip=clips.get(name),startedGeneration=generation;current=clip;
  const done=()=>{
   if(current!==clip||generation!==startedGeneration)return;
   clip.onended=null;clip.onerror=null;clip.onplaying=null;clip.onwaiting=null;current=null;onSpeakerChange(null);next();
  };
  clip.onplaying=()=>{
   if(current===clip&&generation===startedGeneration)onSpeakerChange(name.startsWith('announcer-')?null:name.startsWith('player-')?1:0);
  };
  clip.onwaiting=()=>{
   if(current===clip&&generation===startedGeneration)onSpeakerChange(null);
  };
  clip.onended=done;clip.onerror=done;
  try{void clip.play().catch(done);}catch{done();}
 }
 function enqueue(...names){if(!enabled())return;queue.push(...names);next();}
 function stop(){
  generation++;queue.length=0;
  if(current){const clip=current;current=null;clip.onended=null;clip.onerror=null;clip.onplaying=null;clip.onwaiting=null;clip.pause();clip.currentTime=0;}
  onSpeakerChange(null);
 }
 function reset(){stop();warned.clear();finished=false;}
 return {
  stop,reset,
  start(){reset();enqueue('player-start','opponent-start');},
  comboBreak(){
   if(!finished)enqueue('announcer-combobreak');
  },
  health(players){
   if(finished)return;
   for(const [index,player]of players.entries()){
    if(player.health>0&&player.health<=30&&!warned.has(index)){
     warned.add(index);enqueue(index===1?'player-neardefeat':'opponent-neardefeat');
    }
   }
  },
  end(winner){
   if(finished)return;
   finished=true;
   if(winner===1)enqueue('opponent-defeated','player-victory');
   else enqueue('opponent-victory');
  }
 };
}
