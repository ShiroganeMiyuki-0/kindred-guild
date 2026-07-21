const fs = require('fs');
const path = require('path');

const issues = [];

// 1. Check all HTML files for dead internal links
const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find all href="something.html" links
  const links = content.match(/href="([^"]*\.html[^"]*)"/g) || [];
  for (const link of links) {
    const url = link.replace('href="', '').replace('"', '').split('?')[0].split('#')[0];
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('#')) continue;
    if (!fs.existsSync(url)) {
      issues.push(`DEAD LINK in ${file}: ${url}`);
    }
  }
  
  // Check for missing JS files
  const srcs = content.match(/src="([^"]*\.js)"/g) || [];
  for (const src of srcs) {
    const jsFile = src.replace('src="', '').replace('"', '');
    if (jsFile.startsWith('http') || jsFile.startsWith('data:')) continue;
    if (!fs.existsSync(jsFile)) {
      issues.push(`MISSING JS in ${file}: ${jsFile}`);
    }
  }
  
  // Check for missing CSS files
  const hrefs = content.match(/href="([^"]*\.css)"/g) || [];
  for (const href of hrefs) {
    const cssFile = href.replace('href="', '').replace('"', '');
    if (cssFile.startsWith('http') || cssFile.startsWith('data:')) continue;
    if (!fs.existsSync(cssFile)) {
      issues.push(`MISSING CSS in ${file}: ${cssFile}`);
    }
  }
  
  // Check for common JS errors
  if (content.includes('window.requireAuth') && !content.includes('supabase-client.js')) {
    issues.push(`USES requireAuth WITHOUT supabase-client.js: ${file}`);
  }
  
  // Check for unclosed HTML tags (basic check)
  const openDivs = (content.match(/<div[\s>]/g) || []).length;
  const closeDivs = (content.match(/<\/div>/g) || []).length;
  if (Math.abs(openDivs - closeDivs) > 2) {
    issues.push(`MISMATCHED DIVs in ${file}: ${openDivs} open vs ${closeDivs} close`);
  }
  
  // Check for inline styles that could overflow
  if (content.includes('overflow-x: hidden') && content.includes('overflow-x: auto')) {
    // Both present - might be conflicting
  }
  
  // Check if comprehensive-fixes.css is included
  if (!content.includes('comprehensive-fixes.css') && !content.includes('admin_dashboard')) {
    issues.push(`MISSING comprehensive-fixes.css: ${file}`);
  }
  
  // Check for missing viewport meta tag
  if (!content.includes('viewport')) {
    issues.push(`MISSING viewport meta: ${file}`);
  }
  
  // Check for broken escapeHtml usage
  const escapeHtmlCalls = content.match(/escapeHtml\([^)]*\)/g) || [];
  if (escapeHtmlCalls.length > 0 && !content.includes('window.escapeHtml') && !content.includes('supabase-client.js')) {
    issues.push(`USES escapeHtml WITHOUT supabase-client.js: ${file}`);
  }
}

// 2. Check JS files for issues
const jsFiles = fs.readdirSync('.').filter(f => f.endsWith('.js') && !f.startsWith('.'));
for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for console.log that might leak info
  const logs = content.match(/console\.log\([^)]*\)/g) || [];
  // Not an issue in dev, just noting
  
  // Check for missing error handling
  if (content.includes('.from(') && !content.includes('error') && !content.includes('catch')) {
    issues.push(`NO ERROR HANDLING in ${file}`);
  }
  
  // Check for hardcoded URLs
  if (content.includes('localhost') || content.includes('127.0.0.1')) {
    issues.push(`HARDCODED localhost in ${file}`);
  }
}

// 3. Check CSS files for issues
const cssFiles = ['css/globals.css', 'css/layout-fix.css', 'css/comprehensive-fixes.css', 'css/rank-and-wishes.css'];
for (const file of cssFiles) {
  if (!fs.existsSync(file)) {
    issues.push(`MISSING CSS FILE: ${file}`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for !important overuse
  const importantCount = (content.match(/!important/g) || []).length;
  if (importantCount > 30) {
    issues.push(`EXCESSIVE !important (${importantCount}) in ${file}`);
  }
}

// 4. Check SQL migrations
const migrations = fs.readdirSync('.').filter(f => f.startsWith('migration_') && f.endsWith('.sql'));
console.log(`\nMigrations found: ${migrations.length}`);
migrations.forEach(m => console.log(`  - ${m}`));

// 5. Summary
console.log('\n=== AUDIT RESULTS ===');
if (issues.length === 0) {
  console.log('✅ No issues found!');
} else {
  console.log(`❌ ${issues.length} issues found:\n`);
  issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
}

// 6. Check for pages that should exist
const requiredPages = [
  'index.html', 'auth.html', 'quest-board.html', 'quest-post.html', 
  'quest-detail.html', 'quest-edit.html', 'guild-hall.html', 'dm.html',
  'fairy-wishes.html', 'leaderboard.html', 'profile.html', 'search.html',
  'friends.html', 'activity.html', 'notifications.html', 'referral.html',
  'coin_purchase_ui.html', 'coin-ledger.html', 'donation.html',
  'trust-and-safety.html', 'quest-rules.html', 'terms-of-service.html',
  'privacy-policy.html', 'admin_dashboard_ui.html', 'worker-post.html',
  'username-setup.html', '404.html'
];

console.log('\n=== PAGE CHECK ===');
for (const page of requiredPages) {
  if (!fs.existsSync(page)) {
    console.log(`❌ MISSING: ${page}`);
  }
}
console.log('Done.');
