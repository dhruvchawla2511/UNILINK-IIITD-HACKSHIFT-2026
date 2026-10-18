import crypto from 'node:crypto';

// Eight independently selected words provide a memorable, high-entropy class join code.
const WORDS = ['amber', 'anchor', 'apple', 'autumn', 'bamboo', 'beacon', 'birch', 'blossom', 'blue', 'breeze', 'brook', 'cactus', 'canyon', 'cedar', 'cherry', 'cobalt', 'comet', 'coral', 'cosmos', 'crystal', 'dawn', 'delta', 'desert', 'dolphin', 'drift', 'eagle', 'ember', 'fern', 'field', 'finch', 'flame', 'forest', 'frost', 'galaxy', 'garden', 'glacier', 'golden', 'harbor', 'hazel', 'honey', 'horizon', 'island', 'ivory', 'jade', 'jasmine', 'juniper', 'kestrel', 'lagoon', 'lantern', 'lark', 'lemon', 'lilac', 'linen', 'lotus', 'maple', 'marble', 'meadow', 'mercury', 'midnight', 'mist', 'monarch', 'moon', 'moss', 'mountain', 'nectar', 'north', 'ocean', 'olive', 'onyx', 'orchid', 'otter', 'paper', 'pebble', 'pepper', 'phoenix', 'pine', 'planet', 'plum', 'prairie', 'quartz', 'quiet', 'rabbit', 'rain', 'raven', 'reed', 'river', 'robin', 'rocket', 'rose', 'ruby', 'saffron', 'sage', 'sail', 'salmon', 'scarlet', 'shadow', 'silver', 'sky', 'snow', 'solar', 'sparrow', 'spice', 'spruce', 'star', 'stone', 'storm', 'summit', 'sunny', 'swift', 'thyme', 'tiger', 'timber', 'topaz', 'tulip', 'valley', 'velvet', 'violet', 'walnut', 'water', 'willow', 'wind', 'winter', 'wren', 'yellow', 'zephyr', 'zenith', 'zinnia', 'zodiac'];
export function newClassJoinCode(db) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = Array.from({ length: 8 }, () => WORDS[crypto.randomInt(WORDS.length)]).join('-');
    if (!db.prepare('SELECT 1 FROM teacher_classes WHERE join_code = ?').get(code)) return code;
  }
  throw new Error('Could not generate a unique class code');
}
export function normalizeClassJoinCode(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '-').replace(/^-|-$/g, '');
}
export function isEightWordClassCode(value) {
  return /^[a-z]+(?:-[a-z]+){7}$/.test(String(value ?? ''));
}
