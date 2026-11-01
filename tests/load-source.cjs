const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');

// Run the app's TypeScript modules in Node, substituting only native boundaries.
exports.createSourceLoader = (mocks = {}) => {
  const cache = new Map();
  const load = (filename) => {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const requireFromFile = createRequire(filename);
    const localRequire = (request) => {
      if (Object.hasOwn(mocks, request)) return mocks[request];
      if (request.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), request);
        const source = [target, `${target}.ts`, `${target}.tsx`, `${target}.js`]
          .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (source) return load(source);
      }
      return requireFromFile(request);
    };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInThisContext(`(function(require, module, exports) {${code}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
  };
  return load;
};
