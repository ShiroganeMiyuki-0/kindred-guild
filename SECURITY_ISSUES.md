# Security Issues and Fixes

This document outlines the critical security issues found in the Kindred Guild codebase and the fixes applied.

## Critical Issues Fixed

### 1. **Exposed API Credentials** ✅ FIXED
**Severity:** CRITICAL
**Before:** Hardcoded Supabase URL and API key in `app.js` lines 1-2
**Fix:** 
- Created `.env.example` template
- Moved credentials to environment variables
- Credentials should now be loaded from `.env.local` (not committed)

**Action Required:**
```bash
cp .env.example .env.local
# Edit .env.local with your actual Supabase credentials
```

### 2. **SQL Comment Syntax Error** ✅ FIXED
**Severity:** HIGH
**Before:** Line 869 used SQL comment syntax (`--`) in JavaScript
```javascript
-- Also create a report
```
**After:**
```javascript
// Also create a report
```

### 3. **XSS Vulnerability in Admin Tables** ✅ FIXED
**Severity:** HIGH
**Before:** User-controlled data directly embedded in HTML:
```javascript
html += `<tr><td>${p.user_email}</td>...`
```
**After:** All user data properly escaped:
```javascript
html += `<tr><td>${escapeHtml(p.user_email)}</td>...`
```

## High-Priority Issues

### 4. **Email-Based Admin Authentication** ⚠️ REQUIRES IMPLEMENTATION
**Severity:** HIGH
**Current Issue:** Admin check only compares email string, easily spoofed
```javascript
function isAdmin() {
    return currentUser?.email === ADMIN_EMAIL;
}
```

**Recommended Fix:** Use Supabase custom claims
```javascript
// In Supabase: Create custom claim 'is_admin' in user metadata
// In app.js:
async function isAdmin() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user?.user_metadata?.is_admin === true;
}
```

### 5. **Race Condition in Fairy Coin Balance** ⚠️ PARTIALLY FIXED
**Severity:** HIGH
**Issue:** Balance check happens in JS, but can change before DB insert
**Existing Protection:** Database trigger already prevents negative balance (supabase-schema.sql lines 139-150)
**Recommendation:** Trust the database constraint, but improve error handling:
```javascript
if (error?.code === '23514') {
    showAuthError('Insufficient Fairy Coins. Database constraint violation.');
}
```

### 6. **Email Validation Too Permissive** ✅ IMPROVED
**Severity:** MEDIUM
**Before:** `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` allows `a@b.c`
**After:** Stricter regex:
```javascript
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
```

### 7. **Missing Error Notifications** ✅ FIXED
**Severity:** MEDIUM
**Issue:** Failed API calls silently logged, UI not updated
**Fix:** Added user-facing error toasts and proper error handling in critical functions

## Medium-Priority Issues

### 8. **Hardcoded Admin Email in Source** ✅ FIXED
**Severity:** MEDIUM
**Before:** Exposed in app.js line 7
**After:** Moved to environment variable or config

### 9. **Missing Input Length Limits** ⚠️ RECOMMENDATION
**Severity:** MEDIUM
**Recommended HTML attributes:**
```html
<input type="text" id="title" maxlength="200" required />
<textarea id="description" rows="3" maxlength="2000" required></textarea>
```

### 10. **Auth Polling Memory Leak** ✅ FIXED
**Severity:** MEDIUM
**Before:** `authPollingInterval` not always cleared
**After:** Ensure `stopAuthPolling()` called in all paths

## Remaining Security Tasks

- [ ] Implement CSRF tokens for form submissions
- [ ] Add rate limiting (client-side cooldowns + server-side)
- [ ] Enable CORS restrictions in Supabase
- [ ] Add request/response logging for admin actions
- [ ] Implement audit trail for Fairy Coin transactions
- [ ] Add 2FA support for admin accounts
- [ ] Regular security audits and dependency updates
- [ ] Implement Content Security Policy (CSP) headers

## Deployment Checklist

- [ ] Never commit `.env.local`
- [ ] Set environment variables in production environment
- [ ] Enable HTTPS only
- [ ] Set Supabase Row Level Security (RLS) policies correctly
- [ ] Monitor auth logs for suspicious activity
- [ ] Regular backups of database
- [ ] Test all security fixes before production

## Testing Security Fixes

```bash
# 1. Test environment variable loading
echo $VITE_SUPABASE_URL  # Should show URL, not error

# 2. Test XSS prevention
# Create a quest with title: <script>alert('xss')</script>
# Should display as plain text, not execute

# 3. Test admin auth
# Try logging in with non-admin email
# Should not see admin panel

# 4. Test balance validation
# Try posting quest with more coins than available
# Should show appropriate error
```
