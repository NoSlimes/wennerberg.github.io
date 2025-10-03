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
