# Image Generation

How agents generate bitmap images (Widget Type icons, object illustrations) for this repo through the Codex `imagegen` skill in CLI mode.

## Setup

- Read `~/.codex/skills/.system/imagegen/SKILL.md` first; follow its CLI-mode section and leave `scripts/image_gen.py` unmodified.
- Credentials come from `~/.codex/config.toml`: take the `[model_providers.<name>]` table named by `model_provider`, and pass its `base_url` and `experimental_bearer_token` as `OPENAI_BASE_URL` and `OPENAI_API_KEY` to the child process only. Read them with `tomllib` inside the same shell command that runs the script, so they stay in memory and never reach output, files or logs.
- This repo has no Python environment. Run the script in a throwaway one:

```bash
uv run --no-project --with openai --with pillow python \
  ~/.codex/skills/.system/imagegen/scripts/image_gen.py generate \
  --model gpt-image-2.5-flare --prompt-file <prompt.txt> \
  --out output/imagegen/<style>/<name>.png \
  --size 1024x1024 --quality high --output-format png --background transparent
```

## Models and parameters

- `gpt-image-2.5-flare` for everyday images (about 35 s per image); `gpt-image-2.5-sunburst` for refined work.
- `--background transparent` works with `gpt-image-2.5-flare` and returns a clean RGBA cutout, so no keying is needed. Say "transparent background, no drop shadow" in the prompt too; add shadows in CSS instead.
- To compare models, keep the prompt and parameters identical and add `--no-augment`.
- Six jobs in parallel (`xargs -P 6`) has worked; retry a failed job once before reporting it.
- Put prompt files in the session scratchpad, not in the repo.

## Output

- Raw PNGs go to `output/imagegen/`, which is gitignored.
- The service ignores the requested `--size`: a `1024x1024` request has returned `1254x1254` and `1536x1024`. Check the actual dimensions with Pillow and view every image for content, stray text and style drift before using it.
- Shipped assets are WebP: crop to the alpha bounding box, pad to a square with about 6% margin, then export 256 px (`<name>.webp`) and 128 px (`<name>-128.webp`) with Pillow at `quality=85`. Only the WebP files are committed.

## Style references

The three icon styles under trial (see `prototype/assets/{a,b,c}/`) share one prompt shape: subject, then style, then the fixed tail "Centered, straight front view, single isolated object, no drop shadow, transparent background, no text, no letters, no numbers, no logos."

- **a, porcelain**: a matte white porcelain squircle tile; the glyph gently embossed from the satin surface; one small accent in the Widget Type's muted colour.
- **b, frosted**: a standalone symbol of thick frosted translucent acrylic, pale blue-violet and soft grey, one small accent.
- **c, clay**: a small rounded matte clay miniature in sand and warm grey, one muted accent.
