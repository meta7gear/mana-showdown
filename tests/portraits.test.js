import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portraitStage, createPortraitController} from '../portraits.js';
function fixture(loadImage = async()=>{}, reducedMotion = ()=>false) {
  const images=['opponent.png','original.png'].map(src=>({src,alt:'Original portrait',getAttribute(){return this.src;},setAttribute(_,value){this.src=value;}}));
  const panels=images.map((image,i)=>({dataset:{player:String(i),...(i===1?{jacketOff:'jacket.png',swimsuit:'swimsuit.png',defeated:'defeated.png',defeatedAlt:'Heroine defeated on the ground'}:{})},querySelector:()=>image}));
  const flashes=[];
  return {images,panels,flashes,update:createPortraitController({panels,loadImage,reducedMotion,flash:(panel,stage)=>flashes.push({panel,stage})})};
}
test('portrait thresholds include 75 and 30 HP',()=>{
  assert.deepEqual([100,76,75,74,31,30,29,1,0].map(portraitStage),['original','original','jacketOff','jacketOff','jacketOff','swimsuit','swimsuit','swimsuit','defeated']);
});
test('opponent variants progress independently and keep their own descriptions',async()=>{
  const f=fixture();
  Object.assign(f.panels[0].dataset,{jacketOff:'opponent-jacket.png',swimsuit:'opponent-bikini.png',jacketOffAlt:'Rival casting lightning',swimsuitAlt:'Rival in sporty bikini'});
  await f.update([59,100]);
  assert.equal(f.images[0].src,'opponent-jacket.png');
  assert.equal(f.images[0].alt,'Rival casting lightning');
  assert.equal(f.images[1].src,'original.png');
  await f.update([29,59]);
  assert.equal(f.images[0].src,'opponent-bikini.png');
  assert.equal(f.images[0].alt,'Rival in sporty bikini');
  assert.equal(f.images[1].src,'jacket.png');
  await f.update([100,100],{animate:false,reset:true});
  assert.equal(f.images[0].src,'opponent.png');
  assert.equal(f.images[0].alt,'Original portrait');
});
test('only the matching player transforms, once per stage, with healing persistence and new-game restoration',async()=>{
  const f=fixture();
  await f.update([29,100]);assert.equal(f.images[0].src,'opponent.png');assert.equal(f.flashes.length,0);
  await f.update([29,59]);assert.equal(f.images[1].src,'jacket.png');assert.equal(f.flashes.length,1);
  assert.equal(f.flashes[0].stage,'jacketOff');
  await f.update([29,50]);await f.update([29,31]);assert.equal(f.flashes.length,1);
  await f.update([29,30]);assert.equal(f.images[1].src,'swimsuit.png');assert.equal(f.flashes.length,2);
  assert.equal(f.flashes[1].stage,'swimsuit');
  await f.update([29,30]);assert.equal(f.images[1].src,'swimsuit.png');
  await f.update([29,100]);assert.equal(f.images[1].src,'swimsuit.png');
  await f.update([29,0]);assert.equal(f.images[1].src,'defeated.png');
  const before=f.flashes.length;await f.update([100,100],{animate:false,reset:true});assert.equal(f.images[1].src,'original.png');assert.equal(f.flashes.length,before);
});
test('a delayed portrait cannot overwrite a new-game reset',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=f.update([100,59]);await f.update([100,100],{animate:false,reset:true});finish();await pending;
  assert.equal(f.images[1].src,'original.png');assert.equal(f.flashes.length,0);
});
test('reduced motion switches artwork without flashes',async()=>{
  const f=fixture(async()=>{},()=>true);await f.update([100,29]);assert.equal(f.images[1].src,'swimsuit.png');assert.equal(f.flashes.length,0);
});
test('failed image load preserves portrait and can be retried',async()=>{
  let fail=true;const f=fixture(async()=>{if(fail)throw Error('offline');});
  await f.update([100,59]);assert.equal(f.images[1].src,'original.png');assert.equal(f.flashes.length,0);
  fail=false;await f.update([100,59]);assert.equal(f.images[1].src,'jacket.png');assert.equal(f.flashes.length,1);
});

test('defeat selects the correct avatar and undo revival restores the living stage',async()=>{
 const f=fixture();Object.assign(f.panels[0].dataset,{defeated:'rival-defeated.png',defeatedAlt:'Rival defeated on the ground'});
 await f.update([100,30]);const flashes=f.flashes.length;
 await f.update([100,0]);assert.equal(f.images[1].src,'defeated.png');assert.equal(f.images[1].alt,'Heroine defeated on the ground');
 assert.equal(f.flashes.length,flashes);assert.equal(f.images[0].src,'opponent.png');
 await f.update([100,5]);assert.equal(f.images[1].src,'swimsuit.png');
 await f.update([0,5]);assert.equal(f.images[0].src,'rival-defeated.png');assert.equal(f.images[0].alt,'Rival defeated on the ground');
 await f.update([100,100],{reset:true,animate:false});assert.equal(f.images[0].src,'opponent.png');assert.equal(f.images[1].src,'original.png');
});
test('late defeated artwork cannot overwrite a reset',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=f.update([100,0]);await f.update([100,100],{reset:true,animate:false});finish();await pending;
 assert.equal(f.images[1].src,'original.png');
});
