// Theme Toggle Functionality
class ThemeManager {
  constructor() {
    // If user has a stored preference, use it. Otherwise fall back to the
    // browser/OS preference (prefers-color-scheme). Default to 'dark' if
    // neither is available.
    const stored = this.getStoredTheme();
    if (stored) {
      this.currentTheme = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      this.currentTheme = 'light';
    } else {
      this.currentTheme = 'dark';
    }

    this.init();
  }

  init() {
    // Set initial theme
    // When initializing, if the source of the theme was a system preference
    // (i.e. there was no stored user preference), do NOT persist it. That
    // allows the site to follow future system changes until the user toggles.
    const hasStored = !!this.getStoredTheme();
    this.applyTheme(this.currentTheme, hasStored);
    
    // Simple approach - try multiple times
    this.tryAttachListener();
    // Start listening to system preference changes only when user has NOT
    // explicitly chosen a theme.
    this.setupSystemPrefListener();
  }

  setupSystemPrefListener() {
    if (!window.matchMedia) return;
    // Listen for changes to the *light* preference. We'll only respond if
    // the user hasn't stored an explicit choice.
    try {
      this._mq = window.matchMedia('(prefers-color-scheme: light)');
      const handler = (e) => this._handleSystemPrefChange(e);
      if (this._mq.addEventListener) {
        this._mq.addEventListener('change', handler);
      } else if (this._mq.addListener) {
        this._mq.addListener(handler);
      }
    } catch (err) {
      // ignore
    }
  }

  _handleSystemPrefChange(e) {
    // Only auto-apply system changes when the user hasn't saved a theme
    if (this.getStoredTheme()) return;
    const newTheme = e.matches ? 'light' : 'dark';
    // Do not persist system-driven changes
    this.applyTheme(newTheme, false);
  }

  tryAttachListener() {
    // Try immediately
    this.attachToggleListener();
    
    // Try after DOM loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => this.attachToggleListener(), 50);
      });
    }
    
    // Try after a short delay (for dynamic content)
    setTimeout(() => this.attachToggleListener(), 200);
    setTimeout(() => this.attachToggleListener(), 500);
    setTimeout(() => this.attachToggleListener(), 1000);
  }

  attachToggleListener() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      if (!toggleBtn.hasAttribute('data-theme-listener')) {
        toggleBtn.setAttribute('data-theme-listener', 'true');
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleTheme();
        });
        return true;
      }
    }
    return false;
  }

  getStoredTheme() {
    try {
      return localStorage.getItem('theme');
    } catch (e) {
      return null;
    }
  }

  setStoredTheme(theme) {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn('Could not save theme preference');
    }
  }

  // persist: if true, store the choice in localStorage; if false, don't
  // (used for system-driven defaults)
  applyTheme(theme, persist = true) {
    // Remove existing theme attribute
    document.documentElement.removeAttribute('data-theme');
    
    // Apply new theme (only set attribute for light theme, dark is default)
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    
    this.currentTheme = theme;
    if (persist) this.setStoredTheme(theme);
    
    // Dispatch custom event for other scripts to listen to
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: theme } 
    }));
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    // User action should persist their choice
    this.applyTheme(newTheme, true);
    
    // Add a small animation to the toggle button
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.style.transform = 'scale(0.9)';
      setTimeout(() => {
        toggleBtn.style.transform = '';
      }, 150);
    }
  }

  getCurrentTheme() {
    return this.currentTheme;
  }
}

// Initialize theme manager
const themeManager = new ThemeManager();

// Export for other scripts to use
window.themeManager = themeManager;

// Failsafe click handler using event delegation (always works)
document.addEventListener('click', (e) => {
  // Check if clicked element or its parent is the theme toggle
  const toggleElement = e.target.closest('#theme-toggle');
  if (toggleElement) {
    e.preventDefault();
    e.stopPropagation();
    themeManager.toggleTheme();
  }
});