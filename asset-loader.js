// Track assets already used by the game, including complete audio downloads.
const assets=[];
export function trackAsset(label,promise){
 promise.catch(()=>{}); // The loading screen reports failures when it awaits the batch.
 assets.push({label,promise});return promise;
}
export function createLoadedAudio(url){
 const audio=new Audio();audio.preload='auto';
 trackAsset(url,(async()=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Could not load ${url}`);
  const blob=await response.blob();
  const source=URL.createObjectURL(blob);
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>finish(new Error(`Timed out loading ${url}`)),30000);
   function finish(error){clearTimeout(timer);audio.removeEventListener('loadeddata',loaded);audio.removeEventListener('error',failed);error?reject(error):resolve();}
   const loaded=()=>finish(),failed=()=>finish(new Error(`Could not decode ${url}`));
   audio.addEventListener('loadeddata',loaded);audio.addEventListener('error',failed);
   audio.src=source;audio.load();
  });
 })());
 return audio;
}
export async function loadAssets(onProgress){
 const total=assets.length;let loaded=0;
 onProgress({loaded,total,label:'Preparing the arena'});
 await Promise.all(assets.map(async({label,promise})=>{
  await promise;onProgress({loaded:++loaded,total,label});
 }));
}
