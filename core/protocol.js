/**
 * The sync protocol's shared vocabulary: version, error codes, id shape and the command
 * whitelist boundary.
 *
 * Both halves of the plugin need these values — the Hub validates against them, a Client
 * builds requests from them, and the Agent tools name their errors with them — so they live
 * in one file rather than being duplicated per module (AGENTS.md rule 1: relative imports
 * only, no bare specifiers).
 */

import { ACTION_NAMES } from '../daily.js'

/** Bumped only for a breaking funnel change; the Hub advertises it on `/health`. */
export const PROTOCOL_VERSION = 1

/** Supported wire protocol range advertised on `/health` for rolling upgrades. */
export const PROTOCOL_RANGE = { min: 1, max: 1 }

/** Monotonic schema version of the authoritative domain tables. */
export const DATA_SCHEMA_VERSION = 2

/** Feature capabilities advertised by this Host version. */
export const CAPABILITIES = [
  'intent-v2',
  'settings-split',
  'inbox-decide',
  'portable-export-v2',
  'client-outbox',
  'proposal-rollback',
]

/** Sync API root, relative to the plugin's route prefix. */
export const SYNC_PREFIX = '/sync/v1'

/**
 * Operation ids are minted by the calling device and reused verbatim on a retry, so the
 * Hub can answer a repeated write from its idempotency log instead of applying it twice.
 * `[a-zA-Z0-9_-]+` is the storage domain's own per-record key constraint.
 */
export const OPERATION_ID = /^[a-zA-Z0-9_-]{8,120}$/

/** Every entity id in the store must survive the same path-safe rule (AGENTS.md rule 3). */
export const SAFE_KEY = /^[a-zA-Z0-9_-]+$/

/**
 * Stable error codes. A Client switches on these, never on the message text, so the
 * Chinese copy can change without breaking a caller.
 */
export const ERRORS = {
  badRequest: 'bad-request',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not-found',
  conflict: 'conflict',
  unsupported: 'unsupported-operation',
  tooLarge: 'payload-too-large',
  unavailable: 'hub-unavailable',
  notReady: 'store-not-ready',
  rateLimited: 'rate-limited',
}

/** HTTP status per code: the one place that decides how a code travels on the wire. */
export const STATUS_OF = {
  [ERRORS.badRequest]: 400,
  [ERRORS.unauthorized]: 401,
  [ERRORS.forbidden]: 403,
  [ERRORS.notFound]: 404,
  [ERRORS.conflict]: 409,
  [ERRORS.unsupported]: 422,
  [ERRORS.tooLarge]: 413,
  [ERRORS.unavailable]: 503,
  [ERRORS.notReady]: 503,
  [ERRORS.rateLimited]: 429,
}

/**
 * A refused operation.
 *
 * `details` is what makes a 409 actionable: the Hub returns the current record and its
 * revision so the caller can re-read instead of guessing what changed. It never contains a
 * token or a stored credential.
 *
 * `code` accepts either a key of `ERRORS` (`'conflict'`) or the code itself
 * (`'unsupported-operation'`), because both spellings appear at call sites and a silently
 * downgraded status is exactly the kind of bug a caller cannot see.
 */
const CODES = new Set(Object.values(ERRORS))

export class SyncError extends Error {
  constructor(code, message, details) {
    super(message ?? code)
    this.name = 'SyncError'
    this.code = CODES.has(code) ? code : (ERRORS[code] ?? ERRORS.badRequest)
    if (details !== undefined) this.details = details
  }

  get status() {
    return STATUS_OF[this.code] ?? 400
  }

  /** The wire body: a stable code, a human message, and optional machine-readable detail. */
  toJSON() {
    return {
      ok: false,
      error: { code: this.code, message: this.message, ...(this.details === undefined ? {} : { details: this.details }) },
    }
  }
}

/**
 * The command names a remote caller may invoke. Anything else is refused before it runs.
 *
 * Derived from `daily.js`'s `ACTIONS` table plus the names the funnel itself owns, so the
 * whitelist cannot drift from the implementation: adding an action makes it addressable, and
 * there is no second list to forget.
 */
export const COMMANDS = ['item.state', 'proposal.create', 'proposal.decide', ...ACTION_NAMES]

export const COMMAND_SET = new Set(COMMANDS)

/**
 * Commands that only a human-driven, local request may invoke.
 *
 * `proposal.decide` is here for one reason: a model must not approve a proposal a model wrote
 * (issue §6.2). The Agent tools never expose it, and the sync API refuses it even with a
 * write token, so a decision can only come from a browser talking to the device the user holds.
 */
export const LOCAL_ONLY = new Set(['proposal.decide'])

/**
 * Writes that create an entity. A retry of these must reuse the first attempt's entity id,
 * which is why the Hub records `operationId -> result` rather than trusting the body.
 */
export const CREATING = new Set(['board.create', 'widget.add', 'widget.duplicate', 'task.add', 'note.add', 'capture', 'item.toTask', 'item.toNote'])

/** The entities a `precondition` may name, and the table each one lives in. */
export const ENTITY_TABLE = {
  task: 'tasks',
  note: 'notes',
  board: 'boards',
  widget: 'widgets',
  layout: 'layouts',
  settings: 'settings',
  item: 'items',
  readlater: 'readlater',
  proposal: 'agent_inbox',
}