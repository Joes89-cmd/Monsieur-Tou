'use strict';
// Plays full all-bot games at every lodge size and checks each one reaches a winner.
process.env.SPEED = '0.002';
const { newRoom, startGame, view, rooms } = require('../server.js');

function play(seats) {
  return new Promise((ok, bad) => {
    const room = newRoom(); room.seats = seats;
    startGame(room);
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (room.phase === 'over') {
        clearInterval(iv); rooms.delete(room.code);
        const viewer = room.players[0], v = view(room, viewer);
        if (!v.winner || v.players.some(p => !p.role)) return bad(new Error('bad final view'));
        ok({ seats, side: room.winner.side, rounds: room.round, exiles: room.players.filter(p => p.fate === 'exiled').length, vanished: room.players.filter(p => p.fate === 'vanished').length });
      } else if (Date.now() - t0 > 20000) { clearInterval(iv); bad(new Error(`stuck: seats=${seats} phase=${room.phase} round=${room.round}`)); }
    }, 10);
  });
}
(async () => {
  const wins = { loyal: 0, traitor: 0 };
  for (let seats = 4; seats <= 15; seats++) for (let i = 0; i < 6; i++) {
    const r = await play(seats); wins[r.side]++;
    if (i === 0) console.log(JSON.stringify(r));
    if (seats <= 6 && r.vanished) throw new Error('night strike in a small lodge');
  }
  console.log('all games finished', wins);
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
