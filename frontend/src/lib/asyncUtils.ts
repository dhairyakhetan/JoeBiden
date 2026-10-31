// Shared timeout/retry wrapper for Supabase reads that can hang on a cold
// session load. Extracted from lib/jobOpenings.ts (its original home) so
// other call sites - e.g. services/searchService.ts - can reuse the exact
// same behavior instead of re-deriving it.
//
// The subtlety this guards against (learned the hard way in
// AuthContext.fetchMember): the cold-load failure mode is usually NOT a
// thrown error - it's a request that *hangs*. supabase-js acquires a
// navigator lock to restore/refresh the session before its first request,
// and if that stalls, the query promise never resolves and never rejects.
// A plain try/catch retry is useless against that: there's nothing to
// catch, `.then` never fires, and the caller sits blank forever. So each
// attempt races a timeout - a hung attempt rejects, which lets the retry
// actually run (by which point the session is warm and the next attempt
// returns instantly). A genuine failure still throws after the retries
// are spent, so the caller can decide how to degrade.
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`request timed out after ${ms}ms`)), ms)),
  ])
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 500, timeoutMs = 6000): Promise<T> {
  try {
    return await withTimeout(fn(), timeoutMs)
  } catch (e) {
    if (retries <= 0) throw e
    await new Promise(res => setTimeout(res, delayMs))
    return withRetry(fn, retries - 1, delayMs, timeoutMs)
  }
}
