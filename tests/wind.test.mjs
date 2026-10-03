import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTelemetry, windDisplay, windUpdates} from '../src/telemetry.mjs';
import {unwrapAngle} from '../src/geometry.js';
import {readFileSync} from 'node:fs';

test('wind page has one combined tab, legacy links and motion controls', () => {
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../receiver-ui.css',import.meta.url),'utf8');
 assert.match(html,/data-sensor="wind"/);
 assert.doesNotMatch(html,/data-sensor="wind-speed"|data-sensor="wind-direction"/);
 assert.match(app,/renderWindPage/); assert.match(app,/windUpdates\(parsed/);
 assert.match(app,/wind-motion-toggle/); assert.match(app,/'wind-speed','wind-direction'/);
 assert.match(css,/prefers-reduced-motion/); assert.match(css,/wind-stream/);
});

test('paired wind shows both measurements and a speed-driven animation', () => {
 const view=windDisplay({windSpeed:2,windDirection:336.7},{windSpeed:1000,windDirection:1000},2000);
 assert.equal(view.speed,2); assert.equal(view.angle,336.7);
 assert.equal(view.heading,'Bắc Tây Bắc'); assert.equal(view.state,'complete');
 assert.ok(view.duration>0); assert.equal(view.moving,true);
 assert.equal(view.kmh,7.2);
});
test('zero is a real calm measurement, missing speed is not zero', () => {
 assert.equal(windDisplay({windSpeed:0},{windSpeed:1000},1000).moving,false);
 assert.equal(windDisplay({windSpeed:0},{windSpeed:1000},1000).speed,0);
 assert.equal(windDisplay({}, {},1000).speed,null);
 assert.equal(windDisplay({}, {},1000).state,'empty');
});
test('partial and stale readings cannot drive the wind visualization', () => {
 const partial=windDisplay({windSpeed:3},{windSpeed:1000},1000);
 assert.equal(partial.state,'partial'); assert.equal(partial.moving,false);
 const stale=windDisplay({windSpeed:3,windDirection:90},{windSpeed:1000,windDirection:1000},11001);
 assert.equal(stale.speed,null); assert.equal(stale.angle,null); assert.equal(stale.moving,false);
 const invalid=windDisplay({windSpeed:-1,windDirection:361},{windSpeed:1000,windDirection:1000},1000);
 assert.equal(invalid.state,'empty');
});
test('speed increases motion rate without inventing a measurement', () => {
 const frame=s=>windDisplay({windSpeed:s,windDirection:0},{windSpeed:1000,windDirection:1000},1000);
 assert.ok(frame(10).duration<frame(1).duration);
 assert.equal(frame(100).speed,100);
 assert.equal(frame(100).duration,frame(1000).duration);
 assert.equal(frame(0).heading,'Bắc');
 assert.equal(windDisplay({windDirection:360},{windDirection:1000},1000).heading,'Bắc');
});
test('compass takes shortest turn across north in either direction', () => {
 assert.equal(unwrapAngle(359,1),361);
 assert.equal(unwrapAngle(1,359),-1);
 assert.equal(unwrapAngle(null,90),90);
 assert.equal(unwrapAngle(721,1),721);
 assert.equal(unwrapAngle(90,null),90);
});
test('pair field status and ages invalidate the affected channel immediately', () => {
 const pair=normalizeTelemetry({sensor:'wind-pair',status:'ok',windSpeed:null,windDirection:90,speed_status:'timeout',direction_status:'ok',direction_age_ms:250});
 assert.deepEqual(windUpdates(pair,1000,false),{windSpeed:{value:null,time:0},windDirection:{value:90,time:750}});
 assert.equal(windUpdates(pair,1000,true).windDirection.time,0);
 const invalid=normalizeTelemetry({sensor:'wind-pair',status:'ok',windSpeed:2,speed_status:'timeout'});
 assert.equal(windUpdates(invalid,1000,false).windSpeed.time,0);
 assert.deepEqual(windUpdates(normalizeTelemetry({waterLevel:2}),1000,false),{});
 assert.equal(windUpdates(normalizeTelemetry({speed_mps:1}),1000,false).windSpeed.value,1);
 assert.equal(windUpdates(normalizeTelemetry({sensor:'ES-WS-04',status:'timeout',angle:null}),1000,false).windDirection.time,0);
});

test('server clock ahead cannot hide a fresh sensor sample', () => {
 const parsed=normalizeTelemetry({sensor:'wind-pair',status:'ok',windSpeed:1,windDirection:280,direction_age_ms:80,speed_age_ms:200});
 const updates=windUpdates(parsed,1500,false,1000);
 assert.equal(updates.windDirection.time,920);
 assert.equal(updates.windSpeed.time,800);
 assert.equal(windDisplay({windSpeed:1,windDirection:280},{windSpeed:updates.windSpeed.time,windDirection:updates.windDirection.time},1000).state,'complete');
});
