# Lightweight Memos and Metadata-Only Multimedia Collections

Long-form notes and heavy attachments belong in dedicated document platforms (such as Feishu), while external collection scrapers (GitHub Stars, X bookmarks, videos, music, images, websites) run outside the plugin. We decided that `sooyo` stores only short-form `Note` memos/inspirations (with optional external document links) and lightweight `Collection` metadata records (`title`, `url`, `thumbnail`, `summary`, `kind`, `tags`, and platform attributes), unified with day-level `Task` calendar scheduling and periodic `Retrospective` reviews. Building an in-plugin rich-text editor or binary asset store would bloat sync payloads and duplicate external tools without improving daily capture, scheduling, or review.

## Consequences

- `Note` stays a concise memo or inspiration card (optionally linking to an external document URL), never a multi-page rich-text article.
- `Collection` entries store structured metadata and thumbnail URLs in the synced `readlater` / `settings` domain rather than raw image, audio, or video files, and can be ingested via quick URL paste, metadata dialog, JSON batch import, or the `sooyo_collection_save` Agent tool.
- `Task` unifies `Inbox` (unscheduled), `Today` (scheduled for today or overdue), and `Later` (future date) with day-level calendar `due` dates (`YYYY-MM-DD`), priority, notes, and subtasks.
- User-facing periodic `Retrospective` (`复盘`) records live in synced settings (`retros`) alongside background Agent `Review` (`审阅`) proposals.
