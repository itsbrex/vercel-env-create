import { run, type RunOptions, type VercelEnvironment } from './index';

const HELP_TEXT = `
Usage: vercel-env-create [--push] [options]

Generate or sync .env templates from referenced env variables.

Options:
  --push                  Push discovered environment variables to one or more Vercel projects
  --project <name>        Target Vercel project name (repeatable)
  --environment <env>     Target Vercel environment: development | preview | production
  --env-file <file>       Source env file for values (default: .env)
  -y, --yes               Non-interactive mode (no prompts)
  -h, --help              Show this help text
`;

const parsed = parseArgs(process.argv.slice(2));

if (parsed.help) {
  process.stdout.write(`${HELP_TEXT}\n`);
  process.exit(0);
}

run(process.cwd(), parsed.options).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function parseArgs(rawArgs: string[]): { help: boolean; options: RunOptions } {
  const options: RunOptions = {
    projects: [],
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]!;

    switch (arg) {
      case '--push':
        options.push = true;
        break;
      case '--project': {
        const value = nextArg(rawArgs, index);
        if (!value) {
          throwUsage('Missing required value for --project');
        }
        options.projects?.push(value);
        index += 1;
        break;
      }
      case '--environment': {
        const value = nextArg(rawArgs, index);
        if (!value) {
          throwUsage('Missing required value for --environment');
        }

        if (!isValidEnvironment(value)) {
          throwUsage(`Unknown environment: ${value}`);
        }

        options.environment = value;
        index += 1;
        break;
      }
      case '--env-file': {
        const value = nextArg(rawArgs, index);
        if (!value) {
          throwUsage('Missing required value for --env-file');
        }
        options.envFile = value;
        index += 1;
        break;
      }
      case '--yes':
      case '-y':
        options.nonInteractive = true;
        break;
      case '--help':
      case '-h':
        return { help: true, options };
      default: {
        if (arg.startsWith('--project=')) {
          const value = arg.replace('--project=', '');
          if (!value) {
            throwUsage('Missing required value for --project');
          }
          options.projects?.push(value);
          break;
        }

        if (arg.startsWith('--environment=')) {
          const value = arg.replace('--environment=', '');
          if (!value || !isValidEnvironment(value)) {
            throwUsage(`Unknown environment: ${value}`);
          }
          options.environment = value;
          break;
        }

        if (arg.startsWith('--env-file=')) {
          options.envFile = arg.replace('--env-file=', '');
          if (!options.envFile) {
            throwUsage('Missing required value for --env-file');
          }
          break;
        }

        if (arg.startsWith('-')) {
          throwUsage(`Unknown option: ${arg}`);
        }
      }
    }
  }

  if (options.projects?.length === 0) {
    delete options.projects;
  }

  return { help: false, options };
}

function nextArg(args: string[], index: number): string {
  const next = args[index + 1];
  return next && !next.startsWith('-') ? next : '';
}

function isValidEnvironment(value: string): value is VercelEnvironment {
  return value === 'development' || value === 'preview' || value === 'production';
}

function throwUsage(message: string): never {
  throw new Error(`${message}\n\n${HELP_TEXT}`);
}
