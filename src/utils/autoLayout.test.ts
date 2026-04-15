import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpreadKey, createVersionSpreadKeys, generateAutoLayout } from './autoLayout.ts';

type TestPhoto = {
  id: string;
  url: string;
  filename: string;
  selectionStatus: 'shortlisted';
};

function makePhotos(count: number): TestPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `photo-${index + 1}`,
    url: `/photo-${index + 1}.jpg`,
    filename: `photo-${index + 1}.jpg`,
    selectionStatus: 'shortlisted',
  }));
}

test('generateAutoLayout returns identical output for identical ordered photos', () => {
  const photos = makePhotos(7);
  assert.deepEqual(generateAutoLayout(photos), generateAutoLayout(photos));
  assert.deepEqual(generateAutoLayout(photos, 'story'), generateAutoLayout(photos, 'story'));
});

test('generateAutoLayout always starts with a dark single-image cover', () => {
  const [firstSpread] = generateAutoLayout(makePhotos(3));

  assert.equal(firstSpread.templateId, 'cover-single');
  assert.equal(firstSpread.spreadRole, 'cover');
  assert.equal(firstSpread.layoutType, 'single');
  assert.equal(firstSpread.backgroundColor, '#000000');
});

test('variants produce distinct deterministic interior sequences', () => {
  const photos = makePhotos(8);

  assert.notDeepEqual(generateAutoLayout(photos, 'classic'), generateAutoLayout(photos, 'story'));
  assert.notDeepEqual(generateAutoLayout(photos, 'story'), generateAutoLayout(photos, 'premium'));
});

test('spread keys stay stable for identical photos and change when order changes', () => {
  const photos = makePhotos(4);
  const firstRun = generateAutoLayout(photos).map((spread) => spread.spreadKey);
  const secondRun = generateAutoLayout(photos).map((spread) => spread.spreadKey);
  const reorderedRun = generateAutoLayout([photos[0], photos[2], photos[1], photos[3]]).map(
    (spread) => spread.spreadKey
  );

  assert.deepEqual(firstRun, secondRun);
  assert.notDeepEqual(firstRun, reorderedRun);
});

test('createSpreadKey is based on role, template, and ordered image ids only', () => {
  assert.equal(
    createSpreadKey({
      spreadRole: 'interior',
      templateId: 'interior-split',
      imageIds: ['a', 'b'],
    }),
    'interior:interior-split:a|b'
  );
});

test('createVersionSpreadKeys preserves first key and suffixes duplicate occurrences deterministically', () => {
  assert.deepEqual(
    createVersionSpreadKeys([
      { spreadKey: 'interior:interior-split:a|b' },
      { spreadKey: 'interior:interior-single:c' },
      { spreadKey: 'interior:interior-split:a|b' },
      { spreadKey: 'interior:interior-split:a|b' },
    ]),
    [
      'interior:interior-split:a|b',
      'interior:interior-single:c',
      'interior:interior-split:a|b#2',
      'interior:interior-split:a|b#3',
    ]
  );
});
