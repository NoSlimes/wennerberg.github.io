// Parse YAML frontmatter and markdown content from experience markdown files
function parseMarkdownExperience(mdText, experienceId) {
  // Split frontmatter from content - handle various line endings
  const lines = mdText.split(/\r?\n/);

  if (!lines[0].match(/^---\s*$/)) {
    throw new Error(`Invalid markdown format for experience ${experienceId} - missing opening frontmatter`);
  }

  // Find closing frontmatter delimiter
  let frontmatterEndLine = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(/^---\s*$/)) {
      frontmatterEndLine = i;
      break;
    }
  }

  if (frontmatterEndLine === -1) {
    throw new Error(`Invalid markdown format for experience ${experienceId} - missing closing frontmatter`);
  }

  const frontmatterText = lines.slice(1, frontmatterEndLine).join('\n');
  const markdownContent = lines.slice(frontmatterEndLine + 1).join('\n');

  // Parse YAML frontmatter
  let frontmatter;
  try {
    frontmatter = jsyaml.load(frontmatterText);
  } catch (e) {
    console.error('YAML parse error for experience', experienceId, ':', e);
    throw new Error(`Failed to parse frontmatter for experience ${experienceId}: ${e.message}`);
  }

  // Parse markdown into sections
  const sections = [];
  const mdLines = markdownContent.trim().split(/\r?\n/);

  let currentSection = null;
  let currentBody = [];
  let overview = '';
  let inOverview = true;
  let inCodeBlock = false;

  for (let i = 0; i < mdLines.length; i++) {
    const line = mdLines[i];
    const isSpecialCodeFence = /^```\w+-(preview|expanded):/.test(line);
    const isRegularFence = line.startsWith('```') && !isSpecialCodeFence;

    if (!inCodeBlock && line.match(/^##\s+/)) {
      inOverview = false;

      if (currentSection) {
        currentSection.body = currentBody.join('\n').trim();
        sections.push(currentSection);
      }

      const heading = line.replace(/^##\s+/, '').trim();

      currentSection = {
        heading: heading,
        body: '',
        codePreviewFile: null,
        codeExpandedFile: null,
        codeLanguage: null
      };
      currentBody = [];
      continue;
    }
    else if (!inCodeBlock && isSpecialCodeFence) {
      const previewMatch = line.match(/^```(\w+)-preview:(.+)$/);
      if (previewMatch && currentSection) {
        currentSection.codeLanguage = previewMatch[1];
        currentSection.codePreviewFile = previewMatch[2].trim();
      }
      const expandedMatch = line.match(/^```(\w+)-expanded:(.+)$/);
      if (expandedMatch && currentSection) {
        currentSection.codeLanguage = expandedMatch[1];
        currentSection.codeExpandedFile = expandedMatch[2].trim();
      }
      continue;
    }

    if (currentSection) {
      currentBody.push(line);
    } else if (inOverview && line.trim()) {
      overview += (overview ? '\n' : '') + line;
    }

    if (isRegularFence) {
      inCodeBlock = !inCodeBlock;
    }
  }

  if (currentSection) {
    currentSection.body = currentBody.join('\n').trim();
    sections.push(currentSection);
  }

  const detailedSections = sections.filter(s => s.body || s.codePreviewFile);

  return {
    pageTitle: frontmatter.pageTitle,
    heroImage: frontmatter.heroImage,
    heroVideoUrl: frontmatter.heroVideoUrl || '',
    experienceName: frontmatter.experienceName,
    experienceType: frontmatter.experienceType,
    flairs: frontmatter.flairs || [],
    experienceInfo: normalizeInfo(frontmatter.experienceInfo) || {},
    galleryImages: frontmatter.galleryImages || [],
    videoURL: frontmatter.videoURL || '',
    codeLanguage: frontmatter.codeLanguage,
    codePreviewFile: frontmatter.codePreviewFile,
    codeExpandedFile: frontmatter.codeExpandedFile,
    overview: overview || frontmatter.overview || '',
    highlights: Array.isArray(frontmatter.highlights) ? frontmatter.highlights : [],
    detailedSections: detailedSections,
    links: frontmatter.links || {}
  };
}

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

// Per-experience meta tags for search and link previews
function updateExperienceMeta(experience) {
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
  let desc = (experience.overview || '').trim().replace(/\s+/g, ' ');
  if (desc.length > 160) desc = desc.slice(0, 157) + '...';
  const title = `${experience.experienceName} – Elias Wennerberg`;
  const image = absUrl(experience.heroImage);

  document.title = experience.pageTitle || title;
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

// Convert markdown to HTML using marked.js library
function markdownToHtml(markdown) {
  if (!markdown) return '';

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
    let highlighted = block.code;

    if (typeof Prism !== 'undefined') {
      try {
        const grammar = Prism.languages[block.lang] || Prism.languages.plaintext;
        highlighted = Prism.highlight(block.code, grammar, block.lang);
      } catch (e) {
        highlighted = block.code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
    } else {
      highlighted = block.code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    const placeholder = `::CODEBLOCK_${i}::`;
    const langKey = (block.lang || '').toString().toLowerCase();
    const langLabel = block.lang ? `Code (${block.lang.toUpperCase()})` : 'Code';
    const logoMap = {
      csharp: 'Logo_C_sharp.svg',
      cs: 'Logo_C_sharp.svg',
      cpp: 'ISO_C++_Logo.svg',
      cplusplus: 'ISO_C++_Logo.svg',
      c: 'ISO_C++_Logo.svg'
    };
    const logoFile = logoMap[langKey];
    const summaryInner = logoFile
      ? `<span class="code-dropdown__icon" aria-hidden="true"><img src="/assets/images/logos/${logoFile}" alt=""></span>${langLabel}`
      : langLabel;
    const codeHtml = `
      <details class="code-dropdown">
        <summary>${summaryInner}</summary>
        <pre><code class="language-${block.lang}">${highlighted}</code></pre>
      </details>
    `;
    const paragraphRegex = new RegExp(`<p[^>]*>\\s*${placeholder}\\s*<\/p>`, 'g');
    html = html.replace(paragraphRegex, codeHtml);
    html = html.replace(new RegExp(placeholder, 'g'), codeHtml);
  });

  html = html.replace(/<a\s+(?!.*target=)((?:[^>](?!href=))*?)href="(https?:\/\/[^"]*)"([^>]*)>/g,
    '<a $1href="$2" target="_blank" rel="noopener noreferrer"$3>');

  return html;
}

