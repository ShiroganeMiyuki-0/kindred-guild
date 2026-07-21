const fs = require('fs');
const path = require('path');

const issues = [];

function checkFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const isHTML = file.endsWith('.html');
  const isJS = file.endsWith('.js');
  
  // 1. innerHTML without escaping (XSS risk)
  lines.forEach((line, i) => {
    if (line.includes('innerHTML') && !line.includes('escapeHtml') && !line.includes('escape(') && !line.includes('Loading') && !line.includes('empty-state') && !line.includes('className') && !line.includes('textContent') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      // Check if it's inserting dynamic data
      if (line.includes('${') && !line.includes('style=') && !line.includes('class=') && !line.includes('id=')) {
        // Could be XSS if it interpolates user data without escaping
        const hasUserVar = /username|display_name|content|title|description|message/i.test(line);
        if (hasUserVar) {
          issues.push(`XSS RISK ${file}:${i+1}: innerHTML with unescaped user data`);
        }
      }
    }
  });
  
  // 2. Missing null/undefined checks before accessing properties
  if (isJS) {
    lines.forEach((line, i) => {
      // Pattern: something.data.map() without checking if data exists
      if (line.match(/\.data\.\w+\(/) && !line.includes('?.') && !line.includes('|| []') && !line.includes('|| {}')) {
        if (!lines[Math.max(0, i-2)].includes('if') && !lines[Math.max(0, i-1)].includes('?.')) {
          // issues.push(`NULL RISK ${file}:${i+1}: .data.method() without null check`);
        }
      }
    });
  }
  
  // 3. Auth pages that don't check auth
  if (isHTML && !file.includes('index.html') && !file.includes('auth.html') && !file.includes('404.html') && !file.includes('terms') && !file.includes('privacy') && !file.includes('quest-rules') && !file.includes('trust-and-safety')) {
    if (content.includes('supabase-client.js') && !content.includes('requireAuth') && !content.includes('auth.getUser') && !content.includes('getSession')) {
      issues.push(`NO AUTH CHECK: ${file} - loads Supabase but never checks if user is logged in`);
    }
  }
  
  // 4. Inline event handlers with XSS potential
  if (isHTML) {
    lines.forEach((line, i) => {
      // onclick="...${variable}..." in template literals
      if (line.match(/on(click|submit|change)="[^"]*\$\{/)) {
        issues.push(`INLINE XSS ${file}:${i+1}: event handler with template literal interpolation`);
      }
    });
  }
  
  // 5. Missing error messages for users
  if (isJS || (isHTML && content.includes('<script'))) {
    const rpcCalls = content.match(/\.rpc\('[^']+'/g) || [];
    const errorHandlers = (content.match(/error\.message|catch|\.error/g) || []).length;
    if (rpcCalls.length > 3 && errorHandlers < rpcCalls.length / 2) {
      issues.push(`INSUFFICIENT ERROR HANDLING: ${file} (${rpcCalls.length} RPC calls, ${errorHandlers} error handlers)`);
    }
  }
  
  // 6. Hardcoded localhost
  if (content.includes('localhost:') || content.includes('127.0.0.1')) {
    issues.push(`HARDCODED localhost: ${file}`);
  }
  
  // 7. Console.log in production
  if (isJS || (isHTML && content.includes('<script'))) {
    const consoleLogs = content.match(/console\.log\(/g) || [];
    if (consoleLogs.length > 5) {
      issues.push(`EXCESSIVE console.log (${consoleLogs.length}): ${file}`);
    }
  }
  
  // 8. Missing CSRF protection on forms
  if (isHTML && content.includes('<form') && !content.includes('csrf') && !content.includes('supabase')) {
    // Forms without Supabase (direct POST) need CSRF
  }
  
  // 9. Check for broken mobile layouts
  if (isHTML) {
    if (content.includes('display:grid') && !content.includes('@media') && !content.includes('comprehensive-fixes')) {
      issues.push(`GRID WITHOUT RESPONSIVE: ${file} - uses CSS grid without media queries`);
    }
  }
  
  // 10. Pages with forms but no loading/disabled states on submit buttons
  if (isHTML) {
    const forms = content.match(/<form[^>]*>/g) || [];
    const disabledBtns = content.match(/disabled|\.disabled/g) || [];
    if (forms.length > 0 && disabledBtns.length === 0) {
      issues.push(`NO DISABLED STATE: ${file} - forms exist but no submit button disable logic`);
    }
  }
}

// Check all HTML and JS files
const files = fs.readdirSync('.').filter(f => (f.endsWith('.html') || f.endsWith('.js')) && !f.startsWith('.'));
files.forEach(checkFile);

// Check CSS files in css/
const cssDir = 'css';
if (fs.existsSync(cssDir)) {
  fs.readdirSync(cssDir).filter(f => f.endsWith('.css')).forEach(f => {
    const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
    // Check for conflicting !important rules
    const importantRules = content.match(/!important/g) || [];
    if (importantRules.length > 50) {
      issues.push(`EXCESSIVE !important (${importantRules.length}): css/${f}`);
    }
  });
}

// Print results
console.log('\n=== DEEP AUDIT RESULTS ===\n');
if (issues.length === 0) {
  console.log('✅ No issues found!');
} else {
  // Group by type
  const grouped = {};
  issues.forEach(issue => {
    const type = issue.split(':')[0].split(' ')[0];
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(issue);
  });
  
  for (const [type, typeIssues] of Object.entries(grouped)) {
    console.log(`\n${type} (${typeIssues.length}):`);
    typeIssues.forEach(i => console.log(`  • ${i}`));
  }
}
console.log(`\nTotal: ${issues.length} issues`);
