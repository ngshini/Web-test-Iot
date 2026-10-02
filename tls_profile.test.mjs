import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('NB production connection is encrypted and uses DNS hostname for certificate identity', () => {
 const c=readFileSync(new URL('../../firmware/bas_mqtts/config.h',import.meta.url),'utf8');
 const value=k=>c.match(new RegExp('^#define '+k+' (.+)$','m'))?.[1].trim();
 assert.equal(value('NB_MQTT_TLS'),'1');
 assert.equal(value('NB_MQTT_HOST'),'"broker.emqx.io"');
 assert.equal(value('NB_MQTT_PORT'),'8883');
});
