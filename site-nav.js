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
    // This solves relative path broken issues on deep-nested pages (e.g., docs/ or subdirectories)
    const pathParts = window.location.pathname.split('/').filter(part => part !== '');
    const isFileAtEnd = pathParts.length > 0 && pathParts[pathParts.length - 1].includes('.');
    const folderCount = pathParts.length - (isFileAtEnd ? 1 : 0);
    const rootPrefix = '../'.repeat(folderCount) || './';

    // Helper to format absolute paths cleanly
    function getPath(filename) {
        return `${rootPrefix}${filename}`;
    }

    // 2. SELF-HEALING TAILWIND & FONTAWESOME INJECTION
    // Ensures that icons and styling work automatically on every single page
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(faLink);
    }

    // Check if Tailwind is missing, and if so, load it with CSS Preflight DISABLED.
    // This allows our Tailwind navbar to style beautifully without stripping borders/margins from custom inputs!
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

    // Add CSS transitions, glassmorphism, and self-healing body flex correction rules
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
        
        /* Dynamic self-healing rules for centering flex pages (e.g., auth, coin purchase, username setup) */
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
    // This allows us to conditionally render nav items depending on auth status
    const publicMenuItems = [
        { name: 'Quest Board', icon: 'fa-chess-board', file: 'quest-board.html' },
        { name: 'Fairy Wishes', icon: 'fa-wand-magic-sparkles', file: 'fairy-wishes.html' },
        { name: 'Guild Hall', icon: 'fa-chess-rook', file: 'guild-hall.html' },
        { name: 'Leaderboard', icon: 'fa-trophy', file: 'leaderboard.html' },
        { name: 'Activity', icon: 'fa-newspaper', file: 'activity.html' },
        { name: 'Refer & Earn', icon: 'fa-gift', file: 'referral.html' },
        { name: 'Donations', icon: 'fa-hand-holding-heart', file: 'donation.html' }
    ];

    const privateMenuItems = [
        { name: 'Quest Board', icon: 'fa-chess-board', file: 'quest-board.html' },
        { name: 'Post Quest', icon: 'fa-circle-plus', file: 'quest-post.html' },
        { name: 'Be a Worker', icon: 'fa-hammer', file: 'worker-post.html' },
        { name: 'Fairy Wishes', icon: 'fa-wand-magic-sparkles', file: 'fairy-wishes.html' },
        { name: 'Guild Hall', icon: 'fa-chess-rook', file: 'guild-hall.html' },
        { name: 'Leaderboard', icon: 'fa-trophy', file: 'leaderboard.html' },
        { name: 'Activity', icon: 'fa-newspaper', file: 'activity.html' },
        { name: 'Refer & Earn', icon: 'fa-gift', file: 'referral.html' },
        { name: 'Buy Coins', icon: 'fa-coins', file: 'coin_purchase_ui.html' },
        { name: 'Donations', icon: 'fa-hand-holding-heart', file: 'donation.html' }
    ];

    // Helper to check if a specific nav item is currently active
    function isItemActive(file) {
        const currentPath = window.location.pathname.toLowerCase();
        const baseFile = file.toLowerCase();
        
        // Match exact filename, matched clean URL paths, or handle homepage default
        if (currentPath === '/' || currentPath.endsWith('index.html')) {
            return baseFile === 'index.html';
        }
        return currentPath.includes(baseFile) || currentPath.includes(baseFile.replace('.html', ''));
    }


    // 4. GENERATING THE NAV BAR STRUCTURE
    function buildNavbarHTML(user, isAdmin = false) {
        const menuItems = user ? privateMenuItems : publicMenuItems;
        
        // Generate main list items for desktop navbar
        const desktopLinks = menuItems.map(item => {
            const activeClass = isItemActive(item.file) ? 'nav-item-active text-amber-400' : 'text-gray-300 hover:text-amber-300 hover:border-amber-300';
            return `
                <a href="${getPath(item.file)}" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium transition duration-150 ease-in-out gap-2 h-16 ${activeClass}">
                    <i class="fa-solid ${item.icon} text-xs"></i>
                    <span>${item.name}</span>
                </a>
            `;
        }).join('');

        // Generate special links (Admin Dashboard)
        let adminLinkHtml = '';
        if (isAdmin) {
            const adminActive = isItemActive('admin_dashboard_ui.html');
            adminLinkHtml = `
                <a href="${getPath('admin_dashboard_ui.html')}" class="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium transition duration-150 ease-in-out gap-2 h-16 ${adminActive ? 'nav-item-active text-rose-400' : 'text-rose-300 hover:text-rose-100'}">
                    <i class="fa-solid fa-lock-open text-xs text-rose-400"></i>
                    <span>Admin Panel</span>
                </a>
            `;
        }

        // Generate dynamic Action Panel (Logout / Profile vs Login Buttons)
        let actionPanelHtml = '';
        if (user) {
            const userEmail = user.email || 'Adventurer';
            const initials = userEmail.substring(0, 2).toUpperCase();
            const profileActive = isItemActive('profile.html');
            
            actionPanelHtml = `
                <div class="flex items-center gap-4">
                    <!-- Notification Bell -->
                    <a href="${getPath('notifications.html')}" class="relative flex items-center text-gray-300 hover:text-amber-400 transition duration-150" title="Notifications">
                        <i class="fa-solid fa-bell text-lg"></i>
                        <span id="nav-notif-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span>
                    </a>
                    
                    <!-- Profile Link -->
                    <a href="${getPath('profile.html')}" class="flex items-center gap-2 group ${profileActive ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400'} transition duration-150 ease-in-out">
                        <div class="h-9 w-9 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-md group-hover:scale-105 transition-transform duration-150">
                            ${initials}
                        </div>
                        <span class="hidden md:inline-block text-xs font-semibold max-w-[120px] truncate">${userEmail.split('@')[0]}</span>
                    </a>
                    
                    <!-- Logout button -->
                    <button id="btn-logout" class="bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 hover:border-red-500/50 text-red-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-150 shadow-sm inline-flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-right-from-bracket"></i>
                        <span class="hidden sm:inline">Logout</span>
                    </button>
                </div>
            `;
        } else {
            actionPanelHtml = `
                <a href="${getPath('auth.html')}" class="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm transition duration-150 shadow-lg hover:shadow-amber-500/20 shadow-amber-500/10 inline-flex items-center gap-2">
                    <i class="fa-solid fa-user-shield text-xs"></i>
                    <span>Join Guild / Login</span>
                </a>
            `;
        }

        // Mobile Links generator
        const mobileLinks = menuItems.map(item => {
            const activeClass = isItemActive(item.file) ? 'nav-mobile-active text-amber-400 bg-amber-500/10 font-bold' : 'text-gray-300 hover:bg-slate-800 hover:text-amber-300';
            return `
                <a href="${getPath(item.file)}" class="block pl-3 pr-4 py-3 text-base font-medium transition duration-150 ease-in-out flex items-center gap-3 ${activeClass}">
                    <i class="fa-solid ${item.icon} w-5 text-center text-sm"></i>
                    <span>${item.name}</span>
                </a>
            `;
        }).join('');

        const mobileAdminLink = isAdmin ? `
            <a href="${getPath('admin_dashboard_ui.html')}" class="block pl-3 pr-4 py-3 text-base font-medium transition duration-150 ease-in-out flex items-center gap-3 text-rose-300 hover:bg-rose-950/20 hover:text-rose-200">
                <i class="fa-solid fa-lock-open w-5 text-center text-sm text-rose-400"></i>
                <span>Admin Panel</span>
            </a>
        ` : '';

        const mobileActionPanel = user ? `
            <div class="pt-4 pb-3 border-t border-slate-800">
                <div class="flex items-center px-4 gap-3">
                    <div class="h-10 w-10 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-amber-400">
                        ${(user.email || 'AD').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-white truncate max-w-[200px]">${user.email || 'Adventurer'}</div>
                        <a href="${getPath('profile.html')}" class="text-xs text-amber-400 hover:underline">View Guild Profile</a>
                    </div>
                </div>
                <div class="mt-3 px-2">
                    <button id="btn-logout-mobile" class="w-full text-left block px-3 py-2.5 rounded-md text-base font-medium text-red-400 hover:bg-red-950/20 hover:text-red-300 cursor-pointer">
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
                <div class="flex justify-between h-16">
                    <!-- Left Section: Branding and Desktop Nav -->
                    <div class="flex items-center flex-1">
                        <!-- Brand Identity -->
                        <div class="flex-shrink-0 flex items-center mr-8">
                            <a href="${getPath('index.html')}" class="flex items-center gap-2 group">
                                <img src="${getPath('logo.png')}" alt="Kindred Guild" width="40" height="40" class="h-10 w-10 rounded-xl object-cover ring-2 ring-amber-500/30 group-hover:ring-amber-500 transition-all duration-300 group-hover:scale-105">
                                <div class="flex flex-col">
                                    <span class="text-lg font-black tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white via-amber-200 to-amber-400 font-sans leading-none">KINDRED GUILD</span>
                                    <span class="text-[10px] text-amber-500/60 font-medium tracking-widest uppercase mt-0.5">Adventure awaits</span>
                                </div>
                            </a>
                        </div>
                        
                        <!-- Desktop Navigation Menu -->
                        <nav class="hidden lg:flex lg:space-x-6">
                            ${desktopLinks}
                            ${adminLinkHtml}
                        </nav>
                    </div>

                    <!-- Right Section: Desktop Profile & Logout OR Join Button -->
                    <div class="hidden lg:flex lg:items-center lg:gap-4">
                        ${actionPanelHtml}
                    </div>

                    <!-- Mobile Hamburger Menu Button -->
                    <div class="flex items-center lg:hidden">
                        <button type="button" id="mobile-menu-toggle" class="inline-flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-amber-400 hover:bg-slate-800/60 focus:outline-none border border-slate-800 transition duration-150" aria-controls="mobile-menu" aria-expanded="false">
                            <span class="sr-only">Open main menu</span>
                            <i id="hamburger-icon" class="fa-solid fa-bars text-xl"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Dynamic Mobile Navigation Dropdown -->
            <div class="hidden lg:hidden" id="mobile-menu">
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
        
        // Auto-healing fallback: If page doesn't have <nav id="site-nav">, create and prepend it!
        if (!navElement) {
            navElement = document.createElement('nav');
            navElement.id = 'site-nav';
            document.body.prepend(navElement);
        }

        // Apply clean glass styling container
        navElement.className = 'glass-nav sticky top-0 z-50 w-full transition-all duration-300';
        navElement.innerHTML = buildNavbarHTML(user, isAdmin);

        // Bind interactive event listeners for responsiveness
        setupEventHandlers(user);

        // Run self-healing layout checking routines
        adjustFlexBody();

        // Load notification count for logged-in users
        if (user) loadNotificationCount();
    }

    // Centering flex pages layout healing engine
    function adjustFlexBody() {
        const bodyStyle = window.getComputedStyle(document.body);
        if (bodyStyle.display === 'flex' && bodyStyle.flexDirection !== 'column') {
            document.body.classList.add('site-nav-flex-adjusted');
        }
    }

    function setupEventHandlers(user) {
        // Toggle mobile hamburger menu smoothly
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

        // Handle Logout Button actions (both desktop and mobile formats)
        const logoutHandler = async (e) => {
            e.preventDefault();
            if (window.sb || window.supabase) {
                try {
                    const { error } = await (window.sb || window.supabase).auth.signOut();
                    if (error) throw error;
                    // Force refresh back to main portal upon logging out
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

        // If not loaded on window immediately, attempt to wait for 2 seconds
        if (!supabaseClient) {
            let retries = 0;
            supabaseClient = await new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (window.sb || window.supabase) {
                        clearInterval(interval);
                        resolve(window.sb || window.supabase);
                    }
                    retries++;
                    if (retries > 40) { // Limit retry to 2 seconds
                        clearInterval(interval);
                        resolve(null);
                    }
                }, 50);
            });
        }

        if (supabaseClient) {
            // Retrieve session details
            const { data: { session } } = await supabaseClient.auth.getSession();
            const user = session ? session.user : null;
            let isAdmin = false;

            if (user) {
                // Check local app metadata roles
                const isMetaAdmin = user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';
                if (isMetaAdmin) {
                    isAdmin = true;
                } else {
                    // Try to query profile role as fallback if DB table profile exists
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
                        // Suppress profiles table error in case it's not present yet
                        console.log('Skipping profile database authorization check: Use app metadata default.');
                    }
                }
            }

            // Perform initial draw
            renderNavContainer(user, isAdmin);

            // Establish real-time authentication listener so the nav-bar updates fluidly on state transition
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
            // Fallback rendering in case database configuration is pending or local preview
            renderNavContainer(null, false);
        }
    }

    // Load notification count for the bell icon
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

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        showInstallBanner();
    });

    function showInstallBanner() {
        if (localStorage.getItem('kg_install_dismissed')) return;
        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#d4af37,#b8941e);color:#000;padding:12px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;z-index:500;box-shadow:0 4px 20px rgba(212,175,55,0.3);font-size:0.85rem;font-weight:600;max-width:90vw;';
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

    // Initialize nav loading sequence
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigationState);
    } else {
        initNavigationState();
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.warn('[SW] Registration failed:', err.message);
            });
        });
    }
})();