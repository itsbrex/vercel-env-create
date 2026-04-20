import { run } from './index';

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
