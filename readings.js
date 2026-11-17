'use strict';
/* The readings that open every round: a few lines of a book, a poem, or a picture.
   Each round is shown one, it is taken away, and everyone answers a question on it.
   Difficulty rises from Gentle to Fiendish over the game: harder passages, harder
   questions, less time to read, more answers to choose from. */

const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const LEVELS = [
  { name: 'Gentle', read: 32, options: 3, q: 0, tier: 1 },
  { name: 'Easy', read: 28, options: 4, q: 1, tier: 1 },
  { name: 'Fair', read: 24, options: 4, q: 1, tier: 2 },
  { name: 'Hard', read: 20, options: 4, q: 2, tier: 2 },
  { name: 'Fiendish', read: 16, options: 5, q: 2, tier: 3 },
];
const levelFor = (round, maxRounds) => Math.min(5, Math.max(1, Math.ceil(round * 5 / maxRounds)));

/* qs: [easy, medium, hard], each [question, answer, wrong answers] */
const TEXTS = [
  { form: 'poem', tier: 1, title: 'I Wandered Lonely as a Cloud', source: 'William Wordsworth, 1807',
    lines: ['I wandered lonely as a cloud', 'That floats on high o’er vales and hills,', 'When all at once I saw a crowd,', 'A host, of golden daffodils;', 'Beside the lake, beneath the trees,', 'Fluttering and dancing in the breeze.'],
    qs: [['Which flowers did the poet see?', 'Daffodils', ['Roses', 'Tulips', 'Bluebells', 'Lilies']],
      ['The poet wandered as lonely as what?', 'A cloud', ['A star', 'A ghost', 'A bird', 'A river']],
      ['Where were the flowers, as well as beneath the trees?', 'Beside the lake', ['Along the road', 'By the river', 'Upon the hill', 'Near the church']]] },
  { form: 'poem', tier: 1, title: 'Because I could not stop for Death', source: 'Emily Dickinson, 1890',
    lines: ['Because I could not stop for Death –', 'He kindly stopped for me –', 'The Carriage held but just Ourselves –', 'And Immortality.'],
    qs: [['Who stopped for the speaker?', 'Death', ['A stranger', 'An old friend', 'The priest', 'A soldier']],
      ['What did they ride in?', 'A carriage', ['A boat', 'A train', 'A hay wagon', 'A sleigh']],
      ['Who rode with them besides “Ourselves”?', 'Immortality', ['Eternity', 'Silence', 'The Moon', 'Despair']]] },
  { form: 'poem', tier: 2, title: 'Sonnet 18', source: 'William Shakespeare, 1609',
    lines: ['Shall I compare thee to a summer’s day?', 'Thou art more lovely and more temperate:', 'Rough winds do shake the darling buds of May,', 'And summer’s lease hath all too short a date;'],
    qs: [['Which season is the loved one compared to?', 'Summer', ['Winter', 'Spring', 'Autumn', 'Midwinter']],
      ['What shakes the darling buds?', 'Rough winds', ['Heavy rain', 'Hard frost', 'Wild birds', 'Thunder']],
      ['The buds of which month are named?', 'May', ['April', 'June', 'March', 'July']]] },
  { form: 'poem', tier: 2, title: 'The Raven', source: 'Edgar Allan Poe, 1845',
    lines: ['Once upon a midnight dreary, while I pondered, weak and weary,', 'Over many a quaint and curious volume of forgotten lore—', 'While I nodded, nearly napping, suddenly there came a tapping,', 'As of some one gently rapping, rapping at my chamber door.'],
    qs: [['At what time of night does the poem begin?', 'Midnight', ['Dawn', 'Dusk', 'Two in the morning', 'Teatime']],
      ['What was the speaker poring over?', 'Volumes of forgotten lore', ['Letters from a lost love', 'A map of the sea', 'An old prayer book', 'A ledger of debts']],
      ['Where was the rapping?', 'At my chamber door', ['At the window pane', 'On the cellar stair', 'At the garden gate', 'On the attic floor']]] },
  { form: 'poem', tier: 2, title: 'The Marsh Bell', source: 'A Hollowmere rhyme, sung to children',
    lines: ['When the marsh bell rings three times at dusk,', 'Bar the door and bank the fire;', 'One who smiles will pass the salt,', 'One who weeps will be the liar.'],
    qs: [['How many times does the marsh bell ring?', 'Three', ['Once', 'Twice', 'Five', 'Seven']],
      ['What should be done to the fire?', 'Bank it', ['Douse it', 'Light it', 'Leave it', 'Feed it oak']],
      ['Who will be the liar?', 'The one who weeps', ['The one who smiles', 'The one who sleeps', 'The one who sings', 'The one who counts']]] },
  { form: 'poem', tier: 3, title: 'Jabberwocky', source: 'Lewis Carroll, 1871',
    lines: ['’Twas brillig, and the slithy toves', 'Did gyre and gimble in the wabe:', 'All mimsy were the borogoves,', 'And the mome raths outgrabe.'],
    qs: [['What were described as slithy?', 'The toves', ['The borogoves', 'The raths', 'The wabe', 'The bandersnatch']],
      ['Where did they gyre and gimble?', 'In the wabe', ['In the tulgey wood', 'In the burrow', 'In the marsh', 'On the brillig']],
      ['What were all mimsy?', 'The borogoves', ['The toves', 'The raths', 'The wabes', 'The jubjubs']]] },
  { form: 'poem', tier: 3, title: 'The Witches’ Song', source: 'William Shakespeare, Macbeth, 1606',
    lines: ['Double, double toil and trouble;', 'Fire burn and cauldron bubble.', 'Fillet of a fenny snake,', 'In the cauldron boil and bake;'],
    qs: [['What does the cauldron do?', 'Bubble', ['Boil over', 'Smoke', 'Sing', 'Crack']],
      ['Which creature goes into the cauldron?', 'A snake', ['A toad', 'A bat', 'A newt', 'An owl']],
      ['What kind of snake is it?', 'Fenny', ['Fanged', 'Fiery', 'Finny', 'Forest']]] },
  { form: 'book', tier: 1, title: 'Pride and Prejudice', source: 'Jane Austen, 1813',
    lines: ['It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.'],
    qs: [['What must the single man be in want of?', 'A wife', ['A house', 'A horse', 'A servant', 'A title']],
      ['What is the single man in possession of?', 'A good fortune', ['A large estate', 'A fine carriage', 'A noble name', 'A sharp mind']],
      ['How is this truth acknowledged?', 'Universally', ['Privately', 'Rarely', 'Quietly', 'Eventually']]] },
  { form: 'book', tier: 1, title: 'Moby-Dick', source: 'Herman Melville, 1851',
    lines: ['Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.'],
    qs: [['What does the narrator ask to be called?', 'Ishmael', ['Ahab', 'Queequeg', 'Starbuck', 'Jonah']],
      ['What did he have in his purse?', 'Little or no money', ['A single gold coin', 'A letter of credit', 'His father’s watch', 'A ship’s ticket']],
      ['Which part of the world did he want to see?', 'The watery part', ['The far side', 'The frozen north', 'The southern islands', 'The old country']]] },
  { form: 'book', tier: 2, title: 'A Tale of Two Cities', source: 'Charles Dickens, 1859',
    lines: ['It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness…'],
    qs: [['It was the best of times and also the…', 'Worst of times', ['Dullest of times', 'Strangest of times', 'Last of times', 'Longest of times']],
      ['It was the age of wisdom and the age of…', 'Foolishness', ['Ignorance', 'Sorrow', 'Madness', 'Plenty']],
      ['It was the epoch of belief and the epoch of…', 'Incredulity', ['Doubt', 'Despair', 'Reason', 'Wonder']]] },
  { form: 'book', tier: 2, title: 'The Ferry Ledger', source: 'Hollowmere ferry ledger, autumn 1887',
    lines: ['The ferryman counted eleven lanterns on the far bank that night, though only nine families lived there. By morning two boats were missing, and the brass key to the vault hung on the wrong hook.'],
    qs: [['How many lanterns did the ferryman count?', 'Eleven', ['Nine', 'Seven', 'Twelve', 'Three']],
      ['How many families lived on the far bank?', 'Nine', ['Eleven', 'Seven', 'Five', 'Twelve']],
      ['What hung on the wrong hook?', 'The brass key to the vault', ['The ferryman’s coat', 'A lantern', 'The chapel bell rope', 'The ledger itself']]] },
  { form: 'book', tier: 3, title: 'The Beekeeper’s Diary', source: 'A diary found in the lodge attic',
    lines: ['Tuesday. Hester left the beehives unlocked again. The Organist swears she heard footsteps in the chapel at four, yet the chapel clock stopped at a quarter past three. Somebody is lying, and they wear green gloves.'],
    qs: [['What was left unlocked?', 'The beehives', ['The stables', 'The chapel', 'The vault', 'The cellar']],
      ['When did the chapel clock stop?', 'A quarter past three', ['Four o’clock', 'Half past three', 'Three o’clock', 'A quarter to four']],
      ['What does the liar wear?', 'Green gloves', ['A red scarf', 'Brass spectacles', 'A grey shawl', 'Black boots']]] },
  { form: 'book', tier: 3, title: 'The Archivist’s Notes', source: 'Hollowmere archive, box 14',
    lines: ['Of the seven keys in the lodge, the Clockmaker holds two, the Ferryman one, and the remaining four hang in the vault behind a portrait of a woman holding a falcon. The portrait was painted in 1842 and has been moved twice.'],
    qs: [['How many keys are there in the lodge?', 'Seven', ['Five', 'Six', 'Eight', 'Nine']],
      ['Who holds two of the keys?', 'The Clockmaker', ['The Ferryman', 'The Archivist', 'The Organist', 'The Falconer']],
      ['When was the portrait painted?', '1842', ['1824', '1848', '1862', '1792']]] },
];

