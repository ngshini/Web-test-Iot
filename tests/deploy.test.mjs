import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
test('CI deploys only main and preserves public SSE receiver', () => {
 assert.ok(existsSync(new URL('../.github/workflows/deploy.yml', import.meta.url)));
 const workflow=readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url),'utf8');
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/needs: test/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(readFileSync(new URL('../receiver.mjs',import.meta.url),'utf8'),/\/iot-test\/events/);
});
