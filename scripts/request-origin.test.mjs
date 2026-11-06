import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSameRequestOrigin } from '../server/utils/request-origin.ts'

test('same-origin check normalizes default ports and rejects other hosts or ports', () => {
  for (const [origin, host, expected] of [
    ['https://wb.xuan.world', 'wb.xuan.world:443', true],
    ['https://wb.xuan.world:443', 'wb.xuan.world', true],
    ['http://localhost', 'localhost:80', true],
    ['http://localhost:5567', 'localhost:5567', true],
    ['https://wb.xuan.world', 'wb.xuan.world:3001', false],
    ['https://evil.example', 'wb.xuan.world:443', false],
    ['https://wb.xuan.world.evil.example', 'wb.xuan.world', false],
    ['null', 'wb.xuan.world', false],
    ['invalid', 'wb.xuan.world', false],
    ['https://wb.xuan.world', undefined, false],
    ['file:///tmp/test', 'wb.xuan.world', false],
  ]) assert.equal(isSameRequestOrigin(origin, host), expected, `${origin} / ${host}`)
})
