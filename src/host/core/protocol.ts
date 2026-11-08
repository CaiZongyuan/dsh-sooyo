/**
 * The sync protocol's shared vocabulary: version, error codes, id shape and the command
 * whitelist boundary.
 */

export const ACTION_NAMES_LIST = [
  'board.create',
  'board.rename',
  'board.remove',
  'board.active',
  'widget.add',
  'widget.update',
  'widget.remove',
  'widget.duplicate',
  'widget.resize',
  'layout.set',
  'task.add',
  'task.update',
  'task.remove',
  'capture',
  'note.add',
  'note.update',
  'note.remove',
  'readlater.set',
  'collection.save',
  'collection.remove',
  'retro.save',
  'interests.set',
  'bookmarks.set',
  'habit.tick',
  'focus.set',
  'item.toTask',
  'item.toNote',
] as const

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
] as const

/** Sync API root, relative to the plugin's route prefix. */
export const SYNC_PREFIX = '/sync/v1'

/**
 * Operation ids are minted by the calling device and reused verbatim on a retry, so the
 * Hub can answer a repeated write from its idempotency log instead of applying it twice.
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
} as const

export type ErrorCode = (typeof ERRORS)[keyof typeof ERRORS]

/** HTTP status per code: the one place that decides how a code travels on the wire. */
export const STATUS_OF: Record<string, number> = {
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

const CODES = new Set<string>(Object.values(ERRORS))

export class SyncError extends Error {
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(code: string, message?: string, details?: Record<string, unknown>) {
    super(message ?? code)
    this.name = 'SyncError'
    this.code = CODES.has(code) ? code : ((ERRORS as Record<string, string>)[code] ?? ERRORS.badRequest)
    if (details !== undefined) this.details = details
  }

  get status(): number {
    return STATUS_OF[this.code] ?? 400
  }

  /** The wire body: a stable code, a human message, and optional machine-readable detail. */
  toJSON(): Record<string, unknown> {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    }
  }
}

/**
 * The command names a remote caller may invoke. Anything else is refused before it runs.
 */
export const COMMANDS: string[] = ['item.state', 'proposal.create', 'proposal.decide', ...ACTION_NAMES_LIST]

export const COMMAND_SET = new Set<string>(COMMANDS)

/**
 * Commands that only a human-driven, local request may invoke.
 */
export const LOCAL_ONLY = new Set<string>(['proposal.decide'])

/**
 * Writes that create an entity.
 */
export const CREATING = new Set<string>([
  'board.create',
  'widget.add',
  'widget.duplicate',
  'task.add',
  'note.add',
  'collection.save',
  'capture',
  'item.toTask',
  'item.toNote',
])

/** The entities a `precondition` may name, and the table each one lives in. */
export const ENTITY_TABLE: Record<string, string> = {
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
