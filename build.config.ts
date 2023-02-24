import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  clean: true,
  declaration: true,
  // entries: ['src/index', 'src/cli'],
  entries: ['src/index'],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
})
