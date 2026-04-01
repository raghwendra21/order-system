import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

test('LOG_LEVEL=error emits only error lines', () => {
  const loggerPath = path.join(__dirname, '../src/logger.js');
  const code = `
    process.env.LOG_LEVEL = 'error';
    const { logger } = require(${JSON.stringify(loggerPath)});
    const out = [];
    const orig = console.log.bind(console);
    console.log = (...a) => { out.push(a.join(' ')); };
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e', { code: 1 });
    console.log = orig;
    process.stdout.write(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lines = JSON.parse(r.stdout) as string[];
  assert.equal(lines.length, 1);
  assert.match(lines[0], /ERROR.*e/);
});

test('LOG_LEVEL=debug emits all levels', () => {
  const loggerPath = path.join(__dirname, '../src/logger.js');
  const code = `
    process.env.LOG_LEVEL = 'debug';
    const { logger } = require(${JSON.stringify(loggerPath)});
    const out = [];
    const orig = console.log.bind(console);
    console.log = (...a) => { out.push(a.join(' ')); };
    logger.debug('d');
    logger.info('i');
    console.log = orig;
    process.stdout.write(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lines = JSON.parse(r.stdout) as string[];
  assert.equal(lines.length, 2);
  assert.match(lines[0], /DEBUG/);
  assert.match(lines[1], /INFO/);
});
