export type Color = "red" | "green" | "yellow" | "blue";
export type Token = { progress: number };
export type Player = { color: Color; name: string; ai: boolean; tokens: Token[]; rank?: number };

export const COLORS: Color[] = ["red", "green", "yellow", "blue"];
export const COLOR_NAMES: Record<Color, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };
export const PALETTE: Record<Color, string> = { red: "#df5357", green: "#23966b", yellow: "#e5b63f", blue: "#4788ca" };

export const TRACK: [number, number][] = [
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]
];
export const START: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const HOME_LANES: Record<Color, [number, number][]> = {
  red: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  green: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  blue: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]]
};
export const BASES: Record<Color, { x: number; y: number }> = {
  red: {x:0,y:0}, green: {x:9,y:0}, yellow: {x:9,y:9}, blue: {x:0,y:9}
};
export const BASE_SPOTS: Record<Color, [number, number][]> = {
  red: [[2.05,2.05],[4,2.05],[2.05,4],[4,4]],
  green: [[11,2.05],[12.95,2.05],[11,4],[12.95,4]],
  yellow: [[11,11],[12.95,11],[11,12.95],[12.95,12.95]],
  blue: [[2.05,11],[4,11],[2.05,12.95],[4,12.95]]
};

/*
 * A token's progress is always measured from its own coloured start:
 * -1 = base, 0..50 = shared outer track, 51..56 = its six home-lane cells.
 * Build each colour's complete 57-cell route once so drawing, movement and
 * capture checks all use the exact same source of truth.
 */
export const ROUTES: Record<Color, [number, number][]> = Object.fromEntries(
  COLORS.map(color => [
    color,
    [
      ...Array.from({ length: 51 }, (_, step) => TRACK[(START[color] + step) % TRACK.length]),
      ...HOME_LANES[color]
    ]
  ])
) as Record<Color, [number, number][]>;

export function trackPosition(color: Color, progress: number): [number, number] | null {
  if (!Number.isInteger(progress) || progress < 0 || progress > 50) return null;
  return ROUTES[color][progress];
}

export function tokenPosition(color: Color, token: Token, index: number): [number, number] {
  if (token.progress === -1) return BASE_SPOTS[color][index] ?? BASE_SPOTS[color][0];
  if (!Number.isInteger(token.progress) || token.progress < 0 || token.progress > 56) {
    return BASE_SPOTS[color][index] ?? BASE_SPOTS[color][0];
  }
  return ROUTES[color][token.progress];
}

function isBlockade(players: Player[], x: number, y: number): boolean {
  return players.some(player => {
    const sameCell = player.tokens.filter(token => {
      if (token.progress < 0 || token.progress > 50) return false;
      const [tx, ty] = ROUTES[player.color][token.progress];
      return tx === x && ty === y;
    });
    return sameCell.length >= 2;
  });
}

function pathIsClear(player: Player, token: Token, dice: number, players: Player[]): boolean {
  // Home lanes are private to each colour: a friendly token farther ahead
  // must never create a blockade or prevent an exact finish.
  if (token.progress >= 51 && token.progress <= 55) return true;
  const start = token.progress === -1 ? -1 : token.progress;
  const end = token.progress === -1 ? 0 : token.progress + dice;
  // Starting cells are safe squares: a pair parked there does not block other tokens passing through.
  for (let step = Math.max(0, start + 1); step <= Math.min(50, end); step++) {
    const absoluteTrackIndex = (START[player.color] + step) % TRACK.length;
    if (Object.values(START).includes(absoluteTrackIndex)) continue;
    const [x, y] = ROUTES[player.color][step];
    if (isBlockade(players, x, y)) return false;
  }
  return true;
}

export function legalTokens(player: Player, dice: number, players: Player[] = [player]): number[] {
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) return [];
  return player.tokens.flatMap((token, index) => {
    if (token.progress === -1) {
      return dice === 6 && pathIsClear(player, token, dice, players) ? [index] : [];
    }
    if (Number.isInteger(token.progress) && token.progress >= 0 && token.progress < 56 &&
        token.progress + dice <= 56 && pathIsClear(player, token, dice, players)) return [index];
    return [];
  });
}