function getVideoEmbed(url) {
  let embedHtml = null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId = urlObj.searchParams.get('v') || urlObj.pathname.slice(1);
      if (videoId) {
        const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
        const startParam = tParam ? `?start=${tParam}` : '';
        embedHtml = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}${startParam}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
      }
    } else if (urlObj.hostname.includes('vimeo.com')) {
      const videoId = urlObj.pathname.split('/').pop();
      if (videoId && !isNaN(videoId)) {
        embedHtml = `<div class="video-container"><iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
      }
    } else if (urlObj.pathname.endsWith('.mp4')) {
      embedHtml = `<div class="video-container"><video controls><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video></div>`;
    }
  } catch (error) { console.error("Could not parse video URL:", url, error); return null; }
  return embedHtml;
}

async function loadExperience() {
  const mainContent = document.querySelector('.experience-detail-page');
  try {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image-content');
    const closeModalBtn = modal.querySelector('.modal-close');

    const closeModal = () => {
      modal.classList.remove('show-modal');
    };

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('show-modal')) {
        closeModal();
      }
    });

    const params = new URLSearchParams(window.location.search);
    const experienceId = params.get('id') || 'evergreen-internship';

    const mdResponse = await fetch(`data/experience/${experienceId}.md`);
    if (!mdResponse.ok) {
      mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>Experience Not Found</h1><p>The experience ID "${experienceId}" does not exist.</p><a href="/">Return to homepage</a>.</div>`;
      document.title = "Experience Not Found";
      return;
    }

    const mdText = await mdResponse.text();
    const experience = parseMarkdownExperience(mdText, experienceId);

    document.title = experience.pageTitle;
    updateExperienceMeta(experience);
    document.getElementById('experience-name').textContent = experience.experienceName;
    document.getElementById('experience-type').innerHTML = marked.parseInline(experience.experienceType);
    document.getElementById('hero').style.setProperty('--hero-bg-image', `url('${experience.heroImage}')`);
    document.getElementById('experience-overview').textContent = experience.overview;

    const flairsContainer = document.getElementById('experience-flairs');
    flairsContainer.innerHTML = '';
    const renderFlair = (flair) => {
      const name = (flair || '').toString();
      const key = name.toLowerCase().replace(/[^a-z0-9+#]+/g, '').replace(/[0-9]/g, '');

      const map = {
        'unity': {file: 'U_Cube_1C_Black.svg', label: 'U', bg: '#222'},
        'c#': {file: 'Logo_C_sharp.svg'},
        'csharp': {file: 'Logo_C_sharp.svg'},
        'c++': {file: 'ISO_C++_Logo.svg'},
        'cplusplus': {file: 'ISO_C++_Logo.svg'},
        'networking': {file: 'logo-network.svg'},
        'tooling': {file: 'wrench_hammer.svg'},
        'unrealengine': {file: 'unreal-engine.svg'},
        'github': {file: 'logo-github.png'},
        'azuredevops': {file: 'azure-devops.svg'},
        'azure': {file: 'azure-devops.svg'},
      };

      const info = map[key];
      const el = document.createElement('span');
      el.className = 'skill-tag';

      if (info && info.file) {
        const img = document.createElement('img');
        img.src = `/assets/images/logos/${info.file}`;
        img.alt = `${name} logo`;
        img.width = 18;
        img.height = 18;
        img.style.marginRight = '8px';
        el.appendChild(img);
        el.appendChild(document.createTextNode(name));
        return el;
      }

      el.textContent = name;
      return el;
    };

    experience.flairs.forEach(flairText => {
      flairsContainer.appendChild(renderFlair(flairText));
    });

    // Inject action buttons under the flairs
    const actionsContainer = document.getElementById('experience-actions');
    if (actionsContainer) {
      actionsContainer.innerHTML = '';
      let links = experience.links || {};
      const labelMap = {
        github: 'GitHub',
        website: 'Website',
        linkedin: 'LinkedIn',
      };
      Object.entries(links).forEach(([key, href]) => {
        if (!href) return;
        const forbidden = ['readMore', 'detailPageUrl'];
        if (forbidden.includes(key)) return;
        const a = document.createElement('a');
        a.className = 'button button--secondary';
        a.href = href;
        try {
          const urlObj = new URL(href, window.location.origin);
          if (urlObj.hostname !== window.location.hostname) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
        } catch (e) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        a.textContent = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
        actionsContainer.appendChild(a);
      });
    }

    const detailsContainer = document.getElementById('experience-details-container');
    detailsContainer.innerHTML = '';
    const createInfoBox = (title, data, useTable = false) => {
      if (!data) return '';
      let content = '';
      if (Array.isArray(data)) {
        content = `<ul>${data.map(item => `<li>${item}</li>`).join('')}</ul>`;
      } else if (typeof data === 'object' && Object.keys(data).length > 0) {
        if (useTable) {
          const tableRows = Object.entries(data).map(([key, value]) =>
            `<tr><td class="project-info-table__key">${key}</td><td class="project-info-table__value">${value}</td></tr>`
          ).join('');
          content = `<table class="project-info-table"><tbody>${tableRows}</tbody></table>`;
        } else {
          content = `<ul>${Object.entries(data).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}</ul>`;
        }
      } else {
        return '';
      }
      return `<div class="project-info__box"><h3>${title}</h3>${content}</div>`;
    };
    detailsContainer.innerHTML = createInfoBox('Highlights', (experience.highlights && experience.highlights.length ? experience.highlights : [])) + createInfoBox('Experience Info', experience.experienceInfo, true);

    const detailedContainer = document.getElementById('experience-detailed-sections');
    detailedContainer.innerHTML = '';

    const tocItems = [];

    if (experience.detailedSections && experience.detailedSections.length > 0) {
      experience.detailedSections.forEach(section => {
        const sectionId = section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const sectionEl = document.createElement('div');
        sectionEl.className = 'project-detailed-section';
        sectionEl.id = sectionId;
        sectionEl.innerHTML = `<h2>${section.heading}</h2>`;

        tocItems.push({ id: sectionId, title: section.heading, level: 2 });

        if (section.subheadings && Array.isArray(section.subheadings)) {
          section.subheadings.forEach(subheading => {
            const subheadingId = `${sectionId}-${subheading.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

            const subheadingEl = document.createElement('h3');
            subheadingEl.id = subheadingId;
            subheadingEl.textContent = subheading.heading;
            sectionEl.appendChild(subheadingEl);

            tocItems.push({ id: subheadingId, title: subheading.heading, level: 3 });

            const subBodyDiv = document.createElement('div');
            subBodyDiv.innerHTML = processInlineImages(markdownToHtml(subheading.body), experience, experienceId);
            sectionEl.appendChild(subBodyDiv);
          });
        } else {
          if (Array.isArray(section.body)) {
            const listEl = document.createElement('ul');
            section.body.forEach(itemText => { listEl.innerHTML += `<li>${processInlineImages(itemText, experience, experienceId)}</li>`; });
            sectionEl.appendChild(listEl);
          } else {
            const bodyDiv = document.createElement('div');
            bodyDiv.innerHTML = processInlineImages(markdownToHtml(section.body), experience, experienceId);
            sectionEl.appendChild(bodyDiv);
          }
        }

        detailedContainer.appendChild(sectionEl);
      });
    }

    const tocNav = document.getElementById('toc-nav');
    const tocContainer = document.getElementById('table-of-contents');
    if (tocItems.length > 0) {
      tocNav.innerHTML = tocItems.map(item => {
        const indentClass = item.level === 3 ? 'toc-item-sub' : 'toc-item';
        return `<a href="#${item.id}" class="${indentClass}">${item.title}</a>`;
      }).join('');
      tocContainer.style.display = 'block';
    } else {
      tocContainer.style.display = 'none';
    }

    const galleryContainer = document.getElementById('experience-gallery-container');
    galleryContainer.innerHTML = '';
    if (experience.galleryImages && experience.galleryImages.length > 0) {
      galleryContainer.classList.add('new-gallery-layout');

      const galleryHeader = document.createElement('h2');
      galleryHeader.textContent = 'Gallery';
      galleryHeader.className = 'gallery-section-header';
      galleryContainer.appendChild(galleryHeader);

      const galleryGrid = document.createElement('div');
      galleryGrid.className = 'gallery-grid';

      experience.galleryImages.forEach(imageUrl => {
        const linkEl = document.createElement('a');
        linkEl.href = imageUrl;
        const imgEl = document.createElement('img');
        imgEl.src = imageUrl;
        imgEl.alt = `${experience.experienceName} gallery image`;
        linkEl.appendChild(imgEl);
        galleryGrid.appendChild(linkEl);
      });

      galleryContainer.appendChild(galleryGrid);
    }

    if (experience.videoURL) {
      const videoHtml = getVideoEmbed(experience.videoURL);
      if (videoHtml) { document.getElementById('experience-video-container-wrapper').innerHTML = videoHtml; }
    }

    if (typeof Prism !== 'undefined') {
      setTimeout(() => {
        Prism.highlightAllUnder(document.getElementById('experience-detailed-sections'));
        Prism.highlightAllUnder(document.getElementById('experience-details-container'));
      }, 100);
    }

  } catch (error) {
    console.error("Failed to load experience data:", error);
    mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>Error</h1><p>Could not load experience information. Please try again later.</p></div>`;
    document.title = "Error";
  }
}

document.addEventListener('DOMContentLoaded', loadExperience);

function processInlineImages(text, experience, experienceId) {
  if (!text) return text;
  const containsPre = /<pre[\s>]/i.test(text);
  const containsList = /<ul[\s>]|<ol[\s>]/i.test(text);

  text = text.replace(/\{\{image:([^|}]+)(?:\|([^|}]*))?(?:\|([^}]*))?\}\}/g, (match, imagePath, caption, position) => {
    const fullPath = imagePath.startsWith('http://') || imagePath.startsWith('https://')
      ? imagePath
      : imagePath.startsWith('/')
        ? imagePath
        : `/assets/uploads/${imagePath}`;
    const altText = caption || `${experience.experienceName} image`;

    let positionClass = 'inline-image-container';
    let actualCaption = caption;
    let actualPosition = position;

    if (caption && !position) {
      const possiblePosition = caption.toLowerCase().trim();
      if (['inline', 'right', 'left', 'center'].includes(possiblePosition)) {
        actualPosition = possiblePosition;
        actualCaption = null;
      }
    }

    if (actualPosition) {
      const pos = actualPosition.toLowerCase().trim();
      if (pos === 'inline') {
        positionClass += ' inline-image-inline';
      } else if (pos === 'right') {
        positionClass += ' inline-image-right';
      } else if (pos === 'left') {
        positionClass += ' inline-image-left';
      }
    }

    return `<div class="${positionClass}">
              <img src="${fullPath}" alt="${altText}" class="inline-image">
              ${actualCaption ? `<p class="image-caption">${actualCaption}</p>` : ''}
            </div>`;
  });

  text = text.replace(/\{\{gallery:([^|]+)(?:\|([^}]+))?\}\}/g, (match, imageList, caption) => {
    const images = imageList.split(',').map(img => img.trim());
    const galleryId = 'gallery-' + Math.random().toString(36).substr(2, 9);

    let galleryHtml = `<div class="inline-gallery-container">`;
    if (caption) {
      galleryHtml += `<h4 class="gallery-title">${caption}</h4>`;
    }
    galleryHtml += `<div class="inline-gallery" id="${galleryId}">`;

    images.forEach((imagePath, index) => {
      const fullPath = imagePath.startsWith('/') ? imagePath : `/assets/uploads/${imagePath}`;
      const altText = `${experience.experienceName} gallery image ${index + 1}`;
      galleryHtml += `<img src="${fullPath}" alt="${altText}" class="gallery-image">`;
    });

    galleryHtml += `</div></div>`;
    return galleryHtml;
  });

  if (!containsPre && !containsList) {
    text = text.replace(/\n\s*\n/g, '</p><p>');
    text = text.replace(/\n/g, '<br>');

    if (text && !text.trim().startsWith('<p>')) {
      text = `<p>${text}</p>`;
    }
  }

  return text;
}
