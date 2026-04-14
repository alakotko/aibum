/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateAutoLayout } = require('./autoLayout.ts');

function buildPhotos(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `photo-${index + 1}`,
    url: `https://example.com/${index + 1}.jpg`,
    filename: `photo-${index + 1}.jpg`,
    selectionStatus: 'shortlisted',
  }));
}

test('generateAutoLayout is deterministic for identical inputs', () => {
  const photos = buildPhotos(8);

  const firstClassic = generateAutoLayout(photos, 'classic');
  const secondClassic = generateAutoLayout(photos, 'classic');

  assert.deepEqual(firstClassic, secondClassic);
});

test('generateAutoLayout produces distinct variant signatures', () => {
  const photos = buildPhotos(8);

  const classic = generateAutoLayout(photos, 'classic');
  const story = generateAutoLayout(photos, 'story');
  const premium = generateAutoLayout(photos, 'premium');

  assert.notDeepEqual(classic, story);
  assert.notDeepEqual(story, premium);
  assert.notDeepEqual(classic, premium);
});
