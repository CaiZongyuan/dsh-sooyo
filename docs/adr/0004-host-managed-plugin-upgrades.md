---
status: accepted
---

# Delegate official plugin upgrades to the DSH package manager

Official sooyo versions will be published as npm packages, with each DSH instance upgraded independently
through the host's native PluginManager and HMR capabilities. Sooyo owns release checks, compatibility
preflight, safe runtime shutdown, user interaction and verification of its actual Host and browser builds;
DSH owns package/profile changes, module replacement and the attempt to restore the previous package.

This ties one-click upgrades to registry installs and the available host APIs, and requires existing GitHub
installs to switch distribution once. It avoids maintaining a second profile installer and ESM loader
inside the package being replaced. Source checkouts remain read-only, unsupported hosts use explicit
manual/pending-restart behavior, and Agent tools only check versions.

The first implementation accepts only data/protocol-compatible upgrades. Native restoration can fail
and does not undo data changes; failures must report both upgrade and restoration outcomes rather than
promise an atomic rollback. See [the update design](../plugin-updates.md) for confirmed product boundaries
and the validation required before claiming safe hot upgrades.
