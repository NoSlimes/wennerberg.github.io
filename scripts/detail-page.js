// Shared rendering for the project and experience detail pages.
// project-loader.js and experience-loader.js only fetch their data and pick
// labels; everything that draws the page lives here.

// Parse YAML frontmatter and markdown content from a detail page's .md file.
// Text before the first "## " heading is the overview; each "## " starts a section.
function parseDetailMarkdown(mdText, id) {
  const lines = mdText.split(/\r?\n/);

  if (!lines[0].match(/^---\s*$/)) {
    throw new Error(`Invalid markdown format for ${id} - missing opening frontmatter`);
  }

  const frontmatterEndLine = lines.findIndex((line, i) => i > 0 && /^---\s*$/.test(line));
  if (frontmatterEndLine === -1) {
    throw new Error(`Invalid markdown format for ${id} - missing closing frontmatter`);
  }

  let frontmatter;
  try {
    frontmatter = jsyaml.load(lines.slice(1, frontmatterEndLine).join('\n')) || {};
  } catch (e) {
    console.error('YAML parse error for', id, ':', e);
    throw new Error(`Failed to parse frontmatter for ${id}: ${e.message}`);
  }

  const sections = [];
  const mdLines = lines.slice(frontmatterEndLine + 1).join('\n').trim().split(/\r?\n/);
  let currentSection = null;
  let currentBody = [];
  let overview = '';
  let inCodeBlock = false;

  const closeSection = () => {
    if (!currentSection) return;
    currentSection.body = currentBody.join('\n').trim();
    sections.push(currentSection);
  };

  for (const line of mdLines) {
    // Only treat headings when not inside a fenced code block
    if (!inCodeBlock && /^##\s+/.test(line)) {
      closeSection();
      currentSection = { heading: line.replace(/^##\s+/, '').trim(), body: '' };
      currentBody = [];
      continue;
    }

    if (currentSection) {
      currentBody.push(line);
    } else if (line.trim()) {
      overview += (overview ? '\n' : '') + line;
    }

    if (line.startsWith('```')) inCodeBlock = !inCodeBlock;
  }
  closeSection();

  return {
    frontmatter,
    overview: overview || frontmatter.overview || '',
    sections: sections.filter(s => s.body)
  };
}

// Info can be a map ({Key: value}) or a list ([{label, value}]).
// Normalize to a map so both old and CMS-saved files render.
function normalizeInfo(info) {
  if (Array.isArray(info)) {
    const map = {};
    info.forEach(row => {
      if (row && row.label) map[row.label] = row.value ?? '';
    });
    return map;
  }
  return info;
}

// Per-page meta tags for search and link previews (the pages are rendered client-side).
function updateDetailMeta({ name, pageTitle, overview, heroImage, fallbackDescription }) {
  const setMeta = (attr, key, value) => {
    if (!value) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  };
  const stripHtml = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || '').trim().replace(/\s+/g, ' ');
  };
  const absUrl = (src) => {
    if (!src) return '';
    try { return new URL(src, window.location.origin).href; } catch (e) { return src; }
  };

  // The overview may contain inline markdown (links); search snippets get plain text
  let desc = stripHtml(marked.parseInline(overview || ''));
  if (!desc && fallbackDescription) desc = stripHtml(fallbackDescription);
  if (desc.length > 160) desc = desc.slice(0, 157) + '...';
  const title = `${name} – Elias Wennerberg`;
  const image = absUrl(heroImage);

  document.title = pageTitle || title;
  setMeta('name', 'description', desc);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', window.location.href);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', image);
  let canon = document.head.querySelector('link[rel="canonical"]');
  if (!canon) {
    canon = document.createElement('link');
    canon.setAttribute('rel', 'canonical');
    document.head.appendChild(canon);
  }
  canon.setAttribute('href', window.location.href);
}