/* ---------- pictures: a sitting-room painting, different every time ---------- */
const COLOURS = { red: '#b8392b', blue: '#2f62b0', green: '#3d8f4c', yellow: '#dcb43a', purple: '#7d4b9e', white: '#ece6d6', black: '#202022', orange: '#d4762c' };
const cap = s => s[0].toUpperCase() + s.slice(1);
const near = (n, lo, hi) => shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(x => x !== n && x >= 0)).map(String);
const clock = (h, m) => `${h}:${String(m).padStart(2, '0')}`;

function drawPicture(p) {
  const s = [];
  s.push('<svg viewBox="0 0 480 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A painting of the lodge sitting room">');
  s.push('<rect width="480" height="300" fill="#43524b"/><rect y="190" width="480" height="62" fill="#3a2516"/><rect y="250" width="480" height="50" fill="#4b2f1b"/>');
  for (let x = 0; x < 480; x += 60) s.push(`<rect x="${x + 8}" y="200" width="44" height="42" fill="none" stroke="#2a190d" stroke-width="2"/>`);
  const wx = p.windowSide === 'left' ? 28 : 332;
  s.push(`<rect x="${wx}" y="34" width="120" height="112" fill="#13223a"/>`);
  const mx = wx + 78, my = 70;
  if (p.moon === 'full moon') s.push(`<circle cx="${mx}" cy="${my}" r="17" fill="#ece8d2"/>`);
  if (p.moon === 'half moon') s.push(`<path d="M ${mx} ${my - 17} A 17 17 0 0 1 ${mx} ${my + 17} Z" fill="#ece8d2"/>`);
  if (p.moon === 'crescent moon') s.push(`<circle cx="${mx}" cy="${my}" r="17" fill="#ece8d2"/><circle cx="${mx - 8}" cy="${my - 3}" r="15" fill="#13223a"/>`);
  s.push(`<rect x="${wx}" y="34" width="120" height="112" fill="none" stroke="#2a1a10" stroke-width="7"/><line x1="${wx + 60}" y1="34" x2="${wx + 60}" y2="146" stroke="#2a1a10" stroke-width="5"/><line x1="${wx}" y1="90" x2="${wx + 120}" y2="90" stroke="#2a1a10" stroke-width="5"/>`);
  s.push(`<rect x="${wx - 8}" y="146" width="136" height="9" fill="#2a1a10"/>`);
  for (let i = 0; i < p.birds; i++) { const bx = wx + 18 + i * 30; s.push(`<ellipse cx="${bx}" cy="139" rx="10" ry="7" fill="#151515"/><circle cx="${bx + 9}" cy="132" r="5" fill="#151515"/><path d="M ${bx + 13} 132 l 6 1 l -6 2 z" fill="#d9a23a"/>`); }
  // clock
  const hr = ((p.hour % 12) + p.minute / 60) * 30 * Math.PI / 180, mn = p.minute * 6 * Math.PI / 180;
  s.push('<circle cx="240" cy="62" r="34" fill="#b08a45"/><circle cx="240" cy="62" r="29" fill="#ece2c8"/>');
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s.push(`<line x1="${240 + Math.sin(a) * 24}" y1="${62 - Math.cos(a) * 24}" x2="${240 + Math.sin(a) * 28}" y2="${62 - Math.cos(a) * 28}" stroke="#3a2a1a" stroke-width="${i % 3 ? 1.5 : 3}"/>`); }
  s.push(`<line x1="240" y1="62" x2="${240 + Math.sin(hr) * 15}" y2="${62 - Math.cos(hr) * 15}" stroke="#1a120a" stroke-width="4" stroke-linecap="round"/>`);
  s.push(`<line x1="240" y1="62" x2="${240 + Math.sin(mn) * 23}" y2="${62 - Math.cos(mn) * 23}" stroke="#1a120a" stroke-width="2.5" stroke-linecap="round"/><circle cx="240" cy="62" r="3" fill="#1a120a"/>`);
  // frames and the shelf on the wall facing the window
  const fx = p.windowSide === 'left' ? 312 : 28;
  for (let i = 0; i < p.frames; i++) s.push(`<rect x="${fx + i * 48}" y="30" width="38" height="48" fill="#5d4a2e" stroke="#c9a34e" stroke-width="4"/><circle cx="${fx + i * 48 + 19}" cy="48" r="8" fill="#8a7350"/>`);
  s.push(`<rect x="${fx - 6}" y="150" width="150" height="8" fill="#2a1a10"/>`);
  let bx = fx;
  p.books.forEach((c, i) => { const h = 34 + ((i * 7) % 4) * 6; s.push(`<rect x="${bx}" y="${150 - h}" width="16" height="${h}" fill="${COLOURS[c]}" stroke="#120c08" stroke-width="1.5"/>`); bx += 18; });
  // table, candles, vase
  s.push('<rect x="150" y="206" width="180" height="12" fill="#2b190d"/><rect x="162" y="218" width="10" height="40" fill="#2b190d"/><rect x="308" y="218" width="10" height="40" fill="#2b190d"/>');
  for (let i = 0; i < p.candles; i++) { const cx = 166 + i * 21; s.push(`<rect x="${cx}" y="178" width="8" height="28" fill="#efe6cc" stroke="#9a8a6a"/><ellipse cx="${cx + 4}" cy="172" rx="4" ry="7" fill="#f5b342"/>`); }
  s.push(`<path d="M 296 206 q -14 -18 -4 -34 q 4 -6 0 -12 h 18 q -4 6 0 12 q 10 16 -4 34 z" fill="${COLOURS[p.vase]}" stroke="#120c08" stroke-width="1.5"/>`);
  // the cat
  if (p.cat) {
    const cx = p.windowSide === 'left' ? 400 : 80, col = COLOURS[p.cat];
    s.push(`<ellipse cx="${cx}" cy="268" rx="30" ry="15" fill="${col}" stroke="#120c08" stroke-width="1.5"/><circle cx="${cx + 26}" cy="252" r="12" fill="${col}" stroke="#120c08" stroke-width="1.5"/><path d="M ${cx + 18} 244 l 3 -12 l 6 9 z M ${cx + 28} 242 l 6 -10 l 3 12 z" fill="${col}" stroke="#120c08" stroke-width="1.5"/><path d="M ${cx - 28} 266 q -22 -4 -16 -26" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round"/>`);
  }
  s.push('</svg>');
  return s.join('');
}

