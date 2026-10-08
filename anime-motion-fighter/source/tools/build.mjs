import { readFileSync, readdirSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { transform } from 'esbuild';

const root = process.cwd();
const srcDir = join(root, 'src');
const distDir = join(root, 'dist');
// Discover runtime modules so a new src/NN-*.js file can't be silently left out of
// production. The usability observer (22) stays dev-only; 01 ships a no-op stub of it.
const modules = readdirSync(srcDir).filter(n => n.endsWith('.js') && !n.startsWith('22-')).sort();

mkdirSync(distDir, { recursive: true });
const entry = modules.map(name => readFileSync(join(srcDir, name), 'utf8')).join('\n\n');
// The game uses inline onclick/onpointerdown handlers in index.html, so the
// top-level functions and `let` state MUST stay in the global scope. A bundled
// build wraps everything in a closure, which silently killed every button in
// production. `transform` minifies the concatenated script without wrapping it
// and without renaming top-level bindings.
const { code, map } = await transform(entry, {
  minify: true,
  sourcemap: 'external',
  sourcefile: 'app.src.js',
  legalComments: 'none',
  target: 'es2020'
});
writeFileSync(join(distDir, 'app.js'), code + '\n//# sourceMappingURL=app.js.map\n');
writeFileSync(join(distDir, 'app.js.map'), map);
const productionIndex = readFileSync(join(root, 'index.html'), 'utf8')
  .replace(/\n<script defer src="src\/[^>]+><\/script>/g, '')
  .replace('</head>', '  <script defer src="app.js"></script>\n</head>');
writeFileSync(join(distDir, 'index.html'), productionIndex);
cpSync(join(root, 'styles.css'), join(distDir, 'styles.css'));
cpSync(join(root, 'assets'), join(distDir, 'assets'), { recursive: true });
console.log(`Built dist/app.js from ${modules.length} runtime modules.`);
