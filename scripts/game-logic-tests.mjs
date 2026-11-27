import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/game.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const game = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { COLORS, START, assignPlacement, legalTokens, moveToken, progressPercent, winner } = game;

function player(color, progress = [-1, -1, -1, -1]) {
  return {
    color,
    name: color,
    ai: false,
    tokens: progress.map(value => ({ progress: value }))
  };
}
function absoluteProgress(color, absoluteIndex) {
  return (absoluteIndex - START[color] + 52) % 52;
}
let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  process.stdout.write(`✓ ${name}\n`);
}

// All supported player counts and colour setups remain valid inputs to the engine.
for (const count of [2, 3, 4]) {
  const selected = count === 2 ? ["red", "yellow"] : count === 3 ? ["red", "green", "yellow"] : COLORS;
  test(`${count}-player setup accepts a six to bring a token out`, () => {
    const players = selected.map(color => player(color));
    assert.deepEqual(legalTokens(players[0], 6, players), [0, 1, 2, 3]);
  });
}

test("a token cannot leave base without rolling six", () => {
  assert.deepEqual(legalTokens(player("red"), 5), []);
});

test("a token can finish only with an exact roll", () => {
  const p = player("red", [55, -1, -1, -1]);
  assert.deepEqual(legalTokens(p, 1), [0]);
  assert.deepEqual(legalTokens(p, 2), []);
});

test("an exact home-lane finish is allowed even when a friendly token is ahead", () => {
  const red = player("red", [51, 54, -1, -1]);
  assert.deepEqual(legalTokens(red, 5, [red]), [0]);
  const result = moveToken([red], 0, 0, 5);
  assert.equal(result.players[0].tokens[0].progress, 56);
  assert.equal(result.finished, true);
});

test("a blockade on an ordinary track cell blocks passing through it", () => {
  const red = player("red", [4, -1, -1, -1]);
  const yellowProgress = absoluteProgress("yellow", 6);
  const yellow = player("yellow", [yellowProgress, yellowProgress, -1, -1]);
  assert.deepEqual(legalTokens(red, 2, [red, yellow]), []);
});

test("a pair on an opponent starting cell does not block passing through", () => {
  const red = player("red", [24, -1, -1, -1]);
  const yellow = player("yellow", [0, 0, -1, -1]);
  assert.deepEqual(legalTokens(red, 2, [red, yellow]), [0]);
});

test("landing on an unprotected opponent token captures it", () => {
  const red = player("red", [4, -1, -1, -1]);
  const yellow = player("yellow", [absoluteProgress("yellow", 5), -1, -1, -1]);
  const result = moveToken([red, yellow], 0, 0, 1);
  assert.equal(result.captured, 1);
  assert.equal(result.players[1].tokens[0].progress, -1);
});

test("landing on a safe square does not capture", () => {
  const red = player("red", [7, -1, -1, -1]);
  const yellow = player("yellow", [absoluteProgress("yellow", 8), -1, -1, -1]);
  const result = moveToken([red, yellow], 0, 0, 1);
  assert.equal(result.captured, 0);
  assert.equal(result.players[1].tokens[0].progress, absoluteProgress("yellow", 8));
});

test("winner is declared only after all four tokens finish", () => {
  assert.equal(winner(player("red", [56, 56, 56, 56])), true);
  assert.equal(winner(player("red", [56, 56, 56, 55])), false);
});


test("progress percentage averages all four tokens across their complete routes", () => {
  assert.equal(progressPercent(player("red", [-1, -1, -1, -1])), 0);
  assert.equal(progressPercent(player("red", [56, 56, 56, 56])), 100);
  assert.equal(progressPercent(player("red", [28, 28, -1, -1])), 25);
});

test("the first finisher is ranked first while remaining players continue", () => {
  const players = [player("red", [56, 56, 56, 56]), player("green"), player("yellow")];
  const result = assignPlacement(players, 0);
  assert.equal(result.completed, false);
  assert.equal(result.players[0].rank, 1);
  assert.equal(result.players[1].rank, undefined);
  assert.equal(result.nextTurn, 1);
});

test("the final remaining player is assigned the last place and ends the match", () => {
  const players = [player("red", [56, 56, 56, 56]), player("green", [56, 56, 56, 56]), player("yellow")];
  const result = assignPlacement(players, 1);
  assert.equal(result.completed, true);
  assert.deepEqual(result.players.map(item => item.rank), [1, 2, 3]);
  assert.equal(result.nextTurn, -1);
  assert.equal(result.winner, "red");
});

test("placement selection skips players who have already finished", () => {
  const players = [player("red", [56, 56, 56, 56]), player("green"), player("yellow", [56, 56, 56, 56]), player("blue")];
  const result = assignPlacement(players, 2);
  assert.equal(result.players[2].rank, 2);
  assert.equal(result.completed, false);
  assert.equal(result.nextTurn, 3);
});

process.stdout.write(`\n${passed} game logic checks passed.\n`);
