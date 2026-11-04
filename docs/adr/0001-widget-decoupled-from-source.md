# A Widget is a placed instance, not a Source's card

Until now each Source declared its own card (`SOURCES[].widget` with `kind`, `colSpan`, `rowSpan`), so one Source was exactly one card on one page. sooyo daily needs several Boards, several instances of one Widget Type (two 订阅 Widgets following different Sources), and Sizes the user picks, so we decided that a Widget is a user-placed instance on a Board with its own settings and Size, and a Source only supplies Items. Keeping "one Source, one card" would have been much less work, but it cannot express multiple instances or Boards at all.

## Consequences

- `SOURCES[].widget` is superseded: a Source may suggest a default 呈现 for a new 订阅 Widget, but it no longer decides layout, size or whether a card exists.
- Board layouts (per breakpoint) and Widget settings become user data that must be stored, separately from Items.
- AGENTS.md rule 4 ("kind selects the renderer and the size") is replaced by "the Widget Type selects the renderer; the Widget's Size selects the information level".
- The 五种卡片形态 (图文 / 榜单 / 论文 / 产品 / 视频) collapse into one 订阅 Widget Type with a 呈现 setting.
