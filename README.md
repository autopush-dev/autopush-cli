# autopush

Deploy static sites to [AutoPush](https://autopush.dev) from the command line.

```bash
npm i -g @autopush/cli   # installs the `autopush` command (or use npx @autopush/cli)
autopush login           # paste a token from the dashboard
autopush deploy          # builds, picks/creates a site, uploads, prints the live URL
```

## Commands

| Command | Description |
| --- | --- |
| `autopush login` | Save an API token on this machine (from autopush.dev > Profile > API Tokens). |
| `autopush init` | Write `autopush.json` (which site + folder to deploy). |
| `autopush deploy [dir]` | Build (if there's a build script), then deploy. Asks which site to use the first time and remembers it. |
| `autopush whoami` | Show the signed-in account. |
| `autopush open` | Open the deployed site in your browser. |
| `autopush logout` | Remove the saved token. |

### deploy flags

- `--no-build` skip the build and upload the folder as-is
- `--dir <path>` folder to upload (overrides auto-detect)
- `--site <slug>` target a site by slug (skips the picker)
- `--message <text>` label the deploy
- `--token <token>` / `AUTOPUSH_TOKEN` env auth for CI
- `-y, --yes` skip prompts; use the configured site (CI)

### How build + deploy works

`autopush deploy` builds automatically whenever your `package.json` has a `build` script - no separate `npm run build`, so you never ship a stale folder:

1. Detects your package manager from the lockfile (npm / pnpm / yarn / bun) and runs `<pm> run build`.
2. Finds the output folder (`dist`, `build`, or `out`).
3. Picks the deploy target - your saved site, or it asks you to choose an existing one or create a new one, then remembers it.

The build runs on **your machine**, not AutoPush - we host the output, we never run your build. Pin the specifics in `autopush.json` to skip the guessing:

```json
{ "slug": "mysite", "build": true, "dir": "dist" }
```

- `"build": true` (default when a build script exists) runs `<pm> run build`; a string is a custom command, e.g. `"build": "npm run build:prod"`; `false` uploads without building.
- Set `"dir"` when your framework outputs somewhere non-standard (e.g. Angular's `dist/<project>`).
- A plain static folder (no build script) is uploaded as-is.

## CI

```yaml
- run: npx @autopush/cli deploy --site mysite --yes
  env:
    AUTOPUSH_TOKEN: ${{ secrets.AUTOPUSH_TOKEN }}
```

## Config

- **Global** (token): `~/.config/autopush/config.json`, written by `autopush login`.
- **Project** (committed): `autopush.json` with `{ "slug": "mysite", "dir": "dist" }`. The slug is public (it's your URL), so it's safe to commit. Never put your token here.
- Precedence: flag > env var > `autopush.json` > global config.

## Notes

- AutoPush hosts your **build output**, not source. Run your build first, then deploy the output folder.
- Uploads are capped at 50 MB zipped (same as the dashboard). Add a `.autopushignore` (gitignore-style) to exclude files.

## Develop

```bash
npm install
npm run build      # compiles src/ -> dist/
node dist/index.js --help
```
