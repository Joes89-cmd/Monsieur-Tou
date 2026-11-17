'use strict';
/* Hollowmere — a hidden-traitor investigation game.
   Zero-dependency Node server: serves the page, keeps every secret on the
   server, and pushes each player only what that player may know. */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const SPEED = Number(process.env.SPEED) || 1;            // <1 speeds every timer up (tests)
const T = s => Math.max(20, s * 1000 * SPEED);

const CHARACTERS = [
  { title: 'Cartographer', bot: 'Odile' }, { title: 'Apothecary', bot: 'Bram' },
  { title: 'Falconer', bot: 'Isaure' }, { title: 'Clockmaker', bot: 'Tobias' },
  { title: 'Archivist', bot: 'Maren' }, { title: 'Brewer', bot: 'Kasimir' },
  { title: 'Lamplighter', bot: 'Nell' }, { title: 'Ferryman', bot: 'Anselm' },
  { title: 'Seamstress', bot: 'Ottoline' }, { title: 'Gamekeeper', bot: 'Rurik' },
  { title: 'Organist', bot: 'Solveig' }, { title: 'Glassblower', bot: 'Emeric' },
  { title: 'Stablehand', bot: 'Wren' }, { title: 'Astronomer', bot: 'Leopold' },
  { title: 'Beekeeper', bot: 'Hester' },
];
const QUESTS = ['cipher', 'sequence', 'observe', 'expedition', 'search'];
const ROOMS = ['Library', 'Boathouse', 'Cellar', 'Aviary', 'Chapel', 'Greenhouse', 'Attic', 'Kitchen'];
const WORDS = ['LANTERN', 'MARSHES', 'CELLARS', 'FALCONS', 'ORCHARD', 'COMPASS', 'HARVEST', 'WHISPER',
  'CANDLES', 'BRAMBLE', 'THISTLE', 'FERRIES', 'VINTAGE', 'SHADOWS', 'TRINKET', 'KESTREL'];
const ITEMS = ['brass key', 'ink bottle', 'pocket watch', 'folded map', 'wax seal', 'silver spoon', 'reading glasses',
  'candle stub', 'ferry ticket', 'dried thistle', 'chess knight', 'letter opener', 'tin whistle', 'magnifying lens',
  'glove', 'matchbox', 'compass', 'hip flask', 'playing card', 'feather quill'];

const rooms = new Map();
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uid = () => crypto.randomBytes(6).toString('hex');
const alive = room => room.players.filter(p => p.alive);
const byId = (room, id) => room.players.find(p => p.id === id);
const label = p => p.name;
const list = names => names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];

