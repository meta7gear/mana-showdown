import test from 'node:test';
import assert from 'node:assert/strict';
import {trackAsset,loadAssets} from '../asset-loader.js';

test('loading progress waits for every tracked asset before becoming ready',async()=>{
 let completeImage,completeAudio;
 trackAsset('portrait',new Promise(resolve=>{completeImage=resolve;}));
 trackAsset('speech',new Promise(resolve=>{completeAudio=resolve;}));
 const progress=[];let ready=false;
 const loading=loadAssets(value=>progress.push(value)).then(()=>{ready=true;});
 assert.deepEqual(progress[0],{loaded:0,total:2,label:'Preparing the arena'});
 completeImage();await Promise.resolve();
 assert.equal(ready,false);assert.equal(progress.at(-1).loaded,1);
 completeAudio();await loading;
 assert.equal(ready,true);assert.equal(progress.at(-1).loaded,2);
 assert.equal(progress.at(-1).total,2);
});
