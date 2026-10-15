/**
 * ─────────────────────────────────────────────────────────────────────────
 *  PERSONALIZE THE GAME HERE — this is the only file you need to edit.
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  • title ............ game title (browser tab + intro screen)
 *  • intro ............ intro lines, touch instruction, start button
 *  • fragments ........ the FOUR sentences found in the level, in order
 *  • finalLetter ...... the full letter shown at the end  ⚠ PLACEHOLDER
 *  • catColors ........ colors of the black cat
 *
 *  Everything visible to the player is plain Persian text in this file.
 *  Line breaks: put each line as a separate array item (no "\n" needed).
 *
 *  Tip: write in your own words. The letter works best when it is short,
 *  specific to you two, and asks for nothing in return.
 */

export const content = {
  /** Shown on the intro screen and in the browser tab. */
  title: 'نامه‌ای که باد برد',

  intro: {
    /** Each item is rendered as its own line. */
    lines: ['یه نامه بود که باید به دستت می‌رسید…', 'اما باد زودتر از من پیداش کرد.'],
    /** Shown under the intro text. Explains the on-screen touch controls. */
    instruction: 'با لمس دکمه‌های پایین صفحه، پیشی  را به سمت نامه‌ها هدایت کن.',
    startButton: 'بریم دنبالش',
  },

  /**
   * The four letter pieces, in the order they appear in the level.
   * Keep exactly four items — the level has four pieces.
   */
  fragments: [
    'می‌دونم کاری کردم که ناراحتت کرد.',
    'حق داری ازم دلخور باشی.',
    'نمی‌خوام برای رفتارم بهونه بیارم.',
    'ولی من همیشه ، در حالتی به فکرتم ...',
  ] as const,

  fragmentDialog: {
    /** Small heading above each piece. `{n}` is replaced with the piece number (Persian digits). */
    heading: 'تکه‌ی {n} از نامه',
    continueButton: 'ادامه',
  },

  /**
   * ⚠⚠⚠  PLACEHOLDER — REPLACE BEFORE PUBLISHING  ⚠⚠⚠
   *
   * This is neutral sample text so the game works out of the box.
   * Replace greeting / paragraphs / signOff / signature with your own words,
   * then set `isPlaceholder` to false (it shows a small "sample text"
   * badge in development and a console warning in production).
   */
  finalLetter: {
    isPlaceholder: true,
    heading: 'میوعذرخواهی ',
    greeting: 'میول،',
    /** If true, the four collected pieces are shown as the opening paragraph. */
    includeFragments: true,
    paragraphs: [
      'می دونم خیلی وقتا نبودم، می دونم خیلی سرم شلوغ بوده ',
      'می دونم خیلی وقتا گاو بودم ، می دونم خیلی وقتا اذیتت کردم ',
      'ولی همیشه دوست دارم، همیشه یک بخش از ذهن و قبل منی ',
      'نمی خوام ببخشیم ، می خوام بدونی دوست دارم ',
    ],
    signOff: 'پیشی که خیلی بده ',
    signature: 'امیو',
  },

  buttons: {
    /** Primary button on the final letter — replays the letter (keeps progress). */
    reread: 'دوباره بخون',
    /** Secondary button — restarts the whole game. Set to '' to hide it. */
    restart: 'از اول بازی کن',
    closeLetter: 'بستن نامه',
  },

  hud: {
    /** Progress label. `{n}` and `{total}` become Persian digits. */
    progress: '{n} از {total}',
    progressAria: 'تکه‌های پیداشده‌ی نامه',
  },

  /** Gentle hints shown only when the player has been idle for a while. */
  hints: {
    findNext: 'یه تکه‌ی دیگه از نامه جلوتره…',
    goToDoor: 'نامه کامل شد. حالا ببرش دمِ در.',
    doorNotYet: 'هنوز چند تکه از نامه دستِ باده…',
    windy: 'باد تنده، ولی آروم آروم می‌شه رد شد.',
  },

  controls: {
    left: 'برو چپ',
    jump: 'بپر',
    right: 'برو راست',
  },

  placeholderBadge: '',
} as const;

/**
 * The cat. Hex colors. The default is a black cat drawn in charcoal tones
 * with a soft light outline so it stays readable against the dusk scene.
 * (For a light orange cat try body "#F2B47E", shadow "#D98E55",
 *  highlight "#FFD7AE", outline "#8A5A3C".)
 */
export const catColors = {
  body: '#17171C',
  shadow: '#0B0B0F',
  highlight: '#34343C',
  eyes: '#F3D36B',
  nose: '#D68C9A',
  /** Thin rim around the cat — keeps it visible on dark backgrounds. */
  outline: '#6E6672',
} as const;

/** Small gameplay knobs, if you want the walk to feel slower/faster. */
export const gameTuning = {
  /** Seconds without input before a hint appears. */
  idleHintSeconds: 7,
  /** Horizontal speed of the cat (world units per second). */
  walkSpeed: 185,
} as const;

export type Content = typeof content;
export const FRAGMENT_COUNT = content.fragments.length;