// Hero intro text: inline markdown (e.g. links) rendered, external links in a new tab
function renderInlineMarkdown(el, markdown) {
  el.innerHTML = marked.parseInline(markdown || '');
  el.querySelectorAll('a[href^="http"]').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const CODE_LANGUAGE_LOGOS = {
  csharp: 'Logo_C_sharp.svg',
  cs: 'Logo_C_sharp.svg',
  cpp: 'ISO_C++_Logo.svg',
  cplusplus: 'ISO_C++_Logo.svg',
  c: 'ISO_C++_Logo.svg'
};

// Markdown -> HTML via marked. Fenced code blocks become collapsible,
// Prism-highlighted <details> dropdowns.
function markdownToHtml(markdown) {
  if (!markdown) return '';

  // Pull code blocks out before marked sees them
  const codeBlocks = [];
  let processedMarkdown = markdown.replace(/```(\w+)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `\n::CODEBLOCK_${codeBlocks.length}::\n`;
    codeBlocks.push({ lang, code });
    return placeholder;
  });

  processedMarkdown = processedMarkdown.replace(
    /{{image:([^|]+)\|([^|]+)\|([^}]+)}}/g,
    '![$2]($1)'
  );

  let html = marked.parse(processedMarkdown);

  codeBlocks.forEach((block, i) => {
    let highlighted;
    try {
      const grammar = Prism.languages[block.lang] || Prism.languages.plaintext;
      highlighted = Prism.highlight(block.code, grammar, block.lang);
    } catch (e) {
      highlighted = escapeHtml(block.code);
    }

    const placeholder = `::CODEBLOCK_${i}::`;
    const langLabel = block.lang ? `Code (${block.lang.toUpperCase()})` : 'Code';
    const logoFile = CODE_LANGUAGE_LOGOS[(block.lang || '').toLowerCase()];
    const summaryInner = logoFile
      ? `<span class="code-dropdown__icon" aria-hidden="true"><img src="/assets/images/logos/${logoFile}" alt=""></span>${langLabel}`
      : langLabel;
    const codeHtml = `
      <details class="code-dropdown">
        <summary>${summaryInner}</summary>
        <pre><code class="language-${block.lang}">${highlighted}</code></pre>
      </details>
    `;
    // Replace the placeholder whether or not marked wrapped it in a <p>
    html = html.replace(new RegExp(`<p[^>]*>\\s*${placeholder}\\s*<\/p>`, 'g'), codeHtml);
    html = html.replace(new RegExp(placeholder, 'g'), codeHtml);
  });

  // External links open in a new tab
  html = html.replace(/<a\s+(?!.*target=)((?:[^>](?!href=))*?)href="(https?:\/\/[^"]*)"([^>]*)>/g,
    '<a $1href="$2" target="_blank" rel="noopener noreferrer"$3>');

  return html;
}

// Custom content tags inside section bodies:
//   {{image:path|Caption|position}}  {{gallery:a.jpg,b.jpg|Caption}}  {{video:path.mp4|Caption}}
function processInlineImages(text, pageName) {
  if (!text) return text;
  const containsPre = /<pre[\s>]/i.test(text);
  const containsList = /<ul[\s>]|<ol[\s>]/i.test(text);
  const uploadPath = (p) => (/^(https?:)?\//.test(p) ? p : `/assets/uploads/${p}`);

  text = text.replace(/\{\{image:([^|}]+)(?:\|([^|}]*))?(?:\|([^}]*))?\}\}/g, (match, imagePath, caption, position) => {
    let actualCaption = caption;
    let actualPosition = position;

    // Older files put the position in the caption slot
    if (caption && !position && ['inline', 'right', 'left', 'center'].includes(caption.toLowerCase().trim())) {
      actualPosition = caption;
      actualCaption = null;
    }

    const positionClass = {
      inline: ' inline-image-inline',
      right: ' inline-image-right',
      left: ' inline-image-left'
    }[(actualPosition || '').toLowerCase().trim()] || '';

    return `<div class="inline-image-container${positionClass}">
              <img src="${uploadPath(imagePath)}" alt="${caption || `${pageName} image`}" class="inline-image">
              ${actualCaption ? `<p class="image-caption">${actualCaption}</p>` : ''}
            </div>`;
  });

  text = text.replace(/\{\{gallery:([^|]+)(?:\|([^}]+))?\}\}/g, (match, imageList, caption) => {
    const images = imageList.split(',').map(img => img.trim());
    const galleryId = 'gallery-' + Math.random().toString(36).substr(2, 9);
    const imgs = images.map((imagePath, index) =>
      `<img src="${uploadPath(imagePath)}" alt="${pageName} gallery image ${index + 1}" class="gallery-image">`
    ).join('');
    return `<div class="inline-gallery-container">${caption ? `<h4 class="gallery-title">${caption}</h4>` : ''}<div class="inline-gallery" id="${galleryId}">${imgs}</div></div>`;
  });

  text = text.replace(/\{\{video:([^|]+)(?:\|([^}]+))?\}\}/g, (match, videoPath, caption) => {
    return `<div class="inline-video-container">
              <video controls class="inline-video">
                <source src="${uploadPath(videoPath)}" type="video/mp4">
                Your browser does not support the video tag.
              </video>
              ${caption ? `<p class="video-caption">${caption}</p>` : ''}
            </div>`;
  });

  // Rendered markdown already has its own paragraphs/lists; plain text gets <p>/<br>
  if (!containsPre && !containsList) {
    text = text.replace(/\n\s*\n/g, '</p><p>').replace(/\n/g, '<br>');
    if (text && !text.trim().startsWith('<p>')) text = `<p>${text}</p>`;
  }

  return text;
}

// Playable video embed (YouTube, Vimeo or .mp4) for the bottom of the page
function getVideoEmbed(url) {
  try {
    const urlObj = new URL(url, window.location.href);
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      const videoId = urlObj.searchParams.get('v') || urlObj.pathname.slice(1);
      if (!videoId) return null;
      const start = parseYouTubeStart(urlObj.searchParams.get('t') || urlObj.searchParams.get('start'));
      const startParam = start > 0 ? `?start=${start}` : '';
      return `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}${startParam}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    if (urlObj.hostname.includes('vimeo.com')) {
      const videoId = urlObj.pathname.split('/').pop();
      if (!videoId || isNaN(videoId)) return null;
      return `<div class="video-container"><iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    if (urlObj.pathname.endsWith('.mp4')) {
      return `<div class="video-container"><video controls><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video></div>`;
    }
  } catch (error) {
    console.error('Could not parse video URL:', url, error);
  }
  return null;
}

// Hero tags: logo + name when the tag has an icon, plain text otherwise
function renderSkillTags(container, flairs) {
  container.innerHTML = '';
  (flairs || []).forEach(flair => {
    const name = (flair || '').toString();
    const el = document.createElement('span');
    el.className = 'skill-tag';
    const file = flairIconFile(name);
    if (file) {
      const img = document.createElement('img');
      img.src = `/assets/images/logos/${file}`;
      img.alt = `${name} logo`;
      img.width = 18;
      img.height = 18;
      el.appendChild(img);
    }
    el.appendChild(document.createTextNode(name));
    container.appendChild(el);
  });
}

const LINK_LABELS = {
  github: 'GitHub',
  demo: 'Download / Demo',
  trello: 'Trello',
  website: 'Website',
  linkedin: 'LinkedIn',
  itch: 'Itch',
  steam: 'Steam',
  playstore: 'Play Store',
  appstore: 'App Store',
  video: 'Video',
  blog: 'Blog',
  docs: 'Docs'
};

// One button per non-empty link; external links open in a new tab
function renderActionButtons(container, links) {
  if (!container) return;
  container.innerHTML = '';
  Object.entries(links || {}).forEach(([key, href]) => {
    if (!href || key === 'readMore' || key === 'detailPageUrl') return;
    const a = document.createElement('a');
    a.className = 'button button--secondary';
    a.href = href;
    let external = true;
    try { external = new URL(href, window.location.origin).hostname !== window.location.hostname; } catch (e) { /* keep new tab */ }
    if (external) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.textContent = LINK_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
    container.appendChild(a);
  });
}

// Info boxes beside the content: a list (highlights) or a key/value table (info)
function renderInfoBoxes(container, boxes) {
  const box = ({ title, data, table }) => {
    if (!data) return '';
    let content;
    if (Array.isArray(data)) {
      if (!data.length) return '';
      content = `<ul>${data.map(item => `<li>${item}</li>`).join('')}</ul>`;
    } else if (typeof data === 'object' && Object.keys(data).length > 0) {
      content = table
        ? `<table class="project-info-table"><tbody>${Object.entries(data).map(([key, value]) =>
            `<tr><td class="project-info-table__key">${key}</td><td class="project-info-table__value">${value}</td></tr>`).join('')}</tbody></table>`
        : `<ul>${Object.entries(data).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}</ul>`;
    } else {
      return '';
    }
    return `<div class="project-info__box"><h3>${title}</h3>${content}</div>`;
  };
  container.innerHTML = boxes.map(box).join('');
}

// Article sections plus the "On This Page" table of contents
function renderSections(container, sections, pageName) {
  container.innerHTML = '';
  const tocItems = [];

  sections.forEach(section => {
    const sectionId = section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const sectionEl = document.createElement('div');
    sectionEl.className = 'project-detailed-section';
    sectionEl.id = sectionId;
    sectionEl.innerHTML = `<h2>${section.heading}</h2>`;

    const bodyDiv = document.createElement('div');
    bodyDiv.innerHTML = processInlineImages(markdownToHtml(section.body), pageName);
    sectionEl.appendChild(bodyDiv);

    container.appendChild(sectionEl);
    tocItems.push({ id: sectionId, title: section.heading });
  });

  const tocNav = document.getElementById('toc-nav');
  const tocContainer = document.getElementById('table-of-contents');
  tocNav.innerHTML = tocItems.map(item => `<a href="#${item.id}" class="toc-item">${item.title}</a>`).join('');
  tocContainer.style.display = tocItems.length ? 'block' : 'none';
  trackActiveSection(tocNav);

  // The Prism autoloader fetches language grammars on demand, so markdownToHtml's
  // first pass is often plain text; this pass loads the grammar and colors the code.
  if (typeof Prism !== 'undefined') {
    setTimeout(() => Prism.highlightAllUnder(container), 100);
  }
}

// Highlight the "On This Page" link for the section being read: the last section
// whose top has passed a line a third of the way down the screen.
function trackActiveSection(tocNav) {
  const links = [...tocNav.querySelectorAll('a')];
  const sections = links.map(link => document.getElementById(link.getAttribute('href').slice(1)));
  if (!links.length) return;

  let ticking = false;
  let clickJump = null; // a clicked link stays active while the page scrolls to it
  const setActive = (active) => links.forEach((link, i) => link.classList.toggle('is-active', i === active));

  const update = () => {
    ticking = false;
    if (clickJump !== null) return;
    const line = window.innerHeight / 3;
    let active = 0;
    sections.forEach((section, i) => {
      if (section && section.getBoundingClientRect().top <= line) active = i;
    });
    // At the very bottom the last section may never reach the line
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      active = sections.length - 1;
    }
    setActive(active);
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  links.forEach((link, i) => link.addEventListener('click', () => {
    clickJump = i;
    setActive(i);
    // Resume tracking once the jump is over and the reader scrolls on their own
    setTimeout(() => {
      const resume = () => { clickJump = null; };
      window.addEventListener('wheel', resume, { once: true, passive: true });
      window.addEventListener('touchmove', resume, { once: true, passive: true });
      window.addEventListener('keydown', resume, { once: true });
    }, 100);
  }));

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

function renderGallery(container, images, pageName, headerText) {
  container.innerHTML = '';
  if (!images || !images.length) return;
  container.classList.add('new-gallery-layout');

  const header = document.createElement('h2');
  header.textContent = headerText;
  header.className = 'gallery-section-header';
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';
  images.forEach(imageUrl => {
    const link = document.createElement('a');
    link.href = imageUrl;
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `${pageName} gallery image`;
    link.appendChild(img);
    grid.appendChild(link);
  });
  container.appendChild(grid);
}

function renderVideo(wrapper, url) {
  const html = url ? getVideoEmbed(url) : null;
  if (html && wrapper) wrapper.innerHTML = html;
}

// Full-page message (not found / error) in place of the detail layout
function showDetailMessage(mainContent, title, html) {
  mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>${title}</h1>${html}</div>`;
}
