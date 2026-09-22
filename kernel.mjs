// kernel.mjs
// FoldGate — the smallest unit of NODE: possibility-layer + collapse-on-intent.
// Pure, total. No I/O. Bad input returns {ok:false, why:...} instead of throwing.

/**
 * collapse(candidates, seed, scoreFn)
 * Deterministically picks exactly ONE winner from candidates.
 * - Idempotent: same (candidates, seed, scoreFn) -> same winner/index/score every call.
 * - Seed-sensitive: scoreFn receives the seed, so different seeds MAY select different winners.
 * - Never mutates candidates (read-only iteration; input array/objects untouched).
 *
 * scoreFn(candidate, seed, index) -> finite number (higher wins; first max wins ties).
 *
 * Returns:
 *   ok:true  -> { ok:true, winner, index, score, seed }
 *   ok:false -> { ok:false, why }
 */
export function collapse(candidates, seed, scoreFn) {
  if (!Array.isArray(candidates)) {
    return { ok: false, why: 'candidates must be an array' };
  }
  if (candidates.length === 0) {
    return { ok: false, why: 'candidates must not be empty' };
  }
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return { ok: false, why: 'seed must be a finite number' };
  }
  if (typeof scoreFn !== 'function') {
    return { ok: false, why: 'scoreFn must be a function' };
  }

  let bestIndex = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    let score;
    try {
      score = scoreFn(candidates[i], seed, i);
    } catch (err) {
      return {
        ok: false,
        why: `scoreFn threw at index ${i}: ${err && err.message ? err.message : String(err)}`
      };
    }
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return {
        ok: false,
        why: `scoreFn must return a finite number, got ${typeof score} at index ${i}`
      };
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return {
    ok: true,
    winner: candidates[bestIndex],
    index: bestIndex,
    score: bestScore,
    seed
  };
}

/**
 * isIdempotent(candidates, seed, scoreFn)
 * Pure helper: true iff two independent collapses of the same input agree
 * (same ok-ness, and same why on failure, or same index+score on success).
 */
export function isIdempotent(candidates, seed, scoreFn) {
  const a = collapse(candidates, seed, scoreFn);
  const b = collapse(candidates, seed, scoreFn);
  if (a.ok !== b.ok) return false;
  if (!a.ok) return a.why === b.why;
  return a.index === b.index && a.score === b.score;
}