/* ---------- rooms and seats ---------- */
function newRoom() {
  let code; do { code = Array.from({ length: 4 }, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ')).join(''); } while (rooms.has(code));
  const room = { code, players: [], hostId: null, seats: 6, phase: 'lobby', seq: 0, timer: null, ends: 0, round: 0, maxRounds: 0,
    chat: [], tchat: [], clues: [], events: [], sus: {}, ready: new Set(), pendingFn: null, resolveFn: null, touched: Date.now() };
  rooms.set(code, room);
  return room;
}
function freeChar(room) { const used = new Set(room.players.map(p => p.char)); return CHARACTERS.findIndex((_, i) => !used.has(i)); }
function addPlayer(room, name, token, bot) {
  const char = freeChar(room);
  const p = { id: uid(), token, bot: !!bot, char, name: bot ? CHARACTERS[char].bot : name, alive: true, role: null, fate: null, notes: [], conns: new Set() };
  room.players.push(p);
  if (!bot && !room.hostId) room.hostId = p.id;
  return p;
}

/* ---------- phase machine ---------- */
function setTimer(room, secs, fn) {
  clearTimeout(room.timer);
  const seq = ++room.seq;
  room.ends = Date.now() + T(secs);
  room.timer = setTimeout(() => { if (room.seq === seq) { fn(); push(room); } }, T(secs));
}
function stage(room, phase, secs, pendingFn, resolveFn, botFn) {
  room.phase = phase; room.pendingFn = pendingFn; room.resolveFn = resolveFn; room.ready = new Set();
  setTimer(room, secs, resolveFn);
  const seq = room.seq;
  const later = (ms, fn) => setTimeout(() => { if (room.seq === seq && room.phase !== 'over') { fn(); tick(room); } }, ms);
  if (botFn) for (const b of room.players.filter(p => p.bot && p.alive)) later(T(1 + Math.random() * 3), () => botFn(b));
  later(0, () => {});
}
function tick(room) {
  if (room.pendingFn && room.phase !== 'over' && room.phase !== 'lobby' && room.pendingFn().length === 0) room.resolveFn();
  push(room);
}
// viewing phases wait for every connected, living human to press Continue
const readyPending = (room, livingOnly) => () => room.players.filter(p => !p.bot && p.conns.size && (p.alive || !livingOnly) && !room.ready.has(p.id)).map(p => p.id);
const event = (room, text) => room.events.push({ round: room.round, text });

/* ---------- game flow ---------- */
function startGame(room) {
  room.players = room.players.filter(p => !p.bot);
  while (room.players.length < room.seats) addPlayer(room, '', null, true);
  const n = room.players.length;
  const traitors = n <= 7 ? 1 : n <= 12 ? 2 : 3;
  shuffle(room.players).forEach((p, i) => { p.role = i < traitors ? 'traitor' : 'loyal'; p.alive = true; p.fate = null; p.notes = []; });
  Object.assign(room, { round: 0, maxRounds: n <= 6 ? 6 : 10, vault: 0, stolen: 0, clues: [], events: [], sus: {}, winner: null,
    deck: [], leaderIdx: rnd(n), chat: [], tchat: [], last: null, quest: null, council: null, night: null, dawn: null });
  stage(room, 'roles', 30, readyPending(room), () => nextRound(room));
}
function nextRound(room) {
  if (room.round >= room.maxRounds) return endGame(room, 'traitor', 'The last night passed with a traitor still inside. By morning the vault is empty.');
  room.round++;
  if (!room.deck.length) room.deck = shuffle(QUESTS);
  const kind = room.deck.pop();
  if (kind === 'expedition') startExpedition(room); else if (kind === 'search') startSearch(room); else startPuzzle(room, kind);
}
function checkWin(room) {
  const t = alive(room).filter(p => p.role === 'traitor').length, l = alive(room).length - t;
  if (t === 0) return endGame(room, 'loyal', 'Every traitor has been exiled. The vault is safe.'), true;
  if (t >= l) return endGame(room, 'traitor', 'The traitors now match the loyal members in number. The lodge is theirs.'), true;
  return false;
}
function endGame(room, side, reason) {
  clearTimeout(room.timer); room.seq++; room.pendingFn = null; room.ends = 0;
  room.phase = 'over'; room.winner = { side, reason };
  event(room, reason);
}
const councilDue = room => alive(room).length > 6 || room.round % 2 === 0 || room.round === room.maxRounds;

/* ---------- clues ---------- */
function makeClue(room, truthful, kind) {
  const al = alive(room), ts = al.filter(p => p.role === 'traitor'), ls = al.filter(p => p.role === 'loyal');
  kind = kind || (Math.random() < 0.5 ? 'group' : 'pair');
  if (kind === 'pair' && truthful) {
    const [a, b] = shuffle(al);
    return { ids: [], text: `${label(a)} and ${label(b)} are on ${a.role === b.role ? 'the same side' : 'opposite sides'}.` };
  }
  const k = Math.min(al.length >= 10 ? 4 : 3, al.length - 1);
  const group = truthful ? [pick(ts), ...shuffle(ls).slice(0, k - 1)] : shuffle(ls).slice(0, k);
  const ids = shuffle(group).map(p => p.id);
  return { ids, text: `At least one traitor is among ${list(ids.map(id => label(byId(room, id))))}.` };
}
function reward(room, success) {
  if (!success) { room.stolen += 100; return; }
  room.vault += 100;
  const clue = makeClue(room, true);
  for (const id of clue.ids) room.sus[id] = (room.sus[id] || 0) + 1.5 / clue.ids.length;
  room.clues.push({ round: room.round, text: clue.text });
  room.last.clue = clue.text;
}
function toResult(room, line) {
  event(room, line);
  stage(room, 'qresult', 40, readyPending(room), () => councilDue(room) ? startCouncil(room) : nextRound(room));
}

/* ---------- quests: three puzzles ---------- */
function makePuzzle(kind) {
  if (kind === 'cipher') {
    const word = pick(WORDS), shift = 3 + rnd(9);
    const enc = [...word].map(c => String.fromCharCode((c.charCodeAt(0) - 65 + shift) % 26 + 65)).join('');
    const options = shuffle([word, ...shuffle(WORDS.filter(w => w !== word)).slice(0, 3)]);
    return { title: 'The Sealed Note', time: 45, options, answer: options.indexOf(word),
      prompt: `A sealed note reads “${enc}”. The cipher wheel is set so that A is written as ${String.fromCharCode(65 + shift)}. What does the note say?` };
  }
  if (kind === 'sequence') {
    const a = 2 + rnd(8), x = 2 + rnd(5), y = 1 + rnd(6);
    const gens = [
      () => { const s = [a]; for (let i = 0; i < 5; i++) s.push(s[i] + (i % 2 ? y + 3 : x)); return s; },
      () => { const s = [a]; for (let i = 0; i < 5; i++) s.push(s[i] * 2 - (x - 2)); return s; },
      () => Array.from({ length: 6 }, (_, i) => (i + x) * (i + x) + y),
      () => { const s = [a, a + x]; for (let i = 2; i < 6; i++) s.push(s[i - 1] + s[i - 2]); return s; },
      () => { const s = [60 + a * 3]; for (let i = 0; i < 5; i++) s.push(s[i] - (i + 1) * x); return s; },
    ];
    const s = pick(gens)(), ans = s[5], wrong = new Set();
    while (wrong.size < 3) { const w = ans + pick([-6, -4, -3, -2, -1, 1, 2, 3, 4, 6]); if (w !== ans) wrong.add(w); }
    const options = shuffle([ans, ...wrong]).map(String);
    return { title: 'The Vault Ledger', time: 45, options, answer: options.indexOf(String(ans)),
      prompt: `The vault ledger lists ${s.slice(0, 5).join(', ')} and then a torn corner. Which entry comes next?` };
  }
  const shown = shuffle(ITEMS).slice(0, 8), absent = pick(ITEMS.filter(i => !shown.includes(i)));
  const options = shuffle([absent, ...shuffle(shown).slice(0, 3)]);
  return { title: 'The Study Table', time: 30, study: shown, studyTime: 12, options, answer: options.indexOf(absent),
    prompt: 'Which of these was NOT on the study table?' };
}
function startPuzzle(room, kind) {
  const q = room.quest = Object.assign(makePuzzle(kind), { kind, answers: {} });
  const ask = () => {
    q.stage = 'answer';
    stage(room, 'quest', q.time, () => alive(room).filter(p => !(p.id in q.answers)).map(p => p.id), () => resolvePuzzle(room), b => {
      const wrongPick = () => pick(q.options.map((_, i) => i).filter(i => i !== q.answer));
      q.answers[b.id] = (b.role === 'traitor' ? Math.random() < 0.45 : Math.random() > 0.88) ? wrongPick() : q.answer;
    });
  };
  if (!q.study) return ask();
  q.stage = 'study';
  stage(room, 'quest', q.studyTime, () => ['-'], ask);
}
function resolvePuzzle(room) {
  const q = room.quest, al = alive(room), wrong = al.filter(p => q.answers[p.id] !== q.answer).length, allowed = Math.floor(al.length / 4);
  const success = wrong <= allowed;
  room.last = { kind: q.kind, title: q.title, success, wrong, total: al.length, allowed, answerText: q.options[q.answer],
    correct: Object.fromEntries(al.map(p => [p.id, q.answers[p.id] === q.answer])) };
  reward(room, success);
  toResult(room, `${q.title}: ${success ? 'solved' : 'failed'}, ${wrong} wrong answer${wrong === 1 ? '' : 's'} out of ${al.length}.`);
}

/* ---------- quest: expedition (chosen team, secret sabotage) ---------- */
function startExpedition(room) {
  const al = alive(room), n = room.players.length;
  let leader;
  for (let i = 1; i <= n; i++) { const p = room.players[(room.leaderIdx + i) % n]; if (p.alive) { leader = p; room.leaderIdx = (room.leaderIdx + i) % n; break; } }
  const size = al.length <= 5 ? 2 : al.length <= 8 ? 3 : al.length <= 11 ? 4 : 5;
  const q = room.quest = { kind: 'expedition', title: 'The Night Crossing', stage: 'team', leader: leader.id, size, team: null, plays: {} };
  const depart = () => {
    if (!q.team) q.team = shuffle(al).slice(0, size).map(p => p.id);
    q.stage = 'mission';
    stage(room, 'quest', 35, () => q.team.filter(id => !(id in q.plays)), () => resolveExpedition(room), b => {
      if (!q.team.includes(b.id)) return;
      const first = q.team.map(id => byId(room, id)).find(p => p.role === 'traitor');
      q.plays[b.id] = b.role === 'traitor' && first === b && Math.random() < 0.65 ? 'sabotage' : 'secure';
    });
  };
  stage(room, 'quest', 45, () => q.team ? [] : [leader.id], depart, b => {
    if (b.id === leader.id) q.team = [b.id, ...shuffle(al.filter(p => p !== b)).slice(0, size - 1).map(p => p.id)];
  });
}
function resolveExpedition(room) {
  const q = room.quest, sab = q.team.filter(id => q.plays[id] === 'sabotage').length, success = sab === 0;
  if (!success) for (const id of q.team) room.sus[id] = (room.sus[id] || 0) + 0.8;
  room.last = { kind: 'expedition', title: q.title, success, team: q.team, leader: q.leader, sabotages: sab };
  reward(room, success);
  toResult(room, `${q.title}: ${list(q.team.map(id => label(byId(room, id))))} crossed. ${success ? 'The supplies arrived intact.' : sab + ' crate' + (sab === 1 ? ' was' : 's were') + ' sabotaged.'}`);
}

/* ---------- quest: search (private evidence, may be forged) ---------- */
function startSearch(room) {
  const al = alive(room), count = al.length <= 5 ? 3 : al.length <= 9 ? 4 : 5;
  const q = room.quest = { kind: 'search', title: 'The Lodge Search', rooms: shuffle(ROOMS).slice(0, count), hot: rnd(count), picks: {}, forge: {} };
  stage(room, 'quest', 40, () => alive(room).filter(p => !(p.id in q.picks)).map(p => p.id), () => resolveSearch(room), b => {
    if (b.role === 'traitor' && Math.random() < 0.5) { q.picks[b.id] = q.hot; q.forge[b.id] = Math.random() < 0.6; }
    else q.picks[b.id] = rnd(count);
  });
}
function resolveSearch(room) {
  const q = room.quest, al = alive(room);
  for (const p of al) if (!(p.id in q.picks)) q.picks[p.id] = rnd(q.rooms.length);
  const finders = al.filter(p => q.picks[p.id] === q.hot);
  const forged = finders.some(p => p.role === 'traitor' && q.forge[p.id]);
  const mine = {};
  if (finders.length) {
    const clue = makeClue(room, !forged, 'group');
    room.vault += 100;
    for (const p of finders) {
      const tail = p.role === 'traitor' ? (forged ? ' (Forged by the traitors: it names only loyal members.)' : ' (Genuine: the others in the room now know this.)')
        : finders.length > 1 ? ' (You were not alone in that room. If a traitor was with you, this may be a forgery.)' : ' (You searched alone, so nobody tampered with it.)';
      mine[p.id] = clue.text + tail;
      p.notes.push({ round: room.round, text: mine[p.id] });
    }
  } else room.stolen += 100;
  room.last = { kind: 'search', title: q.title, rooms: q.rooms, hot: q.hot, picks: q.picks, found: finders.length > 0, mine };
  toResult(room, `${q.title}: the evidence was in the ${q.rooms[q.hot]}. ${finders.length ? list(finders.map(label)) + ' found it.' : 'Nobody looked there.'}`);
}

/* ---------- council: discussion, vote, exile ---------- */
function suspect(room, b) {
  const pool = alive(room).filter(p => p !== b && (b.role !== 'traitor' || p.role === 'loyal'));
  let r = Math.random() * pool.reduce((s, p) => s + 1 + 2 * (room.sus[p.id] || 0), 0);
  for (const p of pool) { r -= 1 + 2 * (room.sus[p.id] || 0); if (r <= 0) return p; }
  return pool[0];
}
const BOT_LINES = ['I keep coming back to {n}.', '{n} has been very quiet about that last quest.', 'Something about {n} does not add up for me.',
  'If I had to name someone tonight, it would be {n}.', 'I would like to hear {n} explain themselves.', 'My vote is leaning towards {n}.'];
function startCouncil(room) {
  room.council = { votes: {}, result: null };
  stage(room, 'discuss', 150, readyPending(room, true), () => startVote(room), b => {
    if (Math.random() < 0.6) say(room, b, pick(BOT_LINES).replace('{n}', label(suspect(room, b))), 'all');
  });
}
function startVote(room) {
  const c = room.council;
  stage(room, 'vote', 50, () => alive(room).filter(p => !(p.id in c.votes)).map(p => p.id), () => resolveVote(room), b => { c.votes[b.id] = suspect(room, b).id; });
}
function resolveVote(room) {
  const c = room.council, al = alive(room), tally = {};
  for (const p of al) { const v = c.votes[p.id] || 'none'; c.votes[p.id] = v; tally[v] = (tally[v] || 0) + 1; }
  const top = Math.max(...Object.values(tally));
  let lead = Object.keys(tally).filter(k => tally[k] === top), lot = false, exiled = null;
  if (al.length > 6 && Object.keys(tally).some(k => k !== 'none')) {   // big lodges always lose someone
    delete tally.none; const best = Math.max(...Object.values(tally));
    lead = Object.keys(tally).filter(k => tally[k] === best); lot = lead.length > 1; exiled = pick(lead);
  }
  else if (lead.length === 1 && lead[0] !== 'none') exiled = lead[0];
  c.result = { votes: c.votes, exiled, lot, role: null };
  if (exiled) {
    const p = byId(room, exiled); p.alive = false; p.fate = 'exiled'; c.result.role = p.role;
    event(room, `The council exiled ${label(p)}, who was ${p.role === 'traitor' ? 'a traitor' : 'loyal'}.`);
  } else event(room, 'The council could not agree and exiled no one.');
  if (checkWin(room)) return;
  stage(room, 'verdict', 30, readyPending(room), () => alive(room).length > 6 ? startNight(room) : nextRound(room));
}

/* ---------- night: traitors strike when the lodge is crowded ---------- */
function startNight(room) {
  const n = room.night = { picks: {} };
  stage(room, 'night', 45, () => alive(room).filter(p => !(p.id in n.picks)).map(p => p.id), () => resolveNight(room), b => {
    n.picks[b.id] = (b.role === 'traitor' ? pick(alive(room).filter(p => p.role === 'loyal')) : suspect(room, b)).id;
  });
}
function resolveNight(room) {
  const n = room.night, al = alive(room), loyals = al.filter(p => p.role === 'loyal');
  const strikes = al.filter(p => p.role === 'traitor' && n.picks[p.id]);
  const humans = strikes.filter(p => !p.bot), counted = humans.length ? humans : strikes, tally = {};
  for (const p of counted) tally[n.picks[p.id]] = (tally[n.picks[p.id]] || 0) + 1;
  const top = Math.max(0, ...Object.values(tally));
  const victim = byId(room, pick(Object.keys(tally).filter(k => tally[k] === top))) || pick(loyals);
  const marks = {};
  for (const p of loyals) if (n.picks[p.id]) { marks[n.picks[p.id]] = (marks[n.picks[p.id]] || 0) + 1; room.sus[n.picks[p.id]] = (room.sus[n.picks[p.id]] || 0) + 0.3; }
  victim.alive = false; victim.fate = 'vanished';
  room.dawn = { victim: victim.id, whispers: Object.entries(marks).filter(([id]) => id !== victim.id).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => ({ id, count })) };
  event(room, `${label(victim)} vanished in the night.`);
  if (checkWin(room)) return;
  stage(room, 'dawn', 30, readyPending(room), () => nextRound(room));
}

/* ---------- chat ---------- */
function say(room, p, text, channel) {
  const log = channel === 'traitors' ? room.tchat : room.chat;
  log.push({ id: uid(), from: p.id, text: String(text).slice(0, 240) });
  if (log.length > 80) log.shift();
}

/* ---------- player actions ---------- */
function act(room, me, a) {
  const q = room.quest, isHost = me.id === room.hostId, fail = m => { throw new Error(m); };
  room.touched = Date.now();
  switch (a.type) {
    case 'char': {
      if (room.phase !== 'lobby') fail('Characters are locked once the game starts.');
      const c = Number(a.char);
      if (!CHARACTERS[c] || room.players.some(p => p.char === c && p !== me)) fail('That character is taken.');
      me.char = c; break;
    }
    case 'seats': if (isHost && room.phase === 'lobby') room.seats = Math.max(4, room.players.length, Math.min(15, Number(a.seats) || 4)); break;
    case 'start': if (isHost && room.phase === 'lobby') startGame(room); break;
    case 'again':
      if (isHost && room.phase === 'over') { room.players = room.players.filter(p => !p.bot); room.players.forEach(p => { p.role = null; p.alive = true; p.fate = null; p.notes = []; }); room.phase = 'lobby'; room.winner = null; }
      break;
    case 'skip': if (isHost && room.resolveFn && !['lobby', 'over'].includes(room.phase)) { room.resolveFn(); } break;
    case 'ready': if (me.alive || room.phase !== 'discuss') room.ready.add(me.id); break;
    case 'chat': {
      const text = String(a.text || '').trim(); if (!text) break;
      const open = room.phase === 'lobby' || room.phase === 'over';
      if (a.channel === 'traitors') { if (me.role !== 'traitor' || open) fail('That channel is closed.'); say(room, me, text, 'traitors'); }
      else { if (!me.alive && !open) fail('Exiled and vanished members cannot speak.'); say(room, me, text, 'all'); }
      break;
    }
    case 'answer':
      if (room.phase === 'quest' && q.stage === 'answer' && me.alive && !(me.id in q.answers) && q.options[a.choice] !== undefined) q.answers[me.id] = Number(a.choice);
      break;
    case 'team': {
      if (!(room.phase === 'quest' && q.kind === 'expedition' && q.stage === 'team' && me.id === q.leader)) break;
      const ids = [...new Set(a.ids || [])];
      if (ids.length !== q.size || ids.some(id => !byId(room, id) || !byId(room, id).alive)) fail(`Choose exactly ${q.size} living members.`);
      q.team = ids; break;
    }
    case 'play':
      if (room.phase === 'quest' && q.kind === 'expedition' && q.stage === 'mission' && q.team.includes(me.id) && !(me.id in q.plays))
        q.plays[me.id] = a.play === 'sabotage' && me.role === 'traitor' ? 'sabotage' : 'secure';
      break;
    case 'search':
      if (room.phase === 'quest' && q.kind === 'search' && me.alive && !(me.id in q.picks) && q.rooms[a.room] !== undefined) {
        q.picks[me.id] = Number(a.room); q.forge[me.id] = !!a.forge && me.role === 'traitor';
      }
      break;
    case 'vote': {
      const c = room.council;
      if (!(room.phase === 'vote' && me.alive && !(me.id in c.votes))) break;
      const t = a.target === 'none' ? null : byId(room, a.target);
      if (a.target === 'none' ? alive(room).length > 6 : (!t || !t.alive || t === me)) fail('Choose another living member.');
      c.votes[me.id] = t ? t.id : 'none'; break;
    }
    case 'night': {
      const n = room.night, t = byId(room, a.target);
      if (!(room.phase === 'night' && me.alive && !(me.id in n.picks))) break;
      if (!t || !t.alive || t === me || (me.role === 'traitor' && t.role === 'traitor')) fail('Choose another living member.');
      n.picks[me.id] = t.id; break;
    }
  }
  tick(room);
}

/* ---------- what one player is allowed to see ---------- */
function view(room, me) {
  const over = room.phase === 'over', seesTraitors = over || me.role === 'traitor', q = room.quest, playing = !['lobby', 'over'].includes(room.phase);
  const v = {
    code: room.code, phase: room.phase, round: room.round, maxRounds: room.maxRounds, ends: room.ends, now: Date.now(), seats: room.seats,
    hostId: room.hostId, vault: room.vault || 0, stolen: room.stolen || 0, clues: room.clues, events: room.events, winner: room.winner,
    characters: CHARACTERS.map(c => c.title), lan: lanUrls(),
    you: { id: me.id, role: me.role, alive: me.alive, notes: me.notes },
    players: room.players.map(p => ({ id: p.id, name: p.name, char: p.char, bot: p.bot, alive: p.alive, fate: p.fate, online: p.bot || p.conns.size > 0,
      role: over || p.fate === 'exiled' || (seesTraitors && p.role === 'traitor') ? p.role : (p.fate === 'vanished' ? 'loyal' : null) })),
    waiting: playing && room.pendingFn ? room.pendingFn() : [],
    ready: room.ready.has(me.id),
    chat: room.chat, tchat: me.role === 'traitor' || over ? room.tchat : null,
    councilNext: playing && councilDue(room), nightRule: alive(room).length > 6,
  };
  if (room.phase === 'quest') {
    const edge = me.role === 'traitor';
    if (q.kind === 'expedition') v.quest = { kind: q.kind, title: q.title, stage: q.stage, leader: q.leader, size: q.size, team: q.team, played: me.id in q.plays, canSabotage: edge };
    else if (q.kind === 'search') v.quest = { kind: q.kind, title: q.title, rooms: q.rooms, picked: q.picks[me.id], hot: edge ? q.hot : undefined };
    else v.quest = { kind: q.kind, title: q.title, stage: q.stage, study: q.stage === 'study' ? q.study : undefined,
      prompt: q.stage === 'answer' ? q.prompt : undefined, options: q.stage === 'answer' ? q.options : undefined,
      picked: q.answers[me.id], edge: edge && q.stage === 'answer' ? q.answer : undefined };
  }
  if (room.phase === 'qresult' && room.last) {
    const { correct, mine, ...pub } = room.last;
    v.last = Object.assign(pub, { youCorrect: correct ? correct[me.id] : undefined, yourClue: mine ? mine[me.id] : undefined });
  }
  if (room.phase === 'vote') v.voted = room.council.votes[me.id];
  if (room.phase === 'verdict') v.verdict = room.council.result;
  if (room.phase === 'night') v.nightPick = room.night.picks[me.id];
  if (room.phase === 'dawn') v.dawn = room.dawn;
  if (over && room.council && room.council.result) v.verdict = room.council.result;
  return v;
}
function push(room) {
  for (const p of room.players) if (p.conns.size) {
    const data = `data: ${JSON.stringify(view(room, p))}\n\n`;
    for (const res of p.conns) res.write(data);
  }
}
function lanUrls() {
  const out = [];
  for (const nets of Object.values(os.networkInterfaces())) for (const n of nets) if (n.family === 'IPv4' && !n.internal) out.push(`http://${n.address}:${PORT}`);
  return out;
}

/* ---------- http ---------- */
function body(req) {
  return new Promise((ok, bad) => { let s = ''; req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { bad(e); } }); });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
    }
    if (req.method === 'GET' && url.pathname === '/lodge3d.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', 'lodge3d.js')));
    }
    if (req.method === 'POST' && url.pathname === '/api/join') {
      const b = await body(req), name = String(b.name || '').trim().slice(0, 16), token = String(b.token || '');
      if (token.length < 8) return json(res, 400, { error: 'Missing seat token.' });
      let room = b.code ? rooms.get(String(b.code).toUpperCase().trim()) : null;
      if (b.code && !room) return json(res, 404, { error: 'No lodge with that code. Check the four letters.' });
      if (!room) room = newRoom();
      let p = room.players.find(x => x.token === token);
      if (!p) {
        if (!name) return json(res, 400, { error: 'Enter a name.' });
        if (room.phase !== 'lobby') return json(res, 409, { error: 'That game has already started. Wait for the next one.' });
        if (room.players.filter(x => !x.bot).length >= 15) return json(res, 409, { error: 'The lodge is full (15 members).' });
        p = addPlayer(room, name, token, false);
        room.seats = Math.max(room.seats, room.players.length);
      }
      push(room);
      return json(res, 200, { code: room.code });
    }
    if (req.method === 'POST' && url.pathname === '/api/action') {
      const b = await body(req), room = rooms.get(String(b.code || '')), me = room && room.players.find(x => x.token === b.token);
      if (!me) return json(res, 404, { error: 'You are not seated in that lodge.' });
      try { act(room, me, b); } catch (e) { return json(res, 400, { error: e.message }); }
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/stream') {
      const room = rooms.get(url.searchParams.get('code') || ''), me = room && room.players.find(x => x.token === url.searchParams.get('token'));
      if (!me) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      me.conns.add(res);
      const beat = setInterval(() => res.write(': beat\n\n'), 20000);
      req.on('close', () => { clearInterval(beat); me.conns.delete(res); push(room); });
      return push(room);
    }
    res.writeHead(404); res.end('Not found');
  } catch (e) { json(res, 500, { error: 'Server error.' }); }
});

if (require.main === module) {
  setInterval(() => { for (const [code, r] of rooms) if (Date.now() - r.touched > 6 * 3600e3) { clearTimeout(r.timer); rooms.delete(code); } }, 600e3).unref();
  server.listen(PORT, () => {
    console.log(`\n  Hollowmere is running.\n\n  On this computer:   http://localhost:${PORT}`);
    for (const u of lanUrls()) console.log(`  On the same Wi-Fi:  ${u}`);
    console.log('\n  Keep this window open while you play. Close it to stop the game.\n');
  });
}
module.exports = { newRoom, addPlayer, startGame, act, view, rooms };
