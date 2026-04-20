<div align="center">
  <h1>Vercel Env Create 🛠️</h1>
  <p>The missing <code>vercel env create</code> command</p>
  <p>
    <a href="https://github.com/itsbrex/vercel-env-create" title="Screenshot of vercel-env-create">
      <img alt="Screenshot of vercel-env-create" src="https://socialify.git.ci/itsbrex/vercel-env-create/image?description=1&descriptionEditable=Auto-generate%20and%20maintain%20your%20project%27s%20.env%20files&name=1&owner=1&pattern=Solid&stargazers=1&theme=Auto" width="600" />
    </a>
  </p>
</div>

<div align="center">
  <a href="https://github.com/itsbrex/vercel-env-create/actions/workflows/integration.yml">
    <img alt="Integration Status" src="https://github.com/itsbrex/vercel-env-create/actions/workflows/integration.yml/badge.svg" />
  </a>
  <a href="https://github.com/itsbrex/vercel-env-create/blob/main/LICENSE">
    <img alt="License" src="https://badgen.net/github/license/itsbrex/vercel-env-create" />
  </a>
  <br />
</div>
<p>

Easily create `.env` files and keep them in sync with the environment variables referenced in your codebase.
This tool scans supported source files for `process.env.*` (or `import.meta.env.*`) references,
then creates/appends entries in the environment templates Next.js and Vercel load.

## Supported `.env` files

This project now only targets the env files that Next.js and Vercel workflows use:

- `.env`
- `.env.local`
- `.env.development`
- `.env.development.local`
- `.env.test`
- `.env.test.local`
- `.env.production`
- `.env.production.local`

The following conventions match current docs:

- local overrides are loaded from `.env.local` (except in test environments)
- environment-specific defaults come from `.env.$(NODE_ENV)`
- environment-specific secrets come from `.env.$(NODE_ENV).local`
- test mode uses `.env.test` and `.env.test.local`

## Installation

Install with npm:

```bash
npm install -g vercel-env-create
```

Or run with `npx`:

```bash
npx vercel-env-create
```

## Usage

From a project root, run:

```bash
vercel-env-create
```

The tool:

1. scans supported files under the current directory,
2. collects variable names used in `process.env` / `import.meta.env`,
3. creates missing env files for the supported set above,
4. appends missing keys as blank entries while preserving existing values.

### Example file scanning

By default these extensions are scanned:

- `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`
- `.json`, `.yaml`, `.yml`
- `.ipynb`

You can change this by calling `findReferencedEnvVars` from the module API.

### Quick example

Given a project with:

```bash
src/lib/db.ts
src/app/page.tsx
```

Where those files contain:

```ts
// src/lib/db.ts
export const dbUrl = process.env.DATABASE_URL;
export const featureFlag = process.env['NEXT_PUBLIC_FLAG'];

// src/app/page.tsx
const token = import.meta.env.AUTH_TOKEN;
```

Running from the project root:

```bash
npx vercel-env-create
```

Creates/updates (if missing) all supported env files and adds:

```bash
# resulting files (excerpt)
.env
# ... existing content
AUTH_TOKEN=
DATABASE_URL=
NEXT_PUBLIC_FLAG=
```

If you already have existing keys, they are preserved and only missing keys are appended.

```bash
# existing .env before
DATABASE_URL=postgres://...
```

After running:

```bash
.env
DATABASE_URL=postgres://...
AUTH_TOKEN=
NEXT_PUBLIC_FLAG=
```

## Push variables to Vercel

Use `--push` after local sync to push discovered variable values to Vercel:

```bash
vercel-env-create --push
```

Behavior:

- If your project is linked to Vercel, the linked project is used automatically.
- If not linked, you get an interactive clack multi-select UI to choose one or more Vercel projects.
- You can choose target environment with an interactive clack select (`development`, `preview`, `production`).

Options:

- `--project <name>`
  - Target one or more projects explicitly (repeatable).
- `--environment <name>`
  - Set target environment without interactive selection.
- `--env-file <file>`
  - Source env file used for values (default: `.env`).
- `--yes`
  - Run non-interactively (required in non-TTY contexts).

The tool uses your existing local Vercel CLI authentication (`vercel login`).

If a referenced variable has no value in the source file, that variable is skipped during push.

## `.env.example` handling

If either `.env.example` or `.env.local.example` exists:

- the tool will seed new env files from the first example file it finds,
- no new keys are appended automatically (the file contents are preserved as-is).

## Notes

- `.env.example` is intentionally supported for bootstrap defaults.
- `.env*.local` files are not meant to be committed because they contain secrets.
- If you need a stricter scan surface, import `findReferencedEnvVars` from the package and build your own wrapper.

## Contributing

Contributions are welcome. Open an issue or submit a pull request.

## License

Licensed under the [MIT](https://github.com/itsbrex/vercel-env-create/blob/main/LICENSE) License.

## Thanks

Shoutout to [HiDeoo](https://github.com/HiDeoo) for `vercel-env-push` and `create-app`, which inspired this CLI.
