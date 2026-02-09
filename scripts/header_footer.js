async function loadHeaderFooter() {
  try {
    const headerResponse = await fetch('/header.html');
    const footerResponse = await fetch('/footer.html');

    if (!headerResponse.ok || !footerResponse.ok) {
      throw new Error(`Failed to fetch header or footer: ${headerResponse.status} ${footerResponse.status}`);
    }

    const headerHtml = await headerResponse.text();
    const footerHtml = await footerResponse.text();

    document.getElementById('header-container').innerHTML = headerHtml;
    document.getElementById('footer-container').innerHTML = footerHtml;

    ensureBodyTextures();

    // Now that header is loaded, set up the menu toggle
    setupMenuToggle();
    
    // Also set up theme toggle if the theme manager exists
    if (window.themeManager) {
      window.themeManager.attachToggleListener();
    }

  } catch (error) {
    console.error("Error loading header/footer:", error);
  }
}

function ensureBodyTextures() {
  const existingLeft = document.querySelector('.texture-left');
  const existingRight = document.querySelector('.texture-right');

  if (!existingLeft) {
    const left = document.createElement('div');
    left.className = 'texture-left';
    document.body.appendChild(left);
  }

  if (!existingRight) {
    const right = document.createElement('div');
    right.className = 'texture-right';
    document.body.appendChild(right);
  }
}

function ensureImageModal() {
  if (document.getElementById('image-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'image-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <span class="modal-close">&times;</span>
    <div class="modal-content">
      <img id="modal-image-content" src="" alt="Expanded image">
    </div>
  `;

  document.body.appendChild(modal);
}

function openImageModal(imageSrc, altText) {
  const modal = document.getElementById('image-modal');
  const modalImage = document.getElementById('modal-image-content');
  if (!modal || !modalImage) return;

  modalImage.src = imageSrc;
  modalImage.alt = altText || 'Expanded image';
  modal.classList.add('show-modal');
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  if (modal) modal.classList.remove('show-modal');
}

function setupImageModal() {
  ensureImageModal();

  const modal = document.getElementById('image-modal');
  const closeBtn = modal ? modal.querySelector('.modal-close') : null;

  if (closeBtn) {
    closeBtn.addEventListener('click', closeImageModal);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeImageModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && modal.classList.contains('show-modal')) {
      closeImageModal();
    }
  });

  document.addEventListener('click', (event) => {
    const img = event.target.closest('img');
    if (!img) return;
    if (img.closest('.modal-overlay') || img.closest('.code-modal-overlay')) return;
    if (img.closest('button, [role="button"], .button, .tool-btn, .social_link, .theme-toggle-btn')) return;
    if (img.closest('header, footer') && img.closest('a')) return;
    if (img.dataset.noImageModal === 'true') return;

    event.preventDefault();
    img.classList.add('image-modal-trigger');
    openImageModal(img.currentSrc || img.src, img.alt || 'Expanded image');
  });

  const shouldSkipImage = (img) => {
    if (img.dataset.noImageModal === 'true') return true;
    if (img.closest('button, [role="button"], .button, .tool-btn, .social_link, .theme-toggle-btn')) return true;
    if (img.closest('header, footer') && img.closest('a')) return true;
    return false;
  };

  const markTriggers = (root = document) => {
    root.querySelectorAll('img').forEach(img => {
      if (shouldSkipImage(img)) return;
      img.classList.add('image-modal-trigger');
    });
  };

  markTriggers();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('img')) {
          if (!shouldSkipImage(node)) {
            node.classList.add('image-modal-trigger');
          }
          return;
        }
        if (node.querySelectorAll) {
          markTriggers(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function setupMenuToggle() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".header__nav ul.flex");
  const navLinks = nav ? nav.querySelectorAll("a") : [];

  if (toggle && nav) {
    // Toggle menu open/close on burger button click
    toggle.addEventListener("click", () => {
      nav.classList.toggle("show");
    });

    // Close menu when any nav link is clicked
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        nav.classList.remove("show");
      });
    });
  }
}


loadHeaderFooter();

document.addEventListener('DOMContentLoaded', setupImageModal);
