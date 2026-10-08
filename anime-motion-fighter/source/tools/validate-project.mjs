import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const html = readFileSync(join(root, 'index.html'), 'utf8');
const modules = readdirSync(join(root, 'src')).filter(name => name.endsWith('.js')).sort();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!/<style[ >]/i.test(html), 'index.html still contains an inline style block');
assert(!/<script>\s*[\s\S]*?<\/script>/i.test(html), 'index.html still contains an inline script block');
assert(modules.length >= 20, `expected at least 20 runtime modules, found ${modules.length}`);
assert(modules.every((name, index) => name.startsWith(`${String(index + 1).padStart(2, '0')}-`)), 'runtime modules are not numerically ordered');
assert(!/ontouchstart=|onmousedown=/i.test(html), 'legacy duplicate touch/mouse handlers remain');
assert((html.match(/onpointerdown=/g) || []).length >= 6, 'pointer controls are missing');
assert(/<meta name="viewport" content="width=device-width, initial-scale=1\.0">/.test(html), 'viewport is not zoom-capable');
assert(!/<script(?![^>]*defer)[^>]*src="src\//i.test(html), 'a local runtime script is not deferred');
assert((html.match(/<script defer src="src\//g) || []).length === modules.length, 'HTML/module count mismatch');

for (const module of modules) {
  const file = join(root, 'src', module);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert(result.status === 0, `syntax check failed for ${module}: ${result.stderr.trim()}`);
}

console.log(`Validated ${modules.length} runtime modules, external styles, and input bindings.`);
