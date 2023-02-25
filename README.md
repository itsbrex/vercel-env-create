<div align="center">
  <h1>Vercel Env Create 🛠️</h1>
  <p>The missing <code>vercel env create</code> command</p>
  <p>
    <a href="https://github.com/itsbrex/vercel-env-create" title="Screenshot of vercel-env-create">
      <img alt="Screenshot of vercel-env-create" src="https://socialify.git.ci/itsbrex/vercel-env-create/image?description=1&descriptionEditable=Easily%20manage%20your%20local%20and%20Vercel%20deployment%20environment%20variables%20and%20.env%20files&font=Inter&name=1&owner=1&pattern=Floating%20Cogs&stargazers=1&theme=Auto" width="600" />
    </a>
  </p>
</div>

<div align="center">
  <!-- <a href="https://github.com/itsbrex/vercel-env-create/actions/workflows/integration.yml">
    <img alt="Integration Status" src="https://github.com/itsbrex/vercel-env-create/actions/workflows/integration.yml/badge.svg" /> -->
  </a>
  <a href="https://github.com/itsbrex/vercel-env-create/blob/main/LICENSE">
    <img alt="License" src="https://badgen.net/github/license/itsbrex/vercel-env-create" />
  </a>
  <br />
</div>
<p>

Easily manage your local and Vercel deployment environment variables for `local`, `development`, `preview`, and `production`.

`vercel-env-create` is a Node.js script that scans your project for all referenced `process.env` variables and creates separate `.env` files each environment in the root of your project's directory.

This makes it easy to manage your local development and test environments, as well as each of your Vercel deployment environments (`development`, `preview`, and `production`).

## Installation

You can install this package using `npm`:

```bash
npm install -g vercel-env-create
```

## Usage

After installing the package, you can use it in your Vercel project directory like this:

```bash
vercel-env-create
```

> **_NOTE: This command will OVERWRITE ALL EXISTING ENV FILES in your project root so proceed with caution!_**

By default, the script will look for environment variables in files with the following extensions: `.js`, `.ts`, `.jsx`, `.tsx`, `.html`, and `.css`. You can add additional file extensions to search for by modifying the `extensions` array in the script.

The script will create the following .env files in your project directory:

- `.env` - for your default environment
- `.env.local` - for your local development environment
- `.env.development` - for your development environment
- `.env.production` - for your production environment

This makes it easy to manage separate environment variables for each environment and ensures that all environment variables in your project are appropriately defined.

## Contributing

Contributions are welcome! If you find a bug or have a suggestion for improvement, please [open an issue](https://github.com/itsbrex/vercel-env-create/issues) or [submit a pull request](https://github.com/itsbrex/vercel-env-create/pulls).

## Support

If you found this project interesting or helpful, please consider [sponsoring me](https://github.com/sponsors/itsbrex) or following me [on twitter](https://twitter.com/itsbrex). <img src="https://storage.googleapis.com/saasify-assets/twitter-logo.svg" alt="twitter" height="24px" align="center"></a>

## License

Licensed under the [MIT](https://github.com/itsbrex/vercel-env-create/blob/main/LICENSE) License.

## Thanks

Shoutout to [HiDeoo](https://github.com/HiDeoo) for his work on [`vercel-env-push`](https://github.com/HiDeoo/vercel-env-push) and his [`create-app`](https://github.com/HiDeoo/create-app) CLI tool that this project was bootstrapped with. 🙏
