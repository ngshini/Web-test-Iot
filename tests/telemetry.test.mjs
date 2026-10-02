import {test} from 'node:test';import assert from 'node:assert/strict';import {normalizeTelemetry as parse} from '../src/telemetry.mjs';
test('TF03 metres converted to centimetres, no invented second channel',()=>assert.deepEqual(parse({sensor:'TF03',unit:'m',distance:12,status:'ok'}).values,{distance1:1200}));
test('wind angle is not ship angle',()=>assert.deepEqual(parse({sensor:'ES-WS-04',angle:201.1,windDirection:'SSW',unit:'deg',status:'ok'}).values,{windDirection:201.1}));
test('bad or absent samples never become zero',()=>assert.deepEqual(parse({distance:null,status:'timeout'}).values,{}));
test('BAS compass and two channels',()=>assert.deepEqual(parse({distance:12,sternDistance:20,windDirection:'SE'}).values,{distance1:1200,distance2:2000,windDirection:135}));
test('wind force is not wind speed',()=>assert.deepEqual(parse({windForce:4}).values,{}));
test('invalid input rejected',()=>{assert.throws(()=>parse({distance:'12'}));assert.throws(()=>parse({distance:-1}));assert.throws(()=>parse([]));});