function makePicture(level) {
  const p = {
    candles: 2 + rnd(5), books: shuffle(Object.keys(COLOURS)).slice(0, 4 + rnd(4)), vase: pick(['red', 'blue', 'green', 'yellow', 'purple']),
    hour: 1 + rnd(12), minute: pick([0, 15, 30, 45]), windowSide: pick(['left', 'right']), moon: pick(['full moon', 'half moon', 'crescent moon']),
    birds: rnd(4), cat: pick(['black', 'orange', 'white', null]), frames: 1 + rnd(3),
  };
  const others = (a, list) => shuffle(list.filter(x => x !== a));
  const books = p.books.length, time = clock(p.hour, p.minute);
  const timeWrongs = shuffle([clock((p.hour % 12) + 1, p.minute), clock(((p.hour + 10) % 12) + 1, p.minute), clock(p.hour, (p.minute + 15) % 60), clock(p.hour, (p.minute + 30) % 60), clock(((p.hour + 5) % 12) + 1, (p.minute + 45) % 60)]).filter(t => t !== time);
  const tiers = [
    [['How many candles were on the table?', String(p.candles), near(p.candles, 1, 8)],
      ['What colour was the vase?', cap(p.vase), others(cap(p.vase), ['Red', 'Blue', 'Green', 'Yellow', 'Purple'])]],
    [['What could be seen of the moon?', cap(p.moon), others(cap(p.moon), ['Full moon', 'Half moon', 'Crescent moon', 'No moon at all', 'Two moons'])],
      ['How many birds sat on the window sill?', String(p.birds), near(p.birds, 0, 5)],
      ['What colour was the cat?', p.cat ? cap(p.cat) : 'There was no cat', others(p.cat ? cap(p.cat) : 'There was no cat', ['Black', 'Orange', 'White', 'Grey', 'There was no cat'])]],
    [['How many books stood on the shelf?', String(books), near(books, 2, 9)],
      ['How many picture frames hung on the wall?', String(p.frames), near(p.frames, 0, 5)],
      ['On which side was the window?', p.windowSide === 'left' ? 'On the left' : 'On the right', ['On the left', 'On the right', 'In the middle', 'There was no window'].filter(x => x !== (p.windowSide === 'left' ? 'On the left' : 'On the right'))]],
    [['What time did the clock show?', time, timeWrongs],
      ['What colour was the book at the far right of the shelf?', cap(p.books[books - 1]), others(cap(p.books[books - 1]), Object.keys(COLOURS).map(cap))]],
    [['What colour was the third book from the left?', cap(p.books[2]), others(cap(p.books[2]), p.books.map(cap).concat(['Grey']))],
      ['What time did the clock show?', time, timeWrongs],
      ['How many candles and how many birds were there?', `${p.candles} candles, ${p.birds} birds`, shuffle([`${p.birds} candles, ${p.candles} birds`, `${p.candles + 1} candles, ${p.birds} birds`, `${p.candles} candles, ${(p.birds + 1) % 4} birds`, `${Math.max(1, p.candles - 1)} candles, ${p.birds + 1} birds`]).filter(x => x !== `${p.candles} candles, ${p.birds} birds`)]],
  ];
  const [prompt, answer, wrong] = pick(tiers[level - 1]);
  return { prompt, answer, wrong: [...new Set(wrong)].filter(w => w !== answer), svg: drawPicture(p) };
}

