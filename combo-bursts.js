// Keep the cinematic to at most 30 positive hits, preserving all damage.
export function comboBursts(damage){
 if(damage<=0)return [];
 const count=Math.min(30,damage),regular=Math.floor(damage/count);
 return Array.from({length:count},(_,index)=>index===count-1?damage-regular*(count-1):regular);
}
