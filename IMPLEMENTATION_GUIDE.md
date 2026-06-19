# Security Implementation Guide

This guide walks through implementing the security fixes to the Kindred Guild application.

## Step 1: Environment Variables Setup

### 1.1 Create `.env.local`
```bash
cp .env.example .env.local
```

### 1.2 Update `.env.local` with your credentials
```bash
vim .env.local  # or use your editor
```

**Contents should be:**
```
VITE_SUPABASE_URL=https://your-actual-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
VITE_ADMIN_EMAIL=your-admin-email@example.com
```

### 1.3 Verify `.env.local` is in `.gitignore`
```bash
grep ".env.local" .gitignore  # Should return a match
```

**Never commit this file!**

---

## Step 2: Update app.js with Environment Variables

Replace lines 1-7 in `app.js` with:

```javascript
// ===== ENVIRONMENT CONFIGURATION =====
// These should be loaded from .env.local (NOT committed)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://owpyqeubmfvtuqjaxauo.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@example.com';

if (!SUPABASE_KEY) {
    console.warn('⚠️ WARNING: VITE_SUPABASE_ANON_KEY not set. Check your .env.local file.');
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

**Note:** Uses `import.meta.env` for Vite or `process.env` for Node environments.

---

## Step 3: Fix SQL Comment Syntax

**Find:** Line 869 in `app.js`
```javascript
-- Also create a report  // ❌ WRONG - SQL syntax
```

**Replace with:**
```javascript
// Also create a report  // ✅ CORRECT - JavaScript comment
```

---

## Step 4: Improve Input Validation

### 4.1 Replace email validation function (line 119-121)

**Before:**
```javascript
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

**After:**
```javascript
function validateEmail(email) {
    // More strict: requires 2+ character TLD
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function sanitizeInput(text, maxLength = 1000) {
    if (!text) return '';
    return text.slice(0, maxLength).trim();
}
```

### 4.2 Add maxlength to HTML inputs (index.html)

Update the quest form fields:

```html
<!-- Before -->
<input type="text" id="title" placeholder="e.g., Design a logo for my cafe" required />

<!-- After -->
<input type="text" id="title" placeholder="e.g., Design a logo for my cafe" maxlength="200" required />
```

For textarea:
```html
<!-- Before -->
<textarea id="description" rows="3" placeholder="Describe the task in detail..." required></textarea>

<!-- After -->
<textarea id="description" rows="3" placeholder="Describe the task in detail..." maxlength="2000" required></textarea>
```

---

## Step 5: Fix XSS Vulnerabilities

### 5.1 Update admin table rendering functions

Apply to `renderAdminPurchases()`, `renderAdminReports()`, and `renderAdminDisputes()`:

**Pattern:**
Wrap all user-controlled data with `escapeHtml()`

**Before:**
```javascript
html += `<tr><td>${p.user_email}</td>...`
```

**After:**
```javascript
html += `<tr><td>${escapeHtml(p.user_email)}</td>...`
```

### 5.2 Add helper function for HTML attributes (after `escapeHtml`)

```javascript
function escapeHtmlAttribute(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
```

Use this for onclick handlers:
```javascript
// Before
onclick="confirmPurchase('${p.id}', ...)"

// After
onclick="confirmPurchase('${escapeHtmlAttribute(p.id)}', ...)"
```

---

## Step 6: Improve Error Handling

### 6.1 Add error notification function

```javascript
function showErrorToast(message) {
    console.error('❌ Error:', message);
    showToast(`❌ ${message}`);
}
```

### 6.2 Update API error handling

**Example in `raiseDispute()` function:**

**Before:**
```javascript
if (error) {
    alert('Error raising dispute: ' + error.message);
    return;
}
```

**After:**
```javascript
if (error) {
    showErrorToast('Error raising dispute: ' + error.message);
    return;
}
```

### 6.3 Update `loadQuests()` function

Add comprehensive error collection:
```javascript
const errors = [];
if (qErr) errors.push('Failed to load quests');
if (rErr) errors.push('Failed to load ratings');
// ... more errors

if (errors.length > 0) {
    console.error('Data loading errors:', errors);
    if (errors.length < 3) {
        showErrorToast('⚠️ Some data failed to load: ' + errors.join(', '));
    } else {
        showErrorToast('⚠️ Multiple data sources failed. Please refresh.');
    }
}
```

---

## Step 7: Admin Authentication (ADVANCED - Requires Supabase Setup)

### 7.1 In Supabase Dashboard

1. Go to **Authentication → Policies**
2. Create a custom claim for admin status
3. Set `is_admin` in user metadata

### 7.2 Update `isAdmin()` function in app.js

**Before:**
```javascript
function isAdmin() {
    return currentUser?.email === ADMIN_EMAIL;
}
```

**After (Option 1 - Email + Custom Claim):**
```javascript
function isAdmin() {
    const isAdminEmail = currentUser?.email === ADMIN_EMAIL;
    const hasAdminClaim = currentUser?.user_metadata?.is_admin === true;
    return isAdminEmail && hasAdminClaim;
}
```

**After (Option 2 - Custom Claim Only):**
```javascript
function isAdmin() {
    return currentUser?.user_metadata?.is_admin === true;
}
```

---

## Step 8: Testing the Fixes

### 8.1 Test environment variables
```bash
# Start dev server
npm run dev

# Check console - should NOT show hardcoded keys
# Should show warning if VITE_SUPABASE_ANON_KEY missing
```

### 8.2 Test XSS prevention
```javascript
// Create a quest with title:
// <img src=x onerror="alert('XSS')">

// Should display as plain text, NOT execute alert
```

### 8.3 Test email validation
```javascript
// These should FAIL validation:
validateEmail('test@b.c')      // Single char TLD
validateEmail('test@domain')   // No TLD

// These should PASS:
validateEmail('test@example.com')
validateEmail('user@company.co.uk')
```

### 8.4 Test error handling
```javascript
// Disconnect internet and try posting quest
// Should show user-friendly error message
```

---

## Deployment Checklist

- [ ] `.env.local` created with production credentials
- [ ] `.env.local` added to `.gitignore`
- [ ] All hardcoded credentials removed from source
- [ ] SQL comment syntax fixed (line 869)
- [ ] XSS protection applied to all admin tables
- [ ] Email validation improved
- [ ] Input maxlength attributes added to HTML
- [ ] Error handling implemented
- [ ] Admin authentication upgraded (custom claims)
- [ ] Tested in development environment
- [ ] No secrets visible in git history
- [ ] HTTPS enabled in production
- [ ] Supabase RLS policies verified
- [ ] Database backups configured

---

## Next Steps

1. **CSRF Protection:** Add tokens to forms
2. **Rate Limiting:** Implement cooldowns for submissions
3. **Audit Trail:** Log all admin actions
4. **2FA:** Enable two-factor authentication
5. **CSP Headers:** Add Content Security Policy
6. **Regular Audits:** Schedule security reviews

---

## Support

If you encounter issues:
1. Check console for error messages
2. Verify `.env.local` file exists and has correct values
3. Clear browser cache and localStorage
4. Check Supabase project settings
5. Review Supabase logs for API errors
