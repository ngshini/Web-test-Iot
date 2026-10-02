import test from 'node:test';
import assert from 'node:assert/strict';
import {MqttReceiver, BROKERS} from './receiver.mjs';
import {buildMqttPacket, mqttString} from './mqtt_core.mjs';
class Socket {
 static instances=[];
 constructor(url){this.url=url;this.readyState=1;this.sent=[];Socket.instances.push(this);}
 send(data){this.sent.push(data);}
 close(){this.readyState=3;}
 packet(type,body){this.onmessage({data:buildMqttPacket(type,body).buffer});}
}
function setup(){const states=[],items=[];const receiver=new MqttReceiver({Socket,onState:s=>states.push(s),onMessage:m=>items.push(m)});return {receiver,states,items};}
test('broker selection, SUBACK and retained payload',()=>{
 const {receiver,states,items}=setup();receiver.connect('mosquitto',['bas/one/telemetry','bas/two/telemetry']);const s=Socket.instances.at(-1);
 assert.equal(s.url,BROKERS.mosquitto);s.onopen();assert.equal(s.sent[0][0],0x10);
 s.packet(0x20,[0,0]);assert.equal(s.sent[1][0],0x82);s.packet(0x90,[0,1,0,0]);assert.equal(states.at(-1),'connected');
 s.packet(0x31,[...mqttString('bas/one/telemetry'),...new TextEncoder().encode('{"distance":0}')]);
 assert.equal(items[0].retained,true);assert.equal(items[0].payload,'{"distance":0}');receiver.stop();
});
test('reject invalid topics / broker and refused subscription',()=>{
 const {receiver,states}=setup();assert.throws(()=>receiver.connect('unknown',['x']));assert.throws(()=>receiver.connect('emqx',['']));assert.throws(()=>receiver.connect('emqx',['x/#/y']));
 receiver.connect('emqx',['bas/+/telemetry']);const s=Socket.instances.at(-1);s.packet(0x20,[0,0]);s.packet(0x90,[0,1,128]);assert.equal(states.at(-1),'error');receiver.stop();
});
test('old socket cannot deliver messages after reconnect or stop',()=>{
 const {receiver,items}=setup();receiver.connect('emqx',['x']);const old=Socket.instances.at(-1);receiver.connect('mosquitto',['x']);
 old.packet(0x30,[...mqttString('x'),123,125]);assert.equal(items.length,0);receiver.stop();
});
test('QoS1 acknowledgment and fragmented packets',()=>{
 const {receiver,items}=setup();receiver.connect('emqx',['x']);const s=Socket.instances.at(-1);
 const p=buildMqttPacket(0x32,[...mqttString('x'),0,9,123,125]);s.onmessage({data:p.slice(0,3).buffer});assert.equal(items.length,0);s.onmessage({data:p.slice(3).buffer});
 assert.equal(items.length,1);assert.deepEqual([...s.sent.at(-1)],[64,2,0,9]);receiver.stop();
});
