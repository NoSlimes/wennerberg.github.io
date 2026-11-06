// About page: profile card from data/about.md's frontmatter, CV sections from its body.
// Uses parseDetailMarkdown/markdownToHtml from detail-page.js.

async function loadAbout() {
  const sectionsEl = document.getElementById('about-sections');
  try {
    const response = await fetch('/data/about.md');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { frontmatter: about, overview, sections } = parseDetailMarkdown(await response.text(), 'about');

    if (about.pageTitle) document.title = about.pageTitle;
    if (about.portrait) document.getElementById('about-portrait').src = about.portrait;
    document.getElementById('about-name').textContent = about.name || 'Elias Wennerberg';
    document.getElementById('about-role').textContent = about.role || '';
    document.getElementById('about-intro').textContent = overview;

    renderAboutFacts(document.getElementById('about-facts'), about);
    renderAboutLinks(document.getElementById('about-links'), about.links || {});

    sectionsEl.innerHTML = '';
    sections.forEach(section => {
      const el = document.createElement('section');
      el.className = 'about-section';
      el.innerHTML = `<h2>${section.heading}</h2>${markdownToHtml(section.body)}`;
      groupTimelineEntries(el);
      sectionsEl.appendChild(el);
    });
  } catch (error) {
    console.error('Failed to load about page:', error);
    sectionsEl.innerHTML = '<p>Could not load this page right now. Please try again later.</p>';
  }
}

// Each "### Place · Role" heading and everything up to the next one becomes one
// .about-entry, so the timeline line can run unbroken down the whole entry.
function groupTimelineEntries(sectionEl) {
  let entry = null;
  [...sectionEl.children].forEach(child => {
    if (child.tagName === 'H3') {
      entry = document.createElement('div');
      entry.className = 'about-entry';
      child.before(entry);
    }
    if (entry && child.tagName !== 'H2') entry.appendChild(child);
  });
}

function renderAboutFacts(list, about) {
  const facts = [
    ['Based in', about.location],
    ['Languages', about.languages]
  ];
  list.innerHTML = '';
  facts.forEach(([label, value]) => {
    if (!value || (Array.isArray(value) && !value.length)) return;
    const dt = document.createElement('dt');
    dt.textContent = label;
    list.append(dt);
    // One row per list item; "Swedish (native)" shows the part in brackets as a muted level
    (Array.isArray(value) ? value : [value]).forEach(item => {
      const dd = document.createElement('dd');
      const match = String(item).match(/^(.*?)\s*\((.+)\)$/);
      dd.textContent = match ? match[1] : item;
      if (match) {
        const level = document.createElement('span');
        level.className = 'about-card__fact-level';
        level.textContent = match[2];
        dd.append(' ', level);
      }
      list.append(dd);
    });
  });
}

// Resume as the main button, then icon links (GitHub, LinkedIn, email)
function renderAboutLinks(container, links) {
  const icons = {
    github: '<svg width="20" height="20" aria-hidden="true"><use href="/assets/images/icons.svg#github"/></svg>',
    linkedin: '<svg width="20" height="20" aria-hidden="true"><use href="/assets/images/icons.svg#linkedin"/></svg>'
  };
  const labels = { github: 'GitHub', linkedin: 'LinkedIn' };
  let html = links.resume ? `<a class="button about-card__resume" href="${links.resume}">View resume</a>` : '';
  html += '<div class="about-card__icons">';
  Object.entries(icons).forEach(([key, icon]) => {
    if (links[key]) html += `<a class="social_link" href="${links[key]}" target="_blank" rel="noopener noreferrer" aria-label="${labels[key]}">${icon}</a>`;
  });
  // Same hidden-address email link as the rest of the site (handled in header_footer.js)
  html += '<a href="#" class="social_link email-link" aria-label="Email Elias Wennerberg"><svg width="20" height="20" aria-hidden="true"><use href="/assets/images/icons.svg#email"/></svg></a>';
  html += '</div>';
  container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', loadAbout);
