// Parse YAML frontmatter and markdown content from project markdown files
function parseMarkdownProject(mdText, projectId) {
  // Split frontmatter from content - handle various line endings
  const lines = mdText.split(/\r?\n/);
  
  if (!lines[0].match(/^---\s*$/)) {
    throw new Error(`Invalid markdown format for project ${projectId} - missing opening frontmatter`);
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
    throw new Error(`Invalid markdown format for project ${projectId} - missing closing frontmatter`);
  }

  const frontmatterText = lines.slice(1, frontmatterEndLine).join('\n');
  const markdownContent = lines.slice(frontmatterEndLine + 1).join('\n');

  // Parse YAML frontmatter
  let frontmatter;
  try {
    frontmatter = jsyaml.load(frontmatterText);
  } catch (e) {
    console.error('YAML parse error for project', projectId, ':', e);
    throw new Error(`Failed to parse frontmatter for project ${projectId}: ${e.message}`);
  }

  // Parse markdown into sections
  const sections = [];
  const mdLines = markdownContent.trim().split(/\r?\n/);
  
  let currentSection = null;
  let currentBody = [];
  let overview = '';
  let contributions = [];
  let inOverview = true;
  let inCodeBlock = false;

  for (let i = 0; i < mdLines.length; i++) {
    const line = mdLines[i];
    const isSpecialCodeFence = /^```\w+-(preview|expanded):/.test(line);
    const isRegularFence = line.startsWith('```') && !isSpecialCodeFence;
    
    // Only treat headings when not inside a fenced code block
    if (!inCodeBlock && line.match(/^##\s+/)) {
      inOverview = false;
      
      // Save previous section if exists
      if (currentSection) {
        currentSection.body = currentBody.join('\n').trim();
        sections.push(currentSection);
      }
      
      const heading = line.replace(/^##\s+/, '').trim();
      
      // Special handling for Contributions section - parse as list
      if (heading.toLowerCase() === 'contributions') {
        currentSection = {
          heading: heading,
          body: '',
          codePreviewFile: null,
          codeExpandedFile: null,
          codeLanguage: null,
          isContributions: true
        };
      } else {
        currentSection = {
          heading: heading,
          body: '',
          codePreviewFile: null,
          codeExpandedFile: null,
          codeLanguage: null
        };
      }
      currentBody = [];
      continue;
    } 
    // Handle custom code block markers for preview/expanded files (outside fenced blocks)
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
      // Collect overview text before first ## heading
      overview += (overview ? '\n' : '') + line;
    }

    if (isRegularFence) {
      inCodeBlock = !inCodeBlock;
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.body = currentBody.join('\n').trim();
    
    // If it's the Contributions section, parse bullet points
    if (currentSection.isContributions) {
      contributions = currentSection.body
        .split(/\r?\n/)
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().slice(1).trim());
    } else {
      sections.push(currentSection);
    }
  }

  // Filter out empty sections
  const detailedSections = sections.filter(s => s.body || s.codePreviewFile);

  return {
    pageTitle: frontmatter.pageTitle,
    heroImage: frontmatter.heroImage,
    projectName: frontmatter.projectName,
    projectType: frontmatter.projectType,
    flairs: frontmatter.flairs || [],
    projectInfo: frontmatter.projectInfo || {},
    galleryImages: frontmatter.galleryImages || [],
    videoURL: frontmatter.videoURL || '',
    codeLanguage: frontmatter.codeLanguage,
    codePreviewFile: frontmatter.codePreviewFile,
    codeExpandedFile: frontmatter.codeExpandedFile,
    overview: overview || frontmatter.overview || '',
    highlights: Array.isArray(frontmatter.highlights) ? frontmatter.highlights : (contributions.length > 0 ? contributions : []),
    contributions: contributions.length > 0 ? contributions : [],
    detailedSections: detailedSections,
    links: frontmatter.links || {}
  };
}

// Convert markdown to HTML using marked.js library
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  // Extract code blocks BEFORE marked processes them
  const codeBlocks = [];
  let processedMarkdown = markdown.replace(/```(\w+)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `\n::CODEBLOCK_${codeBlocks.length}::\n`;
    codeBlocks.push({ lang, code });
    return placeholder;
  });
  
  // Process custom image syntax
  processedMarkdown = processedMarkdown.replace(
    /{{image:([^|]+)\|([^|]+)\|([^}]+)}}/g,
    '![$2]($1)'
  );
  
  // Parse markdown
  let html = marked.parse(processedMarkdown);
  
  // Restore code blocks with Prism highlighting
  codeBlocks.forEach((block, i) => {
    let highlighted = block.code;
    
    // Use Prism to highlight if available
    if (typeof Prism !== 'undefined') {
      try {
        const grammar = Prism.languages[block.lang] || Prism.languages.plaintext;
        highlighted = Prism.highlight(block.code, grammar, block.lang);
      } catch (e) {
        // Fallback to plain code if highlighting fails
        highlighted = block.code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
    } else {
      // Escape if Prism not available
      highlighted = block.code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    
    const placeholder = `::CODEBLOCK_${i}::`;
    const codeHtml = `<pre><code class="language-${block.lang}">${highlighted}</code></pre>`;
    // Replace placeholder wrapped by <p> with optional whitespace/newlines
    const paragraphRegex = new RegExp(`<p[^>]*>\\s*${placeholder}\\s*<\/p>`, 'g');
    html = html.replace(paragraphRegex, codeHtml);
    html = html.replace(new RegExp(placeholder, 'g'), codeHtml);
  });
  
  // Add target="_blank" to all external links
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
        embedHtml = `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
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

async function loadProject() {
  const mainContent = document.querySelector('.project-detail-page');
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

    // Close modal with Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('show-modal')) {
        closeModal();
      }
    });

    const response = await fetch('data/projects.yml'); 
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const yamlText = await response.text();

    const projectsData = jsyaml.load(yamlText);

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    
    // Fetch and parse the markdown file for this project
    const mdResponse = await fetch(`data/projects/${projectId}.md`);
    if (!mdResponse.ok) {
      const availableProjects = projectsData.summaries ? projectsData.summaries.map(p => p.id) : [];
      console.error('Available projects:', availableProjects);
      mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>Project Not Found</h1><p>The project ID "${projectId}" does not exist.</p><p>Available projects: ${availableProjects.join(', ')}</p><a href="/">Return to homepage</a>.</div>`;
      document.title = "Project Not Found";
      return;
    }

    const mdText = await mdResponse.text();
    const project = parseMarkdownProject(mdText, projectId);
    
    // Get summary info for links/photos if not in markdown
    const summaryEntry = projectsData.summaries ? projectsData.summaries.find(s => s.id === projectId) : null;
    
    console.log('Project ID:', projectId);
    console.log('Available projects:', projectsData.summaries ? projectsData.summaries.map(p => p.id) : []);
    console.log('Found project:', project);

    document.title = project.pageTitle;
    document.getElementById('project-name').textContent = project.projectName;
    document.getElementById('project-type').innerHTML = marked.parseInline(project.projectType);
    document.getElementById('hero').style.setProperty('--hero-bg-image', `url('${project.heroImage}')`);
    document.getElementById('project-overview').textContent = project.overview;
    
    const flairsContainer = document.getElementById('project-flairs');
    flairsContainer.innerHTML = '';
    project.flairs.forEach(flairText => {
      const el = document.createElement('span');
      el.className = 'skill-tag';
      el.textContent = flairText;
      flairsContainer.appendChild(el);
    });

    // Inject action buttons (GitHub, Demo, Trello, Website, etc.) under the flairs
    const actionsContainer = document.getElementById('project-actions');
    if (actionsContainer) {
      actionsContainer.innerHTML = '';

      // Prefer links defined on the detailed project entry; fall back to summaries if present
      let links = project.links || {};
      if ((!links || Object.keys(links).length === 0) && projectsData.summaries) {
        const summaryEntry = projectsData.summaries.find(s => s.id === projectId);
        if (summaryEntry && summaryEntry.links) links = summaryEntry.links;
      }

      // Mapping of known link keys to button labels
      const labelMap = {
        github: 'GitHub',
        demo: 'Download / Demo',
        trello: 'Trello',
        website: 'Website',
        itch: 'Itch',
        steam: 'Steam',
        playstore: 'Play Store',
        appstore: 'App Store',
        video: 'Video',
        blog: 'Blog',
        docs: 'Docs'
      };

      // Create a button for each non-empty link, excluding keys like 'readMore' or blank values
      Object.entries(links).forEach(([key, href]) => {
        if (!href) return; // skip empty values
        const forbidden = ['readMore', 'detailPageUrl'];
        if (forbidden.includes(key)) return;

        const a = document.createElement('a');
        a.className = 'button button--secondary';
        a.href = href;
        // Open external links in a new tab
        try {
          const urlObj = new URL(href, window.location.origin);
          if (urlObj.hostname !== window.location.hostname) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
        } catch (e) {
          // If parsing fails, still open in new tab to be safe
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }

        a.textContent = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
        actionsContainer.appendChild(a);
      });
    }

    const detailsContainer = document.getElementById('project-details-container');
    detailsContainer.innerHTML = '';
    const createInfoBox = (title, data, useTable = false) => {
      if (!data) return ''; 
      let content = '';
      if (Array.isArray(data)) {
        content = `<ul>${data.map(item => `<li>${item}</li>`).join('')}</ul>`;
      } else if (typeof data === 'object' && Object.keys(data).length > 0) {
        if (useTable) {
          // Render as a table for better mobile/desktop compatibility
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
    detailsContainer.innerHTML = createInfoBox('Project Highlights', (project.highlights && project.highlights.length ? project.highlights : project.contributions)) + createInfoBox('Project Info', project.projectInfo, true);

    const detailedContainer = document.getElementById('project-detailed-sections');
    detailedContainer.innerHTML = '';

    // Array to store TOC items
    const tocItems = [];

    if (project.detailedSections && project.detailedSections.length > 0) {
      project.detailedSections.forEach(section => {
        // Create slug from heading for ID
        const sectionId = section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const sectionEl = document.createElement('div');
        sectionEl.className = 'project-detailed-section';
        sectionEl.id = sectionId;
        sectionEl.innerHTML = `<h2>${section.heading}</h2>`;
        
        // Add to TOC
        tocItems.push({ id: sectionId, title: section.heading, level: 2 });
        
        // Handle subheadings structure
        if (section.subheadings && Array.isArray(section.subheadings)) {
          section.subheadings.forEach(subheading => {
            const subheadingId = `${sectionId}-${subheading.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
            
            const subheadingEl = document.createElement('h3');
            subheadingEl.id = subheadingId;
            subheadingEl.textContent = subheading.heading;
            sectionEl.appendChild(subheadingEl);
            
            // Add to TOC
            tocItems.push({ id: subheadingId, title: subheading.heading, level: 3 });
            
            const subBodyDiv = document.createElement('div');
            subBodyDiv.innerHTML = processInlineImages(markdownToHtml(subheading.body), project, projectId);
            sectionEl.appendChild(subBodyDiv);
          });
        } else {
          // Handle regular body content (existing behavior)
          if (Array.isArray(section.body)) {
            const listEl = document.createElement('ul');
            section.body.forEach(itemText => { listEl.innerHTML += `<li>${processInlineImages(itemText, project, projectId)}</li>`; });
            sectionEl.appendChild(listEl);
          } else {
            const bodyDiv = document.createElement('div');
            bodyDiv.innerHTML = processInlineImages(markdownToHtml(section.body), project, projectId);
            sectionEl.appendChild(bodyDiv);
          }
        }
        
        detailedContainer.appendChild(sectionEl);
      });
    }

    // Generate Table of Contents
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

    // Add testimonials section if present
    if (project.testimonials && project.testimonials.length > 0) {
      const testimonialsSection = document.createElement('div');
      testimonialsSection.className = 'project-detailed-section testimonials-section';
      testimonialsSection.innerHTML = '<h2>Instructor Feedback</h2>';
      
      const testimonialsContainer = document.createElement('div');
      testimonialsContainer.className = 'project-testimonials-grid';
      
      project.testimonials.forEach(testimonial => {
        const testimonialCard = document.createElement('div');
        testimonialCard.className = 'project-testimonial-card';
        testimonialCard.innerHTML = `
          <div class="testimonial-content">
            <p>"${testimonial.quote}"</p>
          </div>
          <div class="testimonial-author">
            <div class="author-info">
              <h4>${testimonial.author}</h4>
              <span>${testimonial.role}</span>
            </div>
          </div>
        `;
        testimonialsContainer.appendChild(testimonialCard);
      });
      
      testimonialsSection.appendChild(testimonialsContainer);
      detailedContainer.appendChild(testimonialsSection);
    }
  
    const galleryContainer = document.getElementById('project-gallery-container');
    galleryContainer.innerHTML = '';
    if (project.galleryImages && project.galleryImages.length > 0) {
      // Add class to override old gallery layout
      galleryContainer.classList.add('new-gallery-layout');
      
      // Add gallery header
      const galleryHeader = document.createElement('h2');
      galleryHeader.textContent = 'Project Gallery';
      galleryHeader.className = 'gallery-section-header';
      galleryContainer.appendChild(galleryHeader);
      
      // Create a separate container for the gallery grid
      const galleryGrid = document.createElement('div');
      galleryGrid.className = 'gallery-grid';
      
      project.galleryImages.forEach(imageUrl => {
        const linkEl = document.createElement('a');
        linkEl.href = imageUrl;
        const imgEl = document.createElement('img');
        imgEl.src = imageUrl;
        imgEl.alt = `${project.projectName} gallery image`;
        linkEl.appendChild(imgEl);

        galleryGrid.appendChild(linkEl);
      });
      
      galleryContainer.appendChild(galleryGrid);
    }

    if (project.videoURL) {
      const videoHtml = getVideoEmbed(project.videoURL);
      if (videoHtml) { document.getElementById('video-container-wrapper').innerHTML = videoHtml; }
    }

    // Highlight all code blocks with Prism after content is loaded
    if (typeof Prism !== 'undefined') {
      setTimeout(() => {
        Prism.highlightAllUnder(document.getElementById('project-detailed-sections'));
        Prism.highlightAllUnder(document.getElementById('project-details-container'));
      }, 100);
    }

  } catch (error) {
    console.error("Failed to load project data:", error);
    mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>Error</h1><p>Could not load project information. Please try again later.</p></div>`;
    document.title = "Error";
  }
}

document.addEventListener('DOMContentLoaded', loadProject);

function processInlineImages(text, project, projectId) {
  if (!text) return text;
  const containsPre = /<pre[\s>]/i.test(text);
  const containsList = /<ul[\s>]|<ol[\s>]/i.test(text);
  
  // Process single images: {{image:path/to/image.jpg|Caption text|position}}
  text = text.replace(/\{\{image:([^|}]+)(?:\|([^|}]*))?(?:\|([^}]*))?\}\}/g, (match, imagePath, caption, position) => {
    // Check if it's a full URL (http:// or https://)
    const fullPath = imagePath.startsWith('http://') || imagePath.startsWith('https://') 
      ? imagePath 
      : imagePath.startsWith('/') 
        ? imagePath 
        : `/assets/projects/${projectId}/${imagePath}`;
    const altText = caption || `${project.projectName} image`;
    
    // Determine positioning class - check if caption is actually a position keyword
    let positionClass = 'inline-image-container';
    let actualCaption = caption;
    let actualPosition = position;
    
    // Handle case where position is in caption field (backward compatibility)
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
      // Default (center) doesn't need additional class
    }
    
    return `<div class="${positionClass}">
              <img src="${fullPath}" alt="${altText}" class="inline-image">
              ${actualCaption ? `<p class="image-caption">${actualCaption}</p>` : ''}
            </div>`;
  });
  
  // Process image galleries: {{gallery:image1.jpg,image2.jpg,image3.jpg|Gallery caption}}
  text = text.replace(/\{\{gallery:([^|]+)(?:\|([^}]+))?\}\}/g, (match, imageList, caption) => {
    const images = imageList.split(',').map(img => img.trim());
    const galleryId = 'gallery-' + Math.random().toString(36).substr(2, 9);
    
    let galleryHtml = `<div class="inline-gallery-container">`;
    if (caption) {
      galleryHtml += `<h4 class="gallery-title">${caption}</h4>`;
    }
    galleryHtml += `<div class="inline-gallery" id="${galleryId}">`;
    
    images.forEach((imagePath, index) => {
      const fullPath = imagePath.startsWith('/') ? imagePath : `/assets/projects/${projectId}/${imagePath}`;
      const altText = `${project.projectName} gallery image ${index + 1}`;
      galleryHtml += `<img src="${fullPath}" alt="${altText}" class="gallery-image">`;
    });
    
    galleryHtml += `</div></div>`;
    return galleryHtml;
  });
  
  // Process video embeds: {{video:path/to/video.mp4|Caption}}
  text = text.replace(/\{\{video:([^|]+)(?:\|([^}]+))?\}\}/g, (match, videoPath, caption) => {
    const fullPath = videoPath.startsWith('/') ? videoPath : `/assets/projects/${projectId}/${videoPath}`;
    return `<div class="inline-video-container">
              <video controls class="inline-video">
                <source src="${fullPath}" type="video/mp4">
                Your browser does not support the video tag.
              </video>
              ${caption ? `<p class="video-caption">${caption}</p>` : ''}
            </div>`;
  });
  
  // If the HTML already includes <pre> or <ul>/<ol>, avoid messing with whitespace/paragraphs
  if (!containsPre && !containsList) {
    // Convert line breaks to HTML
    // First, convert double line breaks to paragraph breaks
    text = text.replace(/\n\s*\n/g, '</p><p>');
    // Then convert single line breaks to <br> tags
    text = text.replace(/\n/g, '<br>');
    
    // Wrap in paragraph tags if not already wrapped
    if (text && !text.trim().startsWith('<p>')) {
      text = `<p>${text}</p>`;
    }
  }
  
  return text;
}

function openImageModal(imageSrc, altText) {
  const modal = document.querySelector('.modal-overlay');
  const modalImage = document.querySelector('.modal-content img');
  
  if (modal && modalImage) {
    modalImage.src = imageSrc;
    modalImage.alt = altText;
    modal.classList.add('show-modal');
  }
}

// Copyright injection helper
function _normalizeLang(lang) {
  if (!lang) return 'text';
  return lang.toString().toLowerCase().replace(/^language-/,'');
}

function shouldInjectCopyright(code) {
  if (!code) return true;
  return !/copyright|\u00A9|all rights reserved/i.test(code);
}

function buildCopyrightBlock(language) {
  const year = new Date().getFullYear();
  const author = 'Elias Wennerberg';
  const lang = _normalizeLang(language);

  // Languages using single-line comments
  const singleLine = new Set(['javascript','js','typescript','ts','java','csharp','cs','cpp','c','php','go','rust','swift','kotlin','scala','sql','powershell','ps1','bash','sh','zsh','ruby']);
  const hashLine = new Set(['python','py','yaml','yml','r']);
  const htmlLine = new Set(['html','xml','markdown','md']);

  if (singleLine.has(lang)) {
    return `// Copyright (c) ${year} ${author}\n// All rights reserved.\n\n`;
  }

  if (hashLine.has(lang)) {
    return `# Copyright (c) ${year} ${author}\n# All rights reserved.\n\n`;
  }

  if (htmlLine.has(lang)) {
    return `<!-- Copyright (c) ${year} ${author} -->\n<!-- All rights reserved. -->\n\n`;
  }

  // Fallback to block comment
  return `/*\n * Copyright (c) ${year} ${author}\n * All rights reserved.\n */\n\n`;
}

