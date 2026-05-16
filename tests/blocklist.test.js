const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalize,
  sanitizeBlockedList,
  sanitizeBlockedTracks,
  sanitizeBlockedPatterns,
  isBlocked,
  matchPattern
} = require('../src/blocklist');

test('normalize trims, lowercases, and collapses whitespace', () => {
  assert.equal(normalize('  Taylor   Swift  '), 'taylor swift');
  assert.equal(normalize(null), '');
});

test('sanitizeBlockedList removes blanks and duplicates', () => {
  assert.deepEqual(
    sanitizeBlockedList([' Taylor Swift ', '', 'taylor   swift', 'Gracie Abrams']),
    ['taylor swift', 'gracie abrams']
  );
});

test('sanitizeBlockedTracks keeps valid track blocks and deduplicates them', () => {
  assert.deepEqual(
    sanitizeBlockedTracks([
      { artist: ' Taylor Swift ', track: ' Anti-Hero ' },
      { artist: 'taylor swift', track: 'anti-hero' },
      { track: 'Shake It Off' },
      { artist: '', track: 'Shake It Off' },
      { artist: 'Nobody' }
    ]),
    [
      { track: 'anti-hero', artist: 'taylor swift' },
      { track: 'shake it off' }
    ]
  );
});

test('sanitizeBlockedPatterns trims blanks and deduplicates exact patterns', () => {
  assert.deepEqual(
    sanitizeBlockedPatterns([' *Live ', '', '*Live', '*Acoustic']),
    ['*Live', '*Acoustic']
  );
});

test('matchPattern supports exact, prefix, suffix, and contains matching', () => {
  assert.equal(matchPattern('Live', 'Live'), true);
  assert.equal(matchPattern('*Live', 'Cruel Summer Live'), true);
  assert.equal(matchPattern('Live*', 'Live at Wembley'), true);
  assert.equal(matchPattern('*Live*', 'Cruel Summer - Live at Wembley'), true);
  assert.equal(matchPattern('*Live', 'Live at Wembley'), false);
});

test('isBlocked prioritizes reverse, track, pattern, then artist rules', () => {
  assert.deepEqual(
    isBlocked('Other Artist', 'Any Song', ['Taylor Swift'], [], [], true, false),
    { blocked: true, reason: 'reverse' }
  );

  assert.deepEqual(
    isBlocked('Taylor Swift', 'Anti-Hero', ['Taylor Swift'], [{ artist: 'taylor swift', track: 'anti-hero' }], ['*hero'], false, false),
    { blocked: true, reason: 'track' }
  );

  assert.deepEqual(
    isBlocked('Allowed Artist', 'Acoustic Version', ['Taylor Swift'], [], ['*acoustic*'], false, false),
    { blocked: true, reason: 'pattern' }
  );

  assert.deepEqual(
    isBlocked('Taylor Swift', 'Unblocked Track', ['Taylor Swift'], [], [], false, false),
    { blocked: true, reason: 'artist' }
  );
});

test('isBlocked can block collaborations by contained artist name', () => {
  assert.deepEqual(
    isBlocked(['Some Artist feat. Taylor Swift'], 'Collab Track', ['Taylor Swift'], [], [], false, true),
    { blocked: true, reason: 'artist' }
  );
});

test('reverse mode allows listed artists but still applies track and pattern blocks', () => {
  assert.deepEqual(
    isBlocked('Taylor Swift', 'Clean', ['Taylor Swift'], [], [], true, false),
    { blocked: false, reason: null }
  );

  assert.deepEqual(
    isBlocked('Taylor Swift', 'Clean Live', ['Taylor Swift'], [], ['*live'], true, false),
    { blocked: true, reason: 'pattern' }
  );
});
