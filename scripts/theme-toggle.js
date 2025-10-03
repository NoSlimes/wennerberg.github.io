// Theme Toggle Functionality
class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || 'dark';
    this.init();
  }

  init() {
    // Set initial theme
    this.applyTheme(this.currentTheme);
    
    // Simple approach - try multiple times
    this.tryAttachListener();
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

  applyTheme(theme) {
    // Remove existing theme attribute
    document.documentElement.removeAttribute('data-theme');
    
    // Apply new theme (only set attribute for light theme, dark is default)
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    
    this.currentTheme = theme;
    this.setStoredTheme(theme);
    
    // Dispatch custom event for other scripts to listen to
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: theme } 
    }));
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    
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