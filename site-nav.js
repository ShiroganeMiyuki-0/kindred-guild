 /**
 * Kindred Guild - Dynamic Site Navigation & Auth Sync System
 * Copyright (c) 2026 Kindred Guild. All Rights Reserved.
 * Unauthorized copying or redistribution is prohibited.
 * Highly responsive, resilient, and automatically synchronized with Supabase authentication.
 * Includes auto-healing viewport structures to prevent layout squishing on flex centered cards.
 */

(function () {
    console.log('[Kindred Guild] site-nav.js executing...');
    // 1. DYNAMIC PATH CALCULATION
    const pathParts = window.location.pathname.split('/').filter(part => part !== '');
    const isFileAtEnd = pathParts.length > 0 && pathParts[pathParts.length - 1].includes('.');
    const folderCount = pathParts.length - (isFileAtEnd ? 1 : 0);
    const rootPrefix = '../'.repeat(folderCount) || './';

    function getPath(filename) {
        return `${rootPrefix}${filename}`;
    }

    // 2. SELF-HEALING TAILWIND & FONTAWESOME INJECTION
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(faLink);
    }

    if (!window.tailwind && !document.querySelector('script[src*="tailwindcss"]') && !document.querySelector('link[href*="tailwind"]')) {
        const configScript = document.createElement('script');
        configScript.innerHTML = `
            window.tailwind = window.tailwind || {};
            tailwind.config = {
                corePlugins: {
                    preflight: false
                }
            };
        `;
        document.head.appendChild(configScript);

        const twScript = document.createElement('script');
        twScript.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(twScript);
    }

    const navStyles = document.createElement('style');
    navStyles.innerHTML = `
        .glass-nav {
            background: rgba(17, 12, 28, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(251, 191, 36, 0.1);
        }
        .nav-item-active {
            color: #fbbf24 !important;
            border-bottom: 2px solid #fbbf24;
        }
        .nav-mobile-active {
            color: #fbbf24 !important;
            background: rgba(251, 191, 36, 0.1);
            border-left: 4px solid #fbbf24;
        }

        /* Center the brand logo in the navbar on mobile/tablet.
           The bar is position:relative; the brand is pulled out of flow
           and absolutely centered, so it sits visually in the middle
           regardless of the hamburger on the right. On desktop (md+) the
           brand returns to normal left-aligned flow. */
        @media (max-width: 767px) {
            #site-nav .nav-brand {
                position: absolute !important;
                left: 50% !important;
                top: 50% !important;
                transform: translate(-50%, -50%) !important;
                margin-right: 0 !important;
            }
        }

        body.site-nav-flex-adjusted {
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            min-height: 100vh !important;
            box-sizing: border-box !important;
        }
        body.site-nav-flex-adjusted > *:not(#site-nav):not(script):not(style) {
            margin-top: auto !important;
            margin-bottom: auto !important;
        }
    `;
    document.head.appendChild(navStyles);


    // 3. DEFINE MENU SCHEMES
    // Primary items = always visible on toolbar. Secondary items = inside ☰ hamburger dropdown.
    const publicMenuItems = [
        { name: 'Quest Board', icon: 'fa-chess-board', file: 'quest-board.html', primary: true },
        { name: 'Guild Hall', icon: 'fa-chess-rook', file: 'guild-hall.html', primary: true },
        { name: 'Getting Started', icon: 'fa-book-open', file: 'getting-started.html' },
        { name: 'Fairy Wishes', icon: 'fa-wand-magic-sparkles', file: 'fairy-wishes.html' },
        { name: 'Leaderboard', icon: 'fa-trophy', file: 'leaderboard.html' },
        { name: 'Activity', icon: 'fa-newspaper', file: 'activity.html' },
        { name: 'Guild Charter', icon: 'fa-scroll', file: 'trust-and-safety.html' },
        { name: 'Quest Rules', icon: 'fa-book', file: 'quest-rules.html' },
        { name: 'Refer & Earn', icon: 'fa-gift', file: 'referral.html' },
        { name: 'Donations', icon: 'fa-hand-holding-heart', file: 'donation.html' },
        { name: 'Terms', icon: 'fa-file-contract', file: 'terms-of-service.html' },
        { name: 'Privacy', icon: 'fa-shield-halved', file: 'privacy-policy.html' }
    ];

    const privateMenuItems = [
        { name: 'Quest Board', icon: 'fa-chess-board', file: 'quest-board.html', primary: true },
        { name: 'Guild Hall', icon: 'fa-chess-rook', file: 'guild-hall.html', primary: true },
        { name: 'Messages', icon: 'fa-envelope', file: 'dm.html', primary: true },
        { name: 'Post Quest', icon: 'fa-circle-plus', file: 'quest-post.html', primary: true },
        { name: 'Getting Started', icon: 'fa-book-open', file: 'getting-started.html' },
        { name: 'Find People', icon: 'fa-magnifying-glass', file: 'search.html' },
        { name: 'Friends & Groups', icon: 'fa-user-group', file: 'friends.html' },
        { name: 'Fairy Wishes', icon: 'fa-wand-magic-sparkles', file: 'fairy-wishes.html' },
        { name: 'Be a Worker', icon: 'fa-hammer', file: 'worker-post.html' },
        { name: 'Leaderboard', icon: 'fa-trophy', file: 'leaderboard.html' },
        { name: 'Activity', icon: 'fa-newspaper', file: 'activity.html' },
        { name: 'Guild Charter', icon: 'fa-scroll', file: 'trust-and-safety.html' },
        { name: 'Quest Rules', icon: 'fa-book', file: 'quest-rules.html' },
        { name: 'Refer & Earn', icon: 'fa-gift', file: 'referral.html' },
        { name: 'Buy Coins', icon: 'fa-coins', file: 'coin_purchase_ui.html' },
        { name: 'Donations', icon: 'fa-hand-holding-heart', file: 'donation.html' },
        { name: 'Terms', icon: 'fa-file-contract', file: 'terms-of-service.html' },
        { name: 'Privacy', icon: 'fa-shield-halved', file: 'privacy-policy.html' }
    ];

    function isItemActive(file) {
        const currentPath = window.location.pathname.toLowerCase();
        const baseFile = file.toLowerCase();
        
        if (currentPath === '/' || currentPath.endsWith('index.html')) {
            return baseFile === 'index.html';
        }
        return currentPath.includes(baseFile) || currentPath.includes(baseFile.replace('.html', ''));
    }


    // 4. GENERATING THE NAV BAR STRUCTURE
    // Primary items show inline on the toolbar. Everything else goes in a ☰ hamburger dropdown.
    function buildNavbarHTML(user, isAdmin = false) {
        const menuItems = user ? privateMenuItems : publicMenuItems;
        const primaryItems = menuItems.filter(i => i.primary);
        const secondaryItems = menuItems.filter(i => !i.primary);

        // Desktop: primary nav links (always visible)
        const primaryLinks = primaryItems.map(item => {
            const activeClass = isItemActive(item.file) ? 'nav-item-active text-amber-400' : 'text-gray-300 hover:text-amber-300 hover:border-amber-300';
            return `
                <a href="${getPath(item.file)}" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium transition duration-150 ease-in-out gap-2 h-14 ${activeClass}">
                    <i class="fa-solid ${item.icon} text-xs"></i>
                    <span>${item.name}</span>
                </a>
            `;
        }).join('');

        // Admin link (inline if admin)
        let adminLinkHtml = '';
        if (isAdmin) {
            const adminActive = isItemActive('admin_dashboard_ui.html');
            adminLinkHtml = `
                <a href="${getPath('admin_dashboard_ui.html')}" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium transition duration-150 ease-in-out gap-2 h-14 ${adminActive ? 'nav-item-active text-rose-400' : 'text-rose-300 hover:text-rose-100'}">
                    <i class="fa-solid fa-lock-open text-xs text-rose-400"></i>
                    <span>Admin</span>
                </a>
            `;
        }

        // Desktop: secondary items in hamburger dropdown
        const secondaryLinksHtml = secondaryItems.map(item => {
            const activeClass = isItemActive(item.file) ? 'text-amber-400 bg-amber-500/10 font-bold' : 'text-gray-300 hover:bg-slate-800 hover:text-amber-300';
            return `
                <a href="${getPath(item.file)}" class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition duration-150 rounded-md ${activeClass}">
                    <i class="fa-solid ${item.icon} w-4 text-center text-xs"></i>
                    <span>${item.name}</span>
                </a>
            `;
        }).join('');

        // Mobile: all items listed
        const mobileLinks = menuItems.map(item => {
            const activeClass = isItemActive(item.file) ? 'nav-mobile-active text-amber-400 bg-amber-500/10 font-bold' : 'text-gray-300 hover:bg-slate-800 hover:text-amber-300';
            return `
                <a href="${getPath(item.file)}" class="flex items-center gap-3 pl-3 pr-4 py-3 text-base font-medium transition duration-150 ease-in-out ${activeClass}">
                    <i class="fa-solid ${item.icon} w-5 text-center text-sm"></i>
                    <span>${item.name}</span>
                </a>
            `;
        }).join('');

        const mobileAdminLink = isAdmin ? `
            <a href="${getPath('admin_dashboard_ui.html')}" class="flex items-center gap-3 pl-3 pr-4 py-3 text-base font-medium transition duration-150 ease-in-out text-rose-300 hover:bg-rose-950/20 hover:text-rose-200">
                <i class="fa-solid fa-lock-open w-5 text-center text-sm text-rose-400"></i>
                <span>Admin Panel</span>
            </a>
        ` : '';

        // Action panel (profile/logout or join button)
        let actionPanelHtml = '';
        if (user) {
            const userEmail = user.email || 'Adventurer';
            const initials = userEmail.substring(0, 2).toUpperCase();
            const profileActive = isItemActive('profile.html');
            actionPanelHtml = `
                <div class="flex items-center gap-3">
                    <a href="${getPath('notifications.html')}" class="relative flex items-center text-gray-300 hover:text-amber-400 transition duration-150" title="Notifications">
                        <i class="fa-solid fa-bell text-lg"></i>
                        <span id="nav-notif-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span>
                    </a>
                    <a href="${getPath('profile.html')}" class="flex items-center gap-2 group ${profileActive ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'} transition duration-150">
                        <div class="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-md group-hover:scale-105 transition-transform duration-150">
                            ${initials}
                        </div>
                        <span class="hidden md:inline-block text-xs font-semibold max-w-[100px] truncate">${userEmail.split('@')[0]}</span>
                    </a>
                    <button id="btn-logout" class="bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition duration-150 inline-flex items-center gap-1.5 cursor-pointer" title="Logout">
                        <i class="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            `;
        } else {
            actionPanelHtml = `
                <a href="${getPath('auth.html')}" class="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm transition duration-150 shadow-lg hover:shadow-amber-500/20 shadow-amber-500/10 inline-flex items-center gap-2">
                    <i class="fa-solid fa-user-shield text-xs"></i>
                    <span>Join Guild</span>
                </a>
            `;
        }

        const mobileActionPanel = user ? `
            <div class="pt-4 pb-3 border-t border-slate-800">
                <div class="flex items-center px-4 gap-3">
                    <div class="h-10 w-10 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-amber-400">
                        ${(user.email || 'AD').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-white truncate max-w-[200px]">${user.email || 'Adventurer'}</div>
                        <a href="${getPath('profile.html')}" class="text-xs text-amber-400 hover:underline">View Profile</a>
                    </div>
                </div>
                <div class="mt-3 px-2">
                    <button id="btn-logout-mobile" class="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md text-base font-medium text-red-400 hover:bg-red-950/20 hover:text-red-300 cursor-pointer">
                        <i class="fa-solid fa-right-from-bracket w-5 text-center"></i> Sign Out
                    </button>
                </div>
            </div>
        ` : `
            <div class="pt-4 pb-3 border-t border-slate-800 px-4">
                <a href="${getPath('auth.html')}" class="w-full text-center block bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm transition duration-150">
                    <i class="fa-solid fa-user-shield mr-2"></i> Join Guild / Login
                </a>
            </div>
        `;

        return `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="relative flex justify-between items-center h-14">
                    <!-- Left: Brand + Primary Nav -->
                    <div class="flex items-center flex-1">
                        <div class="nav-brand flex-shrink-0 flex items-center md:mr-6">
                            <a href="${getPath('index.html')}" class="flex items-center gap-2 group">
                                <img src="${getPath('logo.png')}" alt="Kindred Guild" width="36" height="36" class="h-9 w-9 rounded-xl object-cover ring-2 ring-amber-500/30 group-hover:ring-amber-500 transition-all duration-300 group-hover:scale-105">
                                <span class="text-base font-black tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white via-amber-200 to-amber-400 font-sans leading-none hidden md:inline">KINDRED GUILD</span>
                            </a>
                        </div>
                        <nav class="hidden md:flex md:items-center md:gap-1">
                            ${primaryLinks}
                            ${adminLinkHtml}
                        </nav>
                    </div>

                    <!-- Right: Hamburger + Actions -->
                    <div class="flex items-center gap-2">
                        <div class="hidden md:flex md:items-center md:gap-3">
                            ${actionPanelHtml}
                        </div>

                        <!-- Hamburger for secondary nav items (desktop + tablet only) -->
                        <div class="relative hidden md:flex md:items-center" id="more-menu-wrapper">
                            <button type="button" id="more-menu-toggle" class="inline-flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-amber-400 hover:bg-slate-800/60 focus:outline-none border border-slate-700 transition duration-150" aria-haspopup="true" aria-expanded="false" title="More pages">
                                <i class="fa-solid fa-bars text-lg" id="more-menu-icon"></i>
                            </button>
                            <div id="more-menu-dropdown" class="hidden absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 py-2 z-[200] backdrop-blur-md">
                                <div class="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">More Pages</div>
                                ${secondaryLinksHtml}
                            </div>
                        </div>

                        <!-- Mobile hamburger (shows all items) -->
                        <div class="md:hidden flex items-center">
                            <button type="button" id="mobile-menu-toggle" class="inline-flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-amber-400 hover:bg-slate-800/60 focus:outline-none border border-slate-700 transition duration-150" aria-controls="mobile-menu" aria-expanded="false">
                                <span class="sr-only">Open menu</span>
                                <i id="hamburger-icon" class="fa-solid fa-bars text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile dropdown (all items) -->
            <div class="hidden md:hidden" id="mobile-menu">
                <div class="pt-2 pb-3 space-y-1 bg-slate-950/95 border-b border-slate-800 backdrop-blur-md">
                    ${mobileLinks}
                    ${mobileAdminLink}
                </div>
                ${mobileActionPanel}
            </div>
        `;
    }


    // 5. ATTACH TO BODY & IMPLEMENT EVENT HANDLERS
    function renderNavContainer(user, isAdmin = false) {
        let navElement = document.getElementById('site-nav');
        
        if (!navElement) {
            navElement = document.createElement('nav');
            navElement.id = 'site-nav';
            document.body.prepend(navElement);
        }

        navElement.className = 'glass-nav sticky top-0 z-50 w-full transition-all duration-300';
        navElement.innerHTML = buildNavbarHTML(user, isAdmin);

        injectPageNav(user);
        setupEventHandlers(user);
        adjustFlexBody();
        if (user) loadNotificationCount();

        // Show the Terms & Conditions agreement modal for first-time visitors.
        // Previously this function was defined but never invoked, so the
        // welcome-onboarding flow shipped dead. Safe to call repeatedly — it
        // no-ops once the user has accepted (kg_terms_accepted in localStorage)
        // and also no-ops if the overlay is already on screen.
        if (user) showTermsAgreement();
    }

    // Inject a consistent page-level nav bar under the floating nav on every page
    function injectPageNav(user) {
        const pageNavLinks = [
            { name: 'Quest Board', icon: '⚔️', file: 'quest-board.html' },
            { name: 'Guild Hall', icon: '🏰', file: 'guild-hall.html' },
            { name: 'Messages', icon: '💬', file: 'dm.html' },
            { name: 'Find People', icon: '🔍', file: 'search.html' },
            { name: 'Friends', icon: '👥', file: 'friends.html' },
            { name: 'Wishes', icon: '✨', file: 'fairy-wishes.html' },
            { name: 'Leaderboard', icon: '🏆', file: 'leaderboard.html' },
            { name: 'Workers', icon: '🛡️', file: 'worker-post.html' },
            { name: 'Activity', icon: '📰', file: 'activity.html' },
            { name: 'Charter', icon: '📜', file: 'trust-and-safety.html' },
            { name: 'Rules', icon: '📖', file: 'quest-rules.html' },
            { name: 'Support', icon: '❤️', file: 'donation.html' }
        ];

        const currentFile = window.location.pathname.split('/').pop() || 'index.html';

        // Skip on index.html (landing page has its own CTA)
        if (currentFile === '' || currentFile === 'index.html') return;

        // Check if this page already has our injected nav
        if (document.querySelector('.page-nav-bar')) return;

        // Build the nav pill links
        function buildNavPills() {
            return pageNavLinks.map(item => {
                const isActive = currentFile === item.file;
                const baseStyle = 'padding:6px 14px;font-size:0.8rem;font-weight:600;border:1px solid;border-radius:20px;text-decoration:none;white-space:nowrap;transition:all 0.15s;cursor:pointer;';
                const activeStyle = isActive
                    ? 'background:var(--accent-glow);color:var(--accent);border-color:var(--accent);'
                    : 'color:var(--text-dim);border-color:var(--border);';
                return `<a href="${getPath(item.file)}" class="page-nav-pill" style="${baseStyle}${activeStyle}">${item.icon} ${item.name}</a>`;
            }).join('');
        }

        // Add hover CSS once
        if (!document.getElementById('page-nav-styles')) {
            const style = document.createElement('style');
            style.id = 'page-nav-styles';
            style.textContent = `
                .page-nav-pill:hover { border-color: var(--accent) !important; color: var(--accent) !important; }
                .page-nav-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding:10px 0; margin-bottom:16px; border-bottom:1px solid var(--border); }
            `;
            document.head.appendChild(style);
        }

        const navHtml = buildNavPills();

        // Strategy 1: Find existing .page-header — add nav pills as a new row below it
        const existingHeader = document.querySelector('.page-header');
        if (existingHeader) {
            const navRow = document.createElement('div');
            navRow.className = 'page-nav-bar';
            navRow.innerHTML = navHtml;
            existingHeader.parentNode.insertBefore(navRow, existingHeader.nextSibling);
            return;
        }

        // Strategy 2: No page header — inject into .container at the top
        const container = document.querySelector('.container');
        if (container) {
            const navRow = document.createElement('div');
            navRow.className = 'page-nav-bar';
            navRow.innerHTML = navHtml;
            container.insertBefore(navRow, container.firstChild);
        }
    }

    function adjustFlexBody() {
        const bodyStyle = window.getComputedStyle(document.body);
        if (bodyStyle.display === 'flex' && bodyStyle.flexDirection !== 'column') {
            // Only adjust pages that need centering (auth, 404)
            const hasCenterContent = document.querySelector('.auth-card, .error-container');
            if (hasCenterContent) {
                document.body.classList.add('site-nav-flex-adjusted');
            }
        }
    }

    // Show Terms & Conditions agreement modal for first-time visitors
    function showTermsAgreement() {
        // Skip if already accepted
        if (localStorage.getItem('kg_terms_accepted')) return;
        // Skip on terms/privacy pages themselves
        const currentFile = window.location.pathname.split('/').pop() || '';
        if (currentFile === 'terms-of-service.html' || currentFile === 'privacy-policy.html') return;
        // Skip if the modal is already showing (renderNavContainer can run more than
        // once per page load, e.g. once on initial auth check and again from
        // onAuthStateChange — without this guard that creates a second overlay with
        // duplicate element IDs, and the visible checkbox ends up with no listener
        // wired to it, so the "Enter the Guild" button never enables).
        if (document.getElementById('terms-agreement-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'terms-agreement-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';

        overlay.innerHTML = `
            <div style="background:var(--surface,#14141e);border:1px solid var(--border,#262636);border-radius:16px;max-width:480px;width:100%;padding:32px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                <div style="font-size:3rem;margin-bottom:12px;">⚔️</div>
                <h2 style="color:var(--accent,#d4af37);font-size:1.4rem;margin-bottom:8px;">Welcome to Kindred Guild</h2>
                <p style="color:var(--text-dim,#9494a8);font-size:0.9rem;line-height:1.6;margin-bottom:20px;">
                    By entering the Guild, you agree to follow our rules and respect your fellow members.
                    Please review our Terms and Privacy Policy.
                </p>
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;text-align:left;">
                    <a href="terms-of-service.html" target="_blank" style="color:var(--accent,#d4af37);font-size:0.85rem;display:flex;align-items:center;gap:8px;text-decoration:none;">
                        📜 Terms of Service
                    </a>
                    <a href="privacy-policy.html" target="_blank" style="color:var(--accent,#d4af37);font-size:0.85rem;display:flex;align-items:center;gap:8px;text-decoration:none;">
                        🔒 Privacy Policy
                    </a>
                    <a href="trust-and-safety.html" target="_blank" style="color:var(--accent,#d4af37);font-size:0.85rem;display:flex;align-items:center;gap:8px;text-decoration:none;">
                        🏛️ Guild Charter
                    </a>
                </div>
                <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:20px;text-align:left;">
                    <input type="checkbox" id="terms-checkbox" style="margin-top:3px;accent-color:var(--accent,#d4af37);">
                    <span style="color:var(--text-dim,#9494a8);font-size:0.82rem;line-height:1.4;">
                        I have read and agree to the Terms of Service, Privacy Policy, and Guild Charter.
                        I understand that violation of these rules may result in account suspension.
                    </span>
                </label>
                <button id="terms-accept-btn" disabled style="
                    width:100%;padding:14px;background:var(--accent,#d4af37);color:#000;border:none;
                    border-radius:10px;font-size:1rem;font-weight:700;cursor:not-allowed;opacity:0.5;
                    transition:all 0.2s;
                ">Enter the Guild</button>
            </div>
        `;

        document.body.appendChild(overlay);

        const checkbox = document.getElementById('terms-checkbox');
        const acceptBtn = document.getElementById('terms-accept-btn');

        checkbox.addEventListener('change', () => {
            acceptBtn.disabled = !checkbox.checked;
            acceptBtn.style.opacity = checkbox.checked ? '1' : '0.5';
            acceptBtn.style.cursor = checkbox.checked ? 'pointer' : 'not-allowed';
        });

        acceptBtn.addEventListener('click', () => {
            if (!checkbox.checked) return;
            localStorage.setItem('kg_terms_accepted', 'true');
            localStorage.setItem('kg_terms_accepted_at', new Date().toISOString());
            overlay.remove();
        });
    }

    function setupEventHandlers(user) {
        // Mobile hamburger toggle
        const toggleBtn = document.getElementById('mobile-menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        const icon = document.getElementById('hamburger-icon');

        if (toggleBtn && mobileMenu) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = mobileMenu.classList.contains('hidden');
                if (isHidden) {
                    mobileMenu.classList.remove('hidden');
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-xmark');
                    toggleBtn.setAttribute('aria-expanded', 'true');
                } else {
                    mobileMenu.classList.add('hidden');
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // Desktop "More" hamburger dropdown toggle
        const moreToggle = document.getElementById('more-menu-toggle');
        const moreDropdown = document.getElementById('more-menu-dropdown');
        const moreIcon = document.getElementById('more-menu-icon');

        if (moreToggle && moreDropdown) {
            moreToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = moreDropdown.classList.contains('hidden');
                if (isHidden) {
                    moreDropdown.classList.remove('hidden');
                    moreIcon.classList.remove('fa-bars');
                    moreIcon.classList.add('fa-xmark');
                    moreToggle.setAttribute('aria-expanded', 'true');
                } else {
                    moreDropdown.classList.add('hidden');
                    moreIcon.classList.remove('fa-xmark');
                    moreIcon.classList.add('fa-bars');
                    moreToggle.setAttribute('aria-expanded', 'false');
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                const wrapper = document.getElementById('more-menu-wrapper');
                if (wrapper && !wrapper.contains(e.target)) {
                    moreDropdown.classList.add('hidden');
                    moreIcon.classList.remove('fa-xmark');
                    moreIcon.classList.add('fa-bars');
                    moreToggle.setAttribute('aria-expanded', 'false');
                }
            });

            // Close dropdown when a link inside is clicked
            moreDropdown.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    moreDropdown.classList.add('hidden');
                    moreIcon.classList.remove('fa-xmark');
                    moreIcon.classList.add('fa-bars');
                    moreToggle.setAttribute('aria-expanded', 'false');
                });
            });
        }

        // Logout handlers
        const logoutHandler = async (e) => {
            e.preventDefault();
            if (window.sb || window.supabase) {
                try {
                    const { error } = await (window.sb || window.supabase).auth.signOut();
                    if (error) throw error;
                    window.location.href = getPath('index.html');
                } catch (err) {
                    console.error('Logout failed:', err.message);
                }
            } else {
                console.warn('Supabase is not initialized. Mocking logout redirection.');
                window.location.href = getPath('index.html');
            }
        };

        const logoutBtn = document.getElementById('btn-logout');
        const logoutMobileBtn = document.getElementById('btn-logout-mobile');
        if (logoutBtn) logoutBtn.addEventListener('click', logoutHandler);
        if (logoutMobileBtn) logoutMobileBtn.addEventListener('click', logoutHandler);
    }


    // 6. DISCOVER SUPABASE & RETRIEVE ACTIVE USER
    async function initNavigationState() {
        let supabaseClient = window.sb || window.supabase;

        if (!supabaseClient) {
            let retries = 0;
            supabaseClient = await new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (window.sb || window.supabase) {
                        clearInterval(interval);
                        resolve(window.sb || window.supabase);
                    }
                    retries++;
                    if (retries > 40) {
                        clearInterval(interval);
                        resolve(null);
                    }
                }, 50);
            });
        }

        if (supabaseClient) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const user = session ? session.user : null;
            let isAdmin = false;

            if (user) {
                const isMetaAdmin = user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';
                if (isMetaAdmin) {
                    isAdmin = true;
                } else {
                    try {
                        const cachedRole = sessionStorage.getItem(`user_role_${user.id}`);
                        if (cachedRole) {
                            isAdmin = cachedRole === 'admin';
                        } else {
                            const { data, error } = await supabaseClient
                                .from('user_profiles')
                                .select('is_admin')
                                .eq('user_id', user.id)
                                .maybeSingle();
                            if (data && data.is_admin) {
                                isAdmin = true;
                                sessionStorage.setItem(`user_role_${user.id}`, 'admin');
                            } else if (data) {
                                sessionStorage.setItem(`user_role_${user.id}`, 'user');
                            }
                        }
                    } catch (e) {
                        console.log('Skipping profile database authorization check: Use app metadata default.');
                    }
                }
            }

            renderNavContainer(user, isAdmin);

            supabaseClient.auth.onAuthStateChange(async (event, currentSession) => {
                const currentUser = currentSession ? currentSession.user : null;
                let currentIsAdmin = false;
                
                if (currentUser) {
                    currentIsAdmin = currentUser.app_metadata?.role === 'admin' || currentUser.user_metadata?.role === 'admin';
                    if (!currentIsAdmin) {
                        const cachedRole = sessionStorage.getItem(`user_role_${currentUser.id}`);
                        currentIsAdmin = cachedRole === 'admin';
                    }
                }
                renderNavContainer(currentUser, currentIsAdmin);
            });

        } else {
            console.warn('Supabase client was not detected. Initializing Navigation in demo/static mode.');
            renderNavContainer(null, false);
        }
    }

    async function loadNotificationCount() {
        try {
            if (!window.sb) return;
            const { data, error } = await window.sb.rpc('get_unread_notification_count');
            if (error) return;
            const count = data || 0;
            const badge = document.getElementById('nav-notif-badge');
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 9 ? '9+' : count;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        } catch (e) { /* silent */ }
    }

    // ── PWA: Service Worker + Install Prompt ──
    let deferredInstallPrompt = null;

    // NOTE: Service worker registration happens once at the bottom of this
    // IIFE (after the `load` event) with proper error logging. The duplicate
    // registration that used to live here was removed — registering twice
    // doesn't break anything but spawns two parallel SW pipelines and
    // confuses debug tooling.

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        showInstallBanner();
    });

    function showInstallBanner() {
        if (localStorage.getItem('kg_install_dismissed')) return;
        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom, 0px) + 20px);left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#d4af37,#b8941e);color:#000;padding:12px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;z-index:500;box-shadow:0 4px 20px rgba(212,175,55,0.3);font-size:0.85rem;font-weight:600;max-width:90vw;';
        banner.innerHTML = `
            <span>🏰 Install Kindred Guild as an app!</span>
            <button id="pwa-install-btn" style="background:#000;color:#d4af37;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.8rem;">Install</button>
            <button id="pwa-dismiss-btn" style="background:none;border:none;color:rgba(0,0,0,0.5);cursor:pointer;font-size:1.1rem;padding:0 4px;">✕</button>
        `;
        document.body.appendChild(banner);

        document.getElementById('pwa-install-btn').addEventListener('click', async () => {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            banner.remove();
        });

        document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
            localStorage.setItem('kg_install_dismissed', '1');
            banner.remove();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigationState);
    } else {
        initNavigationState();
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.warn('[SW] Registration failed:', err.message);
            });
        });
    }
})();
