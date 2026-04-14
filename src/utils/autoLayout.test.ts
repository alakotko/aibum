import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpreadKey, generateAutoLayout } from './autoLayout.ts';

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

test('generateAutoLayout returns identical output for identical ordered inputs', () => {
  const photos = makePhotos(7);

  assert.deepEqual(generateAutoLayout(photos), generateAutoLayout(photos));
});

test('generateAutoLayout always starts with a dark single-image cover', () => {
  const [firstSpread] = generateAutoLayout(makePhotos(3));

  assert.equal(firstSpread.templateId, 'cover-single');
  assert.equal(firstSpread.spreadRole, 'cover');
  assert.equal(firstSpread.layoutType, 'single');
  assert.equal(firstSpread.backgroundColor, '#000000');
});

test('generateAutoLayout uses the expected deterministic template sequence', () => {
  const expectations: Record<number, string[]> = {
    1: ['cover-single'],
    2: ['cover-single', 'interior-single'],
    3: ['cover-single', 'interior-split'],
    4: ['cover-single', 'interior-grid3'],
    5: ['cover-single', 'interior-grid3', 'interior-single'],
    7: ['cover-single', 'interior-grid3', 'interior-grid3'],
  };

  for (const [count, templateIds] of Object.entries(expectations)) {
    assert.deepEqual(
      generateAutoLayout(makePhotos(Number(count))).map((spread) => spread.templateId),
      templateIds
    );
  }
});

test('spread keys stay stable for identical inputs and change when order changes', () => {
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
