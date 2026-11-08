export interface BuildInfo {
  version: string | null
  commit: string | null
  dirty: boolean
  builtAt: string | null
}

declare const __SOOYO_BUILD__: BuildInfo | undefined

export const BUILD: BuildInfo = typeof __SOOYO_BUILD__ === 'object' && __SOOYO_BUILD__ !== null
  ? __SOOYO_BUILD__
  : { version: null, commit: null, dirty: false, builtAt: null }

/** A release identity is shared by the Host and browser bundles, including local builds. */
export function sameBuild(left: BuildInfo, right: BuildInfo): boolean {
  return Boolean(left.version && left.builtAt)
    && left.version === right.version && left.commit === right.commit
    && left.dirty === right.dirty && left.builtAt === right.builtAt
}
