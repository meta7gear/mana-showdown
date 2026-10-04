// Preload recorded impacts and share the game's audio context for rapid hits.
export function createDamageAudio({enabled,getContext}) {
 const active=new Set();
 const ctx=getContext();
 let generation=0;
 const buffers=new Map(Object.entries({
  basic:'/sfx/hit.mp3',
  combo:'/sfx/3xcombohit.mp3',
  rapid:'/sfx/4xcombohit.mp3'
 }).map(([kind,url])=>[kind,fetch(url,{signal:AbortSignal.timeout(30000)})
  .then(response=>{
   if(!response.ok)throw new Error(`Unable to load ${url}`);
   return response.arrayBuffer();
  })
  .then(data=>ctx.decodeAudioData(data))]));
 const ready=Promise.all(buffers.values());ready.catch(()=>{});
 function stop(){
  generation++;
  for(const voice of active)voice.stop();
  active.clear();
 }
 async function hit({combo=false,rapid=false}={}){
  if(!enabled()||ctx.state!=='running')return;
  const startedGeneration=generation;
  const buffer=await buffers.get(rapid?'rapid':combo?'combo':'basic').catch(()=>null);
  if(!buffer||!enabled()||ctx.state!=='running'||generation!==startedGeneration)return;
  // Each animation impact gets its own source so rapid hits can overlap.
  const voice=ctx.createBufferSource();
  voice.buffer=buffer;
  voice.connect(ctx.destination);
  voice.onended=()=>{active.delete(voice);voice.disconnect();};
  active.add(voice);
  voice.start();
 }
 return {hit,stop,ready};
}
