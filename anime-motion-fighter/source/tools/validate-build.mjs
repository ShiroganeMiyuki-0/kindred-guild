import { existsSync, readFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(existsSync('dist/app.js'), 'dist/app.js is missing');
assert(existsSync('dist/app.js.map'), 'dist/app.js.map is missing');
assert(existsSync('dist/styles.css'), 'dist/styles.css is missing');
assert(existsSync('dist/assets/motion-duel-cyan.png'), 'P1 portrait is missing');
assert(existsSync('dist/assets/motion-duel-crimson.png'), 'P2 portrait is missing');
assert((html.match(/<script defer src="app\.js"><\/script>/g) || []).length === 1, 'production HTML must load exactly one app bundle');
assert(!/<script[^>]+src="src\//i.test(html), 'production HTML still references development modules');
console.log('Validated production bundle, source map, HTML entrypoint, and game assets.');
