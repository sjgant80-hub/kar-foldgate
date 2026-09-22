import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from './kernel.mjs';
// kernel.test.mjs

// Fixed possibility-pool: 5 fold-address candidates.
const candidates = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
const scoreFn = (c, seed) => (c.id * 3 + seed) % 7;

test('collapse picks the deterministic max-score winner for seed=1', () => {
  const r = K.collapse(candidates, 1, scoreFn);
  assert.equal(r.ok, true);
  assert.equal(r.index, 4);
  assert.equal(r.score, 6);
  assert.deepEqual(r.winner, { id: 4 });
});

test('collapse is seed-sensitive: seed=2 picks a different winner than seed=1', () => {
  const r1 = K.collapse(candidates, 1, scoreFn);
  const r2 = K.collapse(candidates, 2, scoreFn);
  assert.equal(r1.index, 4);
  assert.equal(r2.index, 1);
  assert.equal(r2.score, 5);
  assert.notEqual(r1.index, r2.index);
});

test('collapse(S)===collapse(S): idempotent for the same seed', () => {
  const a = K.collapse(candidates, 1, scoreFn);
  const b = K.collapse(candidates, 1, scoreFn);
  assert.deepEqual(a, b);
  assert.equal(K.isIdempotent(candidates, 1, scoreFn), true);
});

test('collapse never mutates the candidate pool', () => {
  const before = JSON.parse(JSON.stringify(candidates));
  K.collapse(candidates, 1, scoreFn);
  K.collapse(candidates, 2, scoreFn);
  assert.deepEqual(candidates, before);
  assert.equal(candidates.length, 5);
});

test('collapse is total on malformed input: returns ok:false, never throws', () => {
  assert.equal(K.collapse(null, 1, scoreFn).ok, false);
  assert.equal(K.collapse([], 1, scoreFn).ok, false);
  assert.equal(K.collapse(candidates, 'not-a-seed', scoreFn).ok, false);
  assert.equal(K.collapse(candidates, 1, 'not-a-function').ok, false);
});

test('collapse is total when scoreFn throws or returns a non-number', () => {
  const throwing = () => { throw new Error('boom'); };
  const r1 = K.collapse(candidates, 1, throwing);
  assert.equal(r1.ok, false);
  assert.match(r1.why, /scoreFn threw/);

  const nonNumeric = () => 'not-a-number';
  const r2 = K.collapse(candidates, 1, nonNumeric);
  assert.equal(r2.ok, false);
  assert.match(r2.why, /finite number/);
});

// --- mutation-kill additions below ---

test('collapse keeps the FIRST candidate on a score tie (strict greater-than, not >=)', () => {
  // ids 1 and 3 tie at score 5; id 1 comes first and must win.
  const tieScore = (c) => (c.id === 1 || c.id === 3) ? 5 : 0;
  const r = K.collapse(candidates, 0, tieScore);
  assert.equal(r.ok, true);
  assert.equal(r.index, 1);
  assert.equal(r.score, 5);
});

test('collapse rejects a NaN seed specifically (seed check must be OR, not AND)', () => {
  const r = K.collapse(candidates, NaN, scoreFn);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'seed must be a finite number');
});

test('collapse rejects an Infinity score (score check must be OR, not AND)', () => {
  const infScore = () => Infinity;
  const r = K.collapse(candidates, 1, infScore);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'scoreFn must return a finite number, got number at index 0');
});

test('collapse stringifies a non-Error throw with no .message (&& not ||)', () => {
  const throwsString = () => { throw 'boom-str'; };
  const r = K.collapse(candidates, 1, throwsString);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'scoreFn threw at index 0: boom-str');
});

test('isIdempotent agrees on failure reason for deterministic malformed input (=== not !==)', () => {
  assert.equal(K.isIdempotent(candidates, 'not-a-seed', scoreFn), true);
});

test('isIdempotent is false when ok-ness differs between the two calls (return false, not true)', () => {
  let call = 0;
  const flaky = (c) => {
    call++;
    if (call > candidates.length) throw new Error('flaky');
    return c.id;
  };
  assert.equal(K.isIdempotent(candidates, 1, flaky), false);
});

test('isIdempotent is false when index matches but score differs (&& not ||)', () => {
  let n = 0;
  const statefulScore = (c) => {
    const mult = n < candidates.length ? 1 : 10;
    n++;
    return c.id * mult;
  };
  assert.equal(K.isIdempotent(candidates, 1, statefulScore), false);
});