/* one reading for this round; `used` remembers titles already shown this game */
function makeReading(level, form, used) {
  const L = LEVELS[level - 1];
  let item;
  if (form === 'picture') {
    const pic = makePicture(level);
    item = { form, title: 'The Sitting Room', source: 'A painting that hangs in the lodge hall', svg: pic.svg, prompt: pic.prompt, answer: pic.answer, wrong: pic.wrong, read: L.read + 4 };
  } else {
    let pool = TEXTS.filter(t => t.form === form && !used.has(t.title));
    if (!pool.length) pool = TEXTS.filter(t => !used.has(t.title));
    if (!pool.length) pool = TEXTS;
    const best = Math.min(...pool.map(t => Math.abs(t.tier - L.tier)));
    const t = pick(pool.filter(x => Math.abs(x.tier - L.tier) === best));
    used.add(t.title);
    const [prompt, answer, wrong] = t.qs[L.q];
    item = { form, title: t.title, source: t.source, lines: t.lines, prompt, answer, wrong, read: L.read };
  }
  const options = shuffle([item.answer, ...shuffle(item.wrong).slice(0, L.options - 1)]);
  return { form: item.form, title: item.title, source: item.source, lines: item.lines, svg: item.svg, prompt: item.prompt,
    options, answer: options.indexOf(item.answer), read: item.read, level, levelName: L.name };
}

/* shown at every vote; a voter picks one or two */
const REASONS = [
  'Named in one of the clues',
  'Their answers on the readings seem off',
  'Too quiet in the council',
  'Keeps pushing suspicion onto others',
  'Defended someone suspicious',
  'Their story keeps changing',
  'Voted strangely before',
  'Just a gut feeling',
];

module.exports = { makeReading, levelFor, LEVELS, REASONS, TEXTS };
