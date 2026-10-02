import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  buildMqttPacket,
  decodeMqttPackets,
  flattenTelemetry,
  mqttString,
  validateBasTelemetry,
} from './mqtt_core.mjs'

const repoRoot = new URL('../../', import.meta.url)

test('firmware default and local receiver retain encrypted EMQX support', () => {
  const config = readFileSync(new URL('firmware/bas_mqtts/config.h', repoRoot), 'utf8')
  const value = key => config.match(new RegExp('^#define ' + key + ' (.+)$', 'm'))?.[1].trim()
  assert.equal(value('MQTT_HOST'), '"broker.emqx.io"')
  assert.equal(value('NB_MQTT_HOST'), value('MQTT_HOST'))
  assert.equal(value('NB_MQTT_TLS'), '1')
  assert.equal(value('NB_MQTT_PORT'), '8883')
  for (const path of ['windows/bas_receive_test/receiver.mjs', 'windows/bas_monitor/index.html']) {
    const page = readFileSync(new URL(path, repoRoot), 'utf8')
    assert.ok(page.includes('wss://broker.emqx.io:8084/mqtt'))
  }
})

test('waits for an unfinished modem connection before releasing its client', () => {
  const nbiot = readFileSync(new URL('firmware/bas_mqtts/nbiot.cpp', repoRoot), 'utf8')
  assert.match(nbiot, /waitPendingMqttConnect\(70000\)/)
  assert.match(nbiot, /if \(disc == RESULT_ERROR \|\| disc == RESULT_TIMEOUT\)/)
})

test('advances the reconnect backoff exactly once per failed attempt', () => {
  const nbiot = readFileSync(new URL('firmware/bas_mqtts/nbiot.cpp', repoRoot), 'utf8')
  const start = nbiot.indexOf('static void scheduleRetry()')
  const end = nbiot.indexOf('void nbBridgeLoop()', start)
  const schedule = nbiot.slice(start, end)

  assert.equal((schedule.match(/backoffIndex\+\+/g) ?? []).length, 1)
})

test('accepts a complete BAS telemetry payload', () => {
  const result = validateBasTelemetry(JSON.stringify({
    distance: 120.5,
    sternDistance: 118.2,
    bowSpeed: 2.1,
    sternSpeed: 1.8,
    angle: 1.2,
    waterLevel: 4.2,
    waterFlow: 0.3,
    waterDirection: 'NE',
    windForce: 15,
    windDirection: 'NE',
  }))

  assert.equal(result.ok, true)
  assert.equal(result.kind, 'full')
  assert.equal(result.data.distance, 120.5)
})

test('accepts the firmware minimal test payload', () => {
  const result = validateBasTelemetry('{"distance":120.5}')
  assert.equal(result.ok, true)
  assert.equal(result.kind, 'minimal')
})

test('classifies distance plus device metadata as an extended payload', () => {
  const result = validateBasTelemetry('{"distance":120.5,"modem":{"csq":18}}')
  assert.equal(result.ok, true)
  assert.equal(result.kind, 'extended')
})

test('rejects invalid JSON and payloads without telemetry fields', () => {
  assert.equal(validateBasTelemetry('{').ok, false)
  const unknown = validateBasTelemetry('{"hello":"world"}')
  assert.equal(unknown.ok, false)
  assert.deepEqual(unknown.data, { hello: 'world' })
})

test('flattens every nested field so the receive screen can display all device data', () => {
  const rows = flattenTelemetry({
    distance: 120.5,
    modem: { signal: { csq: 18 }, imei: '123456789' },
    alarms: ['tilt', 'water'],
    online: true,
    optional: null,
  })

  assert.deepEqual(rows, [
    { path: 'distance', value: 120.5 },
    { path: 'modem.signal.csq', value: 18 },
    { path: 'modem.imei', value: '123456789' },
    { path: 'alarms[0]', value: 'tilt' },
    { path: 'alarms[1]', value: 'water' },
    { path: 'online', value: true },
    { path: 'optional', value: null },
  ])
})

test('builds an MQTT packet with a multi-byte remaining length', () => {
  const body = new Uint8Array(200).fill(1)
  const packet = buildMqttPacket(0x30, body)
  assert.deepEqual([...packet.slice(0, 3)], [0x30, 0xc8, 0x01])
  assert.equal(packet.length, 203)
})

test('decodes a fragmented MQTT PUBLISH packet and preserves the remainder', () => {
  const topic = 'bas/BAS_TEST_001/telemetry'
  const payload = '{"distance":120.5}'
  const encoder = new TextEncoder()
  const body = new Uint8Array([...mqttString(topic), ...encoder.encode(payload)])
  const packet = buildMqttPacket(0x30, body)

  const first = decodeMqttPackets(packet.slice(0, 7))
  assert.equal(first.packets.length, 0)
  assert.equal(first.remainder.length, 7)

  const joined = new Uint8Array(first.remainder.length + packet.length - 7)
  joined.set(first.remainder)
  joined.set(packet.slice(7), first.remainder.length)
  const second = decodeMqttPackets(joined)

  assert.equal(second.packets.length, 1)
  assert.equal(second.packets[0].type, 0x30)
  assert.equal(second.remainder.length, 0)
})
