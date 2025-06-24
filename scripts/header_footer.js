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

  } catch (error) {
    console.error("Error loading header/footer:", error);
    // Optionally display a fallback header/footer or an error message to the user.
  }
}

loadHeaderFooter(); // Call the function to load the header and footer.