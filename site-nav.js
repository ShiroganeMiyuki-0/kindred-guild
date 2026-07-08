/**
 * Kindred Guild - Global Site Navigation Bar
 * File: site-nav.js
 */
(function () {
    // 1. Inject styling directly to guarantee visibility across all pages
    const styleId = 'site-nav-injected-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            :root {
                --nav-bg: rgba(20, 16, 35, 0.95);
                --nav-border: rgba(147, 51, 234, 0.4);
                --nav-text: #f3f4f6;
                --nav-accent: #fbbf24; /* Guild Gold */
                --nav-hover: rgba(147, 51, 234, 0.25);
            }
            #site-nav-container {
                position: sticky;
                top: 0;
                z-index: 99999;
                background: var(--nav-bg);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border-bottom: 1px solid var(--nav-border);
                font-family: 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                width: 100%;
                box-sizing: border-box;
            }
            .nav-wrapper {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.85rem 1.5rem;
                box-sizing: border-box;
            }
            .nav-brand {
                font-size: 1.35rem;
                font-weight: 800;
                color: var(--nav-text);
                text-decoration: none;
                background: linear-gradient(45deg, var(--nav-accent), #c084fc);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .nav-menu {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .nav-item a, .nav-btn-logout {
                color: var(--nav-text);
                text-decoration: none;
                padding: 0.5rem 0.95rem;
                border-radius: 6px;
                font-size: 0.95rem;
                font-weight: 500;
                transition: all 0.2s ease-in-out;
                cursor: pointer;
                background: transparent;
                border: none;
                display: inline-block;
            }
            .nav-item a:hover {
                background: var(--nav-hover);
                color: #ffffff;
            }
            .nav-item a.active {
                background: rgba(147, 51, 234, 0.4);
                border: 1px solid rgba(147, 51, 234, 0.7);
                color: #ffffff;
            }
            .nav-item.accent-btn a {
                background: linear-gradient(135deg, #a855f7, #6366f1);
                color: #ffffff !important;
                font-weight: 600;
                box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3);
            }
            .nav-item.accent-btn a:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(168, 85, 247, 0.5);
            }
            .nav-btn-logout {
                border: 1px solid rgba(239, 68, 68, 0.4);
                color: #ef4444;
                font-family: inherit;
            }
            .nav-btn-logout:hover {
                background: rgba(239, 68, 68, 0.15);
                border-color: #ef4444;
            }
            .nav-toggle {
                display: none;
                background: transparent;
                border: none;
                color: var(--nav-text);
                font-size: 1.6rem;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }
            @media (max-width: 768px) {
                .nav-toggle {
                    display: block;
                }
                .nav-menu {
                    display: none;
                    flex-direction: column;
                    position: absolute;
                    top: 100%;
                    left: 0;
                    width: 100%;
                    background: rgba(15, 12, 28, 0.98);
                    border-bottom: 1px solid var(--nav-border);
                    padding: 1rem 0;
                    gap: 0.5rem;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.5);
                }
                .nav-menu.open {
                    display: flex;
                }
                .nav-item {
                    width: 100%;
                    text-align: center;
                }
                .nav-item a, .nav-btn-logout {
                    width: 85%;
                    box-sizing: border-box;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Main Render UI Execution
    function renderNavbar(user = null) {
        let navContainer = document.getElementById('site-nav-container');
        
        // Self-healing fallback: if no navbar container is present in HTML, prepend one straight to body
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.id = 'site-nav-container';
            document.body.insertBefore(navContainer, document.body.firstChild);
        }

        const currentPath = window.location.pathname;
        const getActiveClass = (pageName) => {
            return currentPath.endsWith(pageName) || (pageName === 'index.html' && (currentPath === '/' || currentPath.endsWith('/'))) ? 'active' : '';
        };

        // Shared baseline public routes
        let menuItemsHTML = `
            <li class="nav-item"><a href="quest-board.html" class="${getActiveClass('quest-board.html')}">Quest Board</a></li>
            <li class="nav-item"><a href="fairy-wishes.html" class="${getActiveClass('fairy-wishes.html')}">Fairy Wishes</a></li>
            <li class="nav-item"><a href="coin_purchase_ui.html" class="${getActiveClass('coin_purchase_ui.html')}">Coin Shop</a></li>
        `;

        // Dynamic links based on User Auth Session
        if (user) {
            // Safe fallback check for administrator rights via user metadata or custom flag
            const isAdmin = user.user_metadata?.role === 'admin' || user.email?.includes('admin');
            if (isAdmin) {
                menuItemsHTML += `<li class="nav-item"><a href="admin_dashboard_ui.html" class="${getActiveClass('admin_dashboard_ui.html')}">Admin</a></li>`;
            }

            menuItemsHTML += `
                <li class="nav-item accent-btn"><a href="quest-post.html">Post Quest</a></li>
                <li class="nav-item"><a href="profile.html" class="${getActiveClass('profile.html')}">Profile</a></li>
                <li class="nav-item"><button id="nav-logout-btn" class="nav-btn-logout">Sign Out</button></li>
            `;
        } else {
            menuItemsHTML += `
                <li class="nav-item accent-btn"><a href="auth.html" class="${getActiveClass('auth.html')}">Enter Guild</a></li>
            `;
        }

        navContainer.innerHTML = `
            <nav class="nav-wrapper">
                <a href="index.html" class="nav-brand">🏰 Kindred Guild</a>
                <button class="nav-toggle" id="nav-toggle-btn" aria-label="Toggle Menu">☰</button>
                <ul class="nav-menu" id="nav-menu-list">
                    ${menuItemsHTML}
                </ul>
            </nav>
        `;

        // Mobile responsive event listener binding
        const toggleBtn = document.getElementById('nav-toggle-btn');
        const menuList = document.getElementById('nav-menu-list');
        if (toggleBtn && menuList) {
            toggleBtn.addEventListener('click', () => {
                menuList.classList.toggle('open');
                toggleBtn.textContent = menuList.classList.contains('open') ? '✕' : '☰';
            });
        }

        // Supabase sign-out controller binding
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (window.supabase) {
                    const { error } = await window.supabase.auth.signOut();
                    if (error) console.error('Sign out error:', error.message);
                    window.location.href = 'index.html';
                } else {
                    console.warn('Supabase global instance missing. Forcing redirect to home.');
                    window.location.href = 'index.html';
                }
            });
        }
    }

    // 3. Setup Observers to capture Supabase status cleanly
    function initNavbarLifecycle() {
        // Render initial unauthenticated state first so navigation is instantly usable
        renderNavbar(null);

        const checkAuth = () => {
            if (window.supabase) {
                // Fetch existing persistent session
                window.supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session) renderNavbar(session.user);
                });

                // Listen continuously for auth state events (sign-ins, rollbacks, logouts)
                window.supabase.auth.onAuthStateChange((event, session) => {
                    renderNavbar(session ? session.user : null);
                });
                return true;
            }
            return false;
        };

        // If Supabase hasn't loaded immediately due to client script ordering delays, poll cleanly
        if (!checkAuth()) {
            const authPoller = setInterval(() => {
                if (checkAuth()) clearInterval(authPoller);
            }, 250);
            
            // Clear polling execution after 4 seconds safety boundary limit
            setTimeout(() => clearInterval(authPoller), 4000);
        }
    }

    // Deploy onto DOM lifecycle loop
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavbarLifecycle);
    } else {
        initNavbarLifecycle();
    }
})();
