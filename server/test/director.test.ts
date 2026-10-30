import assert from 'node:assert/strict';
import { test } from 'node:test';
import { undash } from '../src/director.ts';

test('undash: no em or en dash survives in Director text', () => {
  assert.equal(undash('Mara gives ground — the photo was Brand’s.'), 'Mara gives ground, the photo was Brand’s.');
  assert.equal(undash('Ines — soaked, furious — steps in.'), 'Ines, soaked, furious, steps in.');
  assert.equal(undash('It half-works—barely.'), 'It half-works, barely.');
  assert.equal(undash('Two–5 sentences, 2–5 beats'), 'Two, 5 sentences, 2-5 beats');
  assert.equal(undash('— An opening dash'), 'An opening dash');
  assert.equal(undash('Trailing dash —.'), 'Trailing dash.');
  assert.equal(undash('No dashes here, just a half-truth.'), 'No dashes here, just a half-truth.');
});
