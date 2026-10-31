// ─────────────────────────────────────────────────────────────────────────
// A tiny stand-in for supabase-js's PostgrestFilterBuilder / PostgrestBuilder.
//
// WHY THIS EXISTS instead of patching window.fetch (the mechanism this
// file's own handoff brief proposed as the default): every service in
// `services/*` and several `lib/*` helpers call `supabaseCommunity.from(...)`
// / `.rpc(...)` and just `await` the result - they never see a Request/
// Response. Patching fetch would mean reconstructing PostgREST's exact wire
// contract (URL query-string encoding of every filter, `Prefer` headers for
// `.select()`-after-write, `Content-Range` for counts, the `.single()` 406
// convention) well enough that nothing downstream notices the difference.
// That is a lot of surface to get byte-perfect, and a mismatch fails as a
// confusing runtime error deep inside a service file.
//
// Patching the CLIENT'S OWN METHODS instead means the mock only has to
// reproduce the few chain calls this codebase actually uses (see the
// `Handled` union below) and hand back the exact `{ data, error, count }`
// shape the calling code already destructures - no HTTP semantics at all.
// It is also a STRONGER guarantee than a fetch patch for verification item 1
// ("zero network writes"): a request this builder resolves never calls
// `fetch` at all, matched or not - there is no wire request to have gotten
// subtly wrong. See demoShadow.ts for the part of the safety story this
// doesn't cover (auth.getSession, realtime channels) and why an unmatched
// table/RPC deliberately errors instead of falling through to the real
// network.
// ─────────────────────────────────────────────────────────────────────────

export interface FilterCall {
  method: string
  args: unknown[]
}

export type BuilderOp = 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc'

export interface HandlerCtx {
  /** Table name, or `rpc:<function_name>` for an .rpc() call. */
  table: string
  op: BuilderOp
  /** Every .eq/.in/.order/.range/... call, in call order. */
  filters: FilterCall[]
  /** The `.select(cols, opts)` columns string, if one was requested (an
   *  insert/update chains .select() to ask for the row back). */
  selectCols?: string
  /** True when `.select(..., { count: 'exact' })` (or similar) was used. */
  wantsCount: boolean
  /** The insert/update/upsert payload, or the rpc() params object. */
  payload?: unknown
  /** Which terminal shape was requested. */
  single: 'single' | 'maybeSingle' | null
}

export interface HandlerResult {
  /** An array for a list read; the handler never has to know about
   *  .single()/.maybeSingle() - shapeResult() (below) applies that. */
  data: unknown[] | null
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null
  count?: number
}

export type TableHandler = (ctx: HandlerCtx) => HandlerResult | Promise<HandlerResult>

const PGRST_NO_ROWS = 'PGRST116'

function shapeResult(result: HandlerResult, ctx: HandlerCtx) {
  const rows = result.data ?? []
  if (result.error) return { data: null, error: result.error, count: result.count }
  if (ctx.single === 'single') {
    if (rows.length === 1) return { data: rows[0], error: null, count: result.count }
    return {
      data: null,
      error: { code: PGRST_NO_ROWS, message: 'demo: no matching row for .single()', details: null, hint: null },
      count: result.count,
    }
  }
  if (ctx.single === 'maybeSingle') {
    return { data: rows[0] ?? null, error: null, count: result.count }
  }
  return { data: rows, error: null, count: result.count }
}

/** Chain methods this codebase's services actually call. Every one just
 *  records itself and returns `this` - the real filtering happens once,
 *  inside whichever table handler `.then()` looks up, so a handler can
 *  read `ctx.filters` for whatever it needs instead of this class trying to
 *  emulate real PostgREST filtering generically. */
const RECORDED_METHODS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
  'contains', 'order', 'range', 'limit', 'match', 'not', 'or',
] as const

export class FakeBuilder implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private ctx: HandlerCtx
  private getHandler: (table: string) => TableHandler | undefined
  private onMiss: (ctx: HandlerCtx) => HandlerResult

  constructor(
    table: string,
    op: BuilderOp,
    getHandler: (table: string) => TableHandler | undefined,
    onMiss: (ctx: HandlerCtx) => HandlerResult,
    payload?: unknown,
  ) {
    this.ctx = { table, op, filters: [], wantsCount: false, payload, single: null }
    this.getHandler = getHandler
    this.onMiss = onMiss
    const self = this as unknown as Record<string, (...args: unknown[]) => FakeBuilder>
    for (const m of RECORDED_METHODS) {
      self[m] = (...args: unknown[]) => { this.ctx.filters.push({ method: m, args }); return this }
    }
  }

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    this.ctx.selectCols = cols
    if (opts?.count) this.ctx.wantsCount = true
    return this
  }

  // Real supabase-js exposes these directly on the object `.from()` returns
  // (not a second builder type), and each may still be followed by
  // `.select()` (to get the row back) and/or filters (`.eq()` before an
  // update/delete) - so these just switch this same instance's op/payload
  // and stay chainable, exactly like the real thing.
  insert(payload: unknown) { this.ctx.op = 'insert'; this.ctx.payload = payload; return this }
  update(payload: unknown) { this.ctx.op = 'update'; this.ctx.payload = payload; return this }
  upsert(payload: unknown) { this.ctx.op = 'upsert'; this.ctx.payload = payload; return this }
  delete() { this.ctx.op = 'delete'; return this }

  single() { this.ctx.single = 'single'; return this }
  maybeSingle() { this.ctx.single = 'maybeSingle'; return this }

  then<TResult1 = { data: unknown; error: unknown; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as never, onrejected as never)
  }

  private async execute() {
    const handler = this.getHandler(this.ctx.table)
    const result = handler ? await handler(this.ctx) : this.onMiss(this.ctx)
    return shapeResult(result, this.ctx)
  }
}