export function moveToken(
  players: Player[],
  playerIndex: number,
  tokenIndex: number,
  dice: number
): { players: Player[]; captured: number; finished: boolean } {
  const player = players[playerIndex];
  if (!player || !Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= player.tokens.length ||
      !legalTokens(player, dice, players).includes(tokenIndex)) {
    return { players, captured: 0, finished: false };
  }

  const next = players.map(p => ({ ...p, tokens: p.tokens.map(t => ({ ...t })) }));
  const mover = next[playerIndex];
  const token = mover.tokens[tokenIndex];
  token.progress = token.progress === -1 ? 0 : token.progress + dice;

  let captured = 0;
  // Only tokens on the shared outer track can capture or be captured.
  if (token.progress >= 0 && token.progress <= 50) {
    const landing = ROUTES[mover.color][token.progress];
    const absoluteTrackIndex = (START[mover.color] + token.progress) % TRACK.length;
    if (!SAFE.has(absoluteTrackIndex)) {
      next.forEach((opponent, opponentIndex) => {
        if (opponentIndex === playerIndex) return;
        opponent.tokens.forEach(other => {
          if (other.progress < 0 || other.progress > 50) return;
          const opponentCell = ROUTES[opponent.color][other.progress];
          if (opponentCell[0] === landing[0] && opponentCell[1] === landing[1]) {
            other.progress = -1;
            captured += 1;
          }
        });
      });
    }
  }

  return { players: next, captured, finished: token.progress === 56 };
}

export function progressPercent(player: Player): number {\n  if (!player.tokens.length) return 0;\n  const total = player.tokens.reduce((sum, token) => sum + Math.max(0, Math.min(56, token.progress)), 0);\n  return Math.round((total / (player.tokens.length * 56)) * 100);\n}\n\nexport function assignPlacement(players: Player[], playerIndex: number): { players: Player[]; completed: boolean; nextTurn: number; winner: string | null } {
  if (!players[playerIndex] || players[playerIndex].rank) {
    return { players, completed: players.every(player => !!player.rank), nextTurn: -1, winner: players.find(player => player.rank === 1)?.name ?? null };
  }
  const place = players.filter(player => player.rank).length + 1;
  let ranked = players.map((player, index) => index === playerIndex ? { ...player, rank: place } : player);
  const unfinished = ranked.filter(player => !player.rank);
  const completed = unfinished.length <= 1;
  if (completed && unfinished.length === 1) ranked = ranked.map(player => player.rank ? player : { ...player, rank: place + 1 });
  const nextTurn = completed ? -1 : Array.from({ length: ranked.length }, (_, offset) => (playerIndex + offset + 1) % ranked.length).find(index => !ranked[index].rank) ?? -1;
  return { players: ranked, completed, nextTurn, winner: ranked.find(player => player.rank === 1)?.name ?? null };
}

export function winner(player: Player): boolean {
  return player.tokens.length === 4 && player.tokens.every(token => token.progress === 56);
}

function isThreatened(players: Player[], playerIndex: number, color: Color, progress: number): boolean {
  if (progress < 0 || progress > 50) return false;
  const absoluteTarget = (START[color] + progress) % TRACK.length;
  if (SAFE.has(absoluteTarget)) return false;

  const ownTokensOnCell = players[playerIndex].tokens.filter(token => {
    if (token.progress < 0 || token.progress > 50) return false;
    return (START[color] + token.progress) % TRACK.length === absoluteTarget;
  }).length;
  // A friendly pair forms a blockade and cannot be captured.
  if (ownTokensOnCell >= 2) return false;

  return players.some((opponent, opponentIndex) => {
    if (opponentIndex === playerIndex) return false;
    return opponent.tokens.some(token => {
      if (token.progress < 0 || token.progress > 50) return false;
      const absoluteOpponent = (START[opponent.color] + token.progress) % TRACK.length;
      const distance = (absoluteTarget - absoluteOpponent + TRACK.length) % TRACK.length;
      return distance >= 1 && distance <= 6;
    });
  });
}

export function chooseAiToken(players: Player[], playerIndex: number, dice: number, legal: number[]): number {
  if (!legal.length || !players[playerIndex]) return -1;
  const player = players[playerIndex];
  let best = legal[0];
  let bestScore = -Infinity;

  for (const index of legal) {
    const before = player.tokens[index].progress;
    const result = moveToken(players, playerIndex, index, dice);
    if (result.players === players) continue;

    const after = result.players[playerIndex].tokens[index].progress;
    let score = Math.max(0, after) * 5;

    // Prioritise getting tokens into play, finishing, and capturing opponents.
    if (before === -1) score += 700;
    if (after === 56) score += 12000;
    else if (after > 50 && before <= 50) score += 1100;
    score += result.captured * 2200;

    if (after >= 0 && after <= 50) {
      const absolute = (START[player.color] + after) % TRACK.length;
      if (SAFE.has(absolute)) score += 260;

      const hasFriendlyToken = result.players[playerIndex].tokens.some((token, otherIndex) =>
        otherIndex !== index && token.progress >= 0 && token.progress <= 50 &&
        (START[player.color] + token.progress) % TRACK.length === absolute
      );
      if (hasFriendlyToken) score += 380;

      if (isThreatened(result.players, playerIndex, player.color, after)) score -= 1900;
    }

    // Prefer moving a token away from an exposed square when another move is otherwise comparable.
    if (before >= 0 && before <= 50 && isThreatened(players, playerIndex, player.color, before)) {
      score += 220;
    }

    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}
