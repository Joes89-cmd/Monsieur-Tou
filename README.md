# Hollowmere

A hidden-traitor investigation game for 4 to 15 players. Each player joins from their own phone with a four-letter lodge code; computer players fill empty seats.

## Play at home

Double-click `Start Hollowmere.bat` (or run `node server.js`) and open the address it prints. Phones on the same Wi-Fi can join.

## Host it online

The game is a single Node server with no dependencies. Any host that runs `node server.js` and provides a `PORT` works. `render.yaml` sets it up on Render's free plan.

All games live in the server's memory: a restart, or the free plan going to sleep after about 15 idle minutes, ends any game in progress.

## Test

`npm test` plays all-bot games at every table size and checks each one reaches a winner.
