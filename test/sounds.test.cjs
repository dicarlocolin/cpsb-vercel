const {test}=require('node:test');
const assert=require('node:assert/strict');
const soundModule=import('../public/sounds.mjs');
const rows=(a,b)=>[{team_number:'19-1',ccs_score:a},{team_number:'19-2',ccs_score:b}];

test('only a selected team score increase plays; initial, equal, lower and invalid scores stay silent',async()=>{
 const {createScoreGainTracker}=await soundModule,tracker=createScoreGainTracker();
 assert.equal(tracker.observe(rows(10,20),'19-1'),false);
 assert.equal(tracker.observe(rows('10',30),'19-1'),false);
 assert.equal(tracker.observe(rows(9,40),'19-1'),false);
 assert.equal(tracker.observe(rows(10,40),'19-1'),true);
 for(const invalid of [null,undefined,'',' ',NaN,'invalid',Infinity])assert.equal(tracker.observe(rows(invalid,40),'19-1'),false);
 assert.equal(tracker.observe([], '19-1'),false);
 assert.equal(tracker.observe(rows(10,40),'19-1'),false);
 assert.equal(tracker.observe(rows(15,40),'19-1'),true);
 assert.equal(tracker.observe(rows(15,100),'19-2'),false);
 assert.equal(tracker.observe(rows(16,101),'19-2'),true);
 assert.equal(tracker.observe(rows(17,102),''),false);
 assert.equal(tracker.observe(rows(17,102),'19-2'),false);
 tracker.reset();assert.equal(tracker.observe(rows(20,103),'19-2'),false);
});

test('WAV upload checks actual header, extension, and accepts recordings larger than the former cap',async()=>{
 const {readWav}=await soundModule;
 const bytes=new Uint8Array(44);bytes.set(new TextEncoder().encode('RIFF'));bytes.set(new TextEncoder().encode('WAVE'),8);
 const file=(name,data=bytes)=>({name,size:data.length,arrayBuffer:async()=>data.buffer});
 const wav=await readWav(file('Win.WAV'));
 assert.equal(wav.name,'Win.WAV');assert.deepEqual(new Uint8Array(wav.bytes),bytes);
 await assert.rejects(readWav(file('Win.mp3')),/\.wav/);
 await assert.rejects(readWav(file('Win.wav',new Uint8Array(44))),/valid WAV/);
 await assert.rejects(readWav(file('Win.wav',new Uint8Array(2))),/valid WAV/);
 await assert.rejects(readWav(file('Win.wav',new Uint8Array())),/non-empty/);
 const large=new Uint8Array(8*1024*1024);large.set(bytes);
 assert.equal((await readWav(file('large.wav',large))).bytes.byteLength,large.byteLength);
});

test('sound requires enabling, handles suspension, replaces overlapping audio and stops cleanly',async()=>{
 const {createSoundPlayer}=await soundModule;
 let ctx,states=0;
 class Context{
  constructor(){ctx=this;this.state='suspended';this.sources=[];this.destination={}}
  async decodeAudioData(bytes){return {bytes}}
  async resume(){this.state='running';this.onstatechange()}
  createBufferSource(){const source={connect(){},start(){this.started=true},stop(){this.stopped=true;this.onended()}};this.sources.push(source);return source}
 }
 const player=createSoundPlayer(()=>states++,Context),buffer=await player.decode(new ArrayBuffer(4));
 assert.equal(player.play(buffer),false);assert.equal(player.enabled,false);
 await player.enable();assert.equal(player.enabled,true);assert.ok(states>0);
 assert.equal(player.play(buffer),true);assert.equal(ctx.sources[0].buffer,buffer);
 player.play(buffer);assert.equal(ctx.sources[0].stopped,true);assert.equal(ctx.sources[1].started,true);
 player.stop();assert.equal(ctx.sources[1].stopped,true);
 ctx.state='suspended';assert.equal(player.play(buffer),false);
 await player.enable();assert.equal(player.play(buffer),true);
 ctx.sources[2].onended();player.stop();assert.notEqual(ctx.sources[2].stopped,true);
});

test('unsupported or undecodable audio reports a usable error',async()=>{
 const {createSoundPlayer}=await soundModule;
 await assert.rejects(createSoundPlayer(()=>{},null).enable(),/does not support/);
 class Context{async decodeAudioData(){throw Error('bad bytes')}}
 await assert.rejects(createSoundPlayer(()=>{},Context).decode(new ArrayBuffer(0)),/standard PCM WAV/);
});
