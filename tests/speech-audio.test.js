import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechAudio} from '../speech-audio.js';

function fixture(){
 const played=[],clips=new Map();let enabled=true;
 const speech=createSpeechAudio({enabled:()=>enabled,createAudio:url=>{
  const clip={play(){played.push(url);return Promise.resolve();},pause(){this.paused=true;},currentTime:0};
  clips.set(url,clip);return clip;
 }});
 return {speech,played,clips,mute(){enabled=false;speech.stop();},finish(){clips.get(played.at(-1)).onended();}};
}
const path=name=>`/speech/${name}.mp3`;
test('combo-break announcements share the speech queue and respect match end',()=>{
 const f=fixture();f.speech.comboBreak();f.speech.comboBreak();
 assert.deepEqual(f.played,[path('announcer-combobreak')]);
 f.finish();assert.deepEqual(f.played,['announcer-combobreak','announcer-combobreak'].map(path));
 f.finish();f.speech.end(0);f.speech.comboBreak();f.finish();
 assert.equal(f.played.length,3);
 const muted=fixture();muted.mute();muted.speech.comboBreak();
 assert.deepEqual(muted.played,[]);
});
test('announcer playback leaves both character portraits unhighlighted',()=>{
 const speakers=[],clips=new Map();
 const speech=createSpeechAudio({enabled:()=>true,onSpeakerChange:player=>speakers.push(player),createAudio:url=>{
  const clip={play:()=>Promise.resolve(),pause(){},currentTime:0};clips.set(url,clip);return clip;
 }});
 for(let i=0;i<2;i++){
  speech.comboBreak();
  const clip=clips.get(path('announcer-combobreak'));
  clip.onplaying();assert.equal(speakers.at(-1),null);clip.onended();
 }
});
test('start and threshold emotes share a serial queue, once per character',()=>{
 const f=fixture();f.speech.start();
 f.speech.health([{health:30},{health:29}]);
 assert.deepEqual(f.played,[path('player-start')]);
 f.finish();f.finish();f.finish();f.finish();
 assert.deepEqual(f.played,['player-start','opponent-start','opponent-neardefeat','player-neardefeat'].map(path));
 f.speech.health([{health:50},{health:50}]);f.speech.health([{health:20},{health:20}]);
 assert.equal(f.played.length,4);
});
test('player win queues defeated then victory, without interrupting speech',()=>{
 const f=fixture();f.speech.health([{health:80},{health:30}]);f.speech.end(1);f.speech.end(1);
 assert.deepEqual(f.played,[path('player-neardefeat')]);
 f.finish();f.finish();f.finish();
 assert.deepEqual(f.played,['player-neardefeat','opponent-defeated','player-victory'].map(path));
});
test('opponent win only plays opponent victory and skips lethal threshold',()=>{
 const f=fixture();f.speech.health([{health:80},{health:0}]);f.speech.end(0);
 assert.deepEqual(f.played,[path('opponent-victory')]);
});
test('mute clears speech and reset allows threshold emotes in a new match',()=>{
 const f=fixture();f.speech.start();const first=f.clips.get(path('player-start'));
 f.mute();assert.equal(first.paused,true);assert.equal(first.onended,null);
 const g=fixture();g.speech.health([{health:30},{health:80}]);g.speech.reset();
 g.speech.health([{health:30},{health:80}]);assert.equal(g.played.length,2);
});
test('failed clip advances the queue',async()=>{
 const f=fixture();f.clips.get(path('player-start')).play=()=>Promise.reject(new Error('unavailable'));
 f.speech.start();await Promise.resolve();
 assert.deepEqual(f.played,[path('opponent-start')]);
});
test('speaker highlight follows playback, queued handoff, buffering and stop',()=>{
 const speakers=[],clips=new Map();
 const speech=createSpeechAudio({enabled:()=>true,onSpeakerChange:player=>speakers.push(player),createAudio:url=>{
  const clip={play:()=>Promise.resolve(),pause(){},currentTime:0};clips.set(url,clip);return clip;
 }});
 speech.start();assert.deepEqual(speakers,[null]);
 const player=clips.get(path('player-start')),opponent=clips.get(path('opponent-start'));
 player.onplaying();assert.equal(speakers.at(-1),1);
 player.onwaiting();assert.equal(speakers.at(-1),null);
 player.onplaying();player.onended();assert.equal(speakers.at(-1),null);
 opponent.onplaying();assert.equal(speakers.at(-1),0);
 const stale=opponent.onplaying;speech.stop();stale();
 assert.equal(speakers.at(-1),null);assert.equal(opponent.onplaying,null);
});

test('removed Denied clip is never loaded',()=>{
 const f=fixture();assert.equal(f.clips.has(path('announcer-denied')),false);
});