function injectCopyright(code, language) {
  try {
    if (!shouldInjectCopyright(code)) return code;
    // If a repository-level copyright text was loaded, use that as the notice.
    const repoNotice = window.__REPO_COPYRIGHT_TEXT || null;
    if (repoNotice) {
      // Wrap the raw text with language-appropriate comment markers
      const lang = _normalizeLang(language);
      let wrapped = repoNotice;
      const singleLine = new Set(['javascript','js','typescript','ts','java','csharp','cs','cpp','c','php','go','rust','swift','kotlin','scala','sql','powershell','ps1','bash','sh','zsh','ruby']);
      const hashLine = new Set(['python','py','yaml','yml','r']);
      const htmlLine = new Set(['html','xml','markdown','md']);

      if (singleLine.has(lang)) {
        wrapped = repoNotice.split('\n').map(l => `// ${l}`).join('\n') + '\n\n';
      } else if (hashLine.has(lang)) {
        wrapped = repoNotice.split('\n').map(l => `# ${l}`).join('\n') + '\n\n';
      } else if (htmlLine.has(lang)) {
        wrapped = '<!--\n' + repoNotice.split('\n').join('\n') + '\n-->\n\n';
      } else {
        wrapped = '/*\n' + repoNotice.split('\n').map(l => ` * ${l}`).join('\n') + '\n */\n\n';
      }
      return wrapped + code;
    }

    // Fallback to built-in small header if repo notice isn't available
    if (!shouldInjectCopyright(code)) return code;
    const header = buildCopyrightBlock(language);
    return header + code;
  } catch (err) {
    return code;
  }
}

// Load repository copyright text (raw) and cache it on window for other scripts
document.addEventListener('DOMContentLoaded', () => {
  fetch('/copyright_modal.txt').then(r => {
    if (r.ok) return r.text();
    throw new Error('Not found');
  }).then(text => {
    // Trim any trailing YAML-like markers or leading/trailing whitespace
    window.__REPO_COPYRIGHT_TEXT = text.trim();
  }).catch(() => {
    window.__REPO_COPYRIGHT_TEXT = null;
  });
});