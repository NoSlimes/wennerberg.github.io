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

  for (let i = 0; i < mdLines.length; i++) {
    const line = mdLines[i];
    
    // Check for markdown heading (## = section)
    if (line.match(/^##\s+/)) {
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
    } 
    // Check for code block markers
    else if (line.match(/^```\w+-preview:/)) {
      const match = line.match(/^```(\w+)-preview:(.+)$/);
      if (match && currentSection) {
        currentSection.codeLanguage = match[1];
        currentSection.codePreviewFile = match[2].trim();
      }
    }
    else if (line.match(/^```\w+-expanded:/)) {
      const match = line.match(/^```(\w+)-expanded:(.+)$/);
      if (match && currentSection) {
        currentSection.codeLanguage = match[1];
        currentSection.codeExpandedFile = match[2].trim();
      }
    }
    else if (line === '```') {
      // Skip closing backticks
      continue;
    }
    else if (inOverview && line.trim()) {
      // Collect overview text before first ## heading
      overview += (overview ? '\n' : '') + line;
    }
    else if (currentSection) {
      currentBody.push(line);
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

// Convert markdown to HTML
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Code blocks with language (multi-line)
  html = html.replace(/```(\w+)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold text
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic text
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Blockquotes (consecutive lines starting with '>')
  {
    const lines = html.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      if (/^\s*>\s?/.test(lines[i])) {
        const quoteLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        const inner = quoteLines.join('<br>');
        out.push(`<blockquote>${inner}</blockquote>`);
      } else {
        out.push(lines[i]);
        i++;
      }
    }
    html = out.join('\n');
  }
  
  // Bullet lists
  html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/<\/li>\n<li>/g, '</li>\n<li>');
  
  // Line breaks - convert double newlines to paragraphs
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<(ul|ol|pre)/g, '<$1');
  html = html.replace(/<\/(ul|ol|pre)>\s*<\/p>/g, '</$1>');
  html = html.replace(/<p>\s*<blockquote>/g, '<blockquote>');
  html = html.replace(/<\/blockquote>\s*<\/p>/g, '</blockquote>');
  
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

    const response = await fetch('/data/projects.yml'); 
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const yamlText = await response.text();

    const projectsData = jsyaml.load(yamlText);

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    
    // Fetch and parse the markdown file for this project
    const mdResponse = await fetch(`/data/projects/${projectId}.md`);
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
    document.getElementById('project-type').textContent = project.projectType;
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
    const createInfoBox = (title, data) => {
      if (!data) return ''; 
      let listItems = '';
      if (Array.isArray(data)) {
        listItems = data.map(item => `<li>${item}</li>`).join('');
      } else if (typeof data === 'object' && Object.keys(data).length > 0) {
        listItems = Object.entries(data).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('');
      } else {
        return ''; 
      }
      return `<div class="project-info__box"><h3>${title}</h3><ul>${listItems}</ul></div>`;
    };
    detailsContainer.innerHTML = createInfoBox('Project Highlights', (project.highlights && project.highlights.length ? project.highlights : project.contributions)) + createInfoBox('Project Info', project.projectInfo);

    const detailedContainer = document.getElementById('project-detailed-sections');
    detailedContainer.innerHTML = '';
    // Prepare a project-level code container from frontmatter (behaves like videoURL)
    let projectLevelCodeContainer = null;
    if ((project.codePreviewFile && project.codeExpandedFile) || project.codePreviewFile || project.codeExpandedFile) {
      projectLevelCodeContainer = document.createElement('div');
      projectLevelCodeContainer.className = 'code-snippet-container code-snippet-inline-right';

      const detectedLanguage = project.codeLanguage || (project.codeExpandedFile ? getLanguageFromExtension(project.codeExpandedFile) : (project.codePreviewFile ? getLanguageFromExtension(project.codePreviewFile) : 'text'));

      if (project.codePreviewFile && project.codeExpandedFile) {
        Promise.all([
          fetch(project.codePreviewFile).then(r => r.text()),
          fetch(project.codeExpandedFile).then(r => r.text())
        ]).then(([previewCode, expandedCode]) => {
          createExpandableCodeSection(projectLevelCodeContainer, previewCode, expandedCode, detectedLanguage);
        }).catch(error => {
          console.error('Error loading project-level code files:', error);
          projectLevelCodeContainer.innerHTML = '<p>Error loading code files</p>';
        });
      } else {
        // If only one is provided, show single code block
        const singleFile = project.codePreviewFile || project.codeExpandedFile;
        fetch(singleFile).then(r => r.text()).then(code => {
          createSingleCodeBlock(projectLevelCodeContainer, code, detectedLanguage);
        }).catch(error => {
          console.error('Error loading project-level code file:', error);
          projectLevelCodeContainer.innerHTML = '<p>Error loading code file</p>';
        });
      }
    }

    if (project.detailedSections && project.detailedSections.length > 0) {
      let insertedProjectLevelCode = false;
      project.detailedSections.forEach(section => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'project-detailed-section';
        sectionEl.innerHTML = `<h2>${section.heading}</h2>`;
        
        // Handle subheadings structure
        if (section.subheadings && Array.isArray(section.subheadings)) {
          section.subheadings.forEach(subheading => {
            const subheadingEl = document.createElement('h3');
            subheadingEl.textContent = subheading.heading;
            sectionEl.appendChild(subheadingEl);
            
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
        
        // If frontmatter provided code files, insert their code preview into the first section
        if (projectLevelCodeContainer && !insertedProjectLevelCode) {
          sectionEl.appendChild(projectLevelCodeContainer);
          insertedProjectLevelCode = true;
        }

        // Add code snippet if present (preview or single) within this section
        if ((section.codeSnippet && section.codeLanguage) || (section.codePreview && section.codeExpanded) || (section.codePreviewFile && section.codeExpandedFile)) {
          const codeContainer = document.createElement('div');
          // Default to side-placed, smaller code blocks so they don't span full page width.
          // Editors can override this by adding different classes in the project data later.
          codeContainer.className = 'code-snippet-container code-snippet-inline-right';
          
          // Check if we have expandable code (inline or from files)
          if ((section.codePreview && section.codeExpanded) || (section.codePreviewFile && section.codeExpandedFile)) {
            // Handle file-based code
            if (section.codePreviewFile && section.codeExpandedFile) {
              // Auto-detect language from file extension or use specified language
              const detectedLanguage = section.codeLanguage || getLanguageFromExtension(section.codeExpandedFile);
              
              // Load preview and expanded code from files
              Promise.all([
                fetch(section.codePreviewFile).then(r => r.text()),
                fetch(section.codeExpandedFile).then(r => r.text())
              ]).then(([previewCode, expandedCode]) => {
                createExpandableCodeSection(codeContainer, previewCode, expandedCode, detectedLanguage);
              }).catch(error => {
                console.error('Error loading code files:', error);
                codeContainer.innerHTML = '<p>Error loading code files</p>';
              });
            } else {
              // Handle inline code (existing behavior)
              createExpandableCodeSection(codeContainer, section.codePreview, section.codeExpanded, section.codeLanguage || 'javascript');
            }
          } else if (section.codeSnippet) {
            // Handle file-based single code block
            if (section.codeSnippetFile) {
              const detectedLanguage = section.codeLanguage || getLanguageFromExtension(section.codeSnippetFile);
              
              fetch(section.codeSnippetFile).then(r => r.text()).then(code => {
                createSingleCodeBlock(codeContainer, code, detectedLanguage);
              }).catch(error => {
                console.error('Error loading code file:', error);
                codeContainer.innerHTML = '<p>Error loading code file</p>';
              });
            } else {
              // Regular single code block (inline)
              createSingleCodeBlock(codeContainer, section.codeSnippet, section.codeLanguage || 'text');
            }
          }
          
          // Append code container as a direct child of the section (for grid layout)
          // The CSS grid will position it to the right of text content
          sectionEl.appendChild(codeContainer);
        }
        
        detailedContainer.appendChild(sectionEl);
      });
      // If there were no sections to append the project-level code, create a section for it
      if (projectLevelCodeContainer && !insertedProjectLevelCode) {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'project-detailed-section';
        // Keep a minimal heading for context if desired; or omit
        // sectionEl.innerHTML = `<h2>Code Preview</h2>`;
        sectionEl.appendChild(projectLevelCodeContainer);
        detailedContainer.appendChild(sectionEl);
      }
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

        linkEl.addEventListener('click', (event) => {
          event.preventDefault(); 
          modalImage.src = linkEl.href; 
          modal.classList.add('show-modal'); 
        });

        galleryGrid.appendChild(linkEl);
      });
      
      galleryContainer.appendChild(galleryGrid);
    }

    if (project.videoURL) {
      const videoHtml = getVideoEmbed(project.videoURL);
      if (videoHtml) { document.getElementById('video-container-wrapper').innerHTML = videoHtml; }
    }

  } catch (error) {
    console.error("Failed to load project data:", error);
    mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>Error</h1><p>Could not load project information. Please try again later.</p></div>`;
    document.title = "Error";
  }
}

document.addEventListener('DOMContentLoaded', loadProject);

// Code Modal Functionality
function openCodeModal(codeElement, language) {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'code-modal-overlay';
  modalOverlay.id = 'code-modal';
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'code-modal-content';
  
  // Create modal header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'code-modal-header';
  modalHeader.innerHTML = `
    <h3>Full Implementation</h3>
    <button class="code-modal-close" onclick="closeCodeModal()">&times;</button>
  `;
  
  // Create code container for modal
  const modalCodeContainer = document.createElement('div');
  modalCodeContainer.className = 'code-modal-body';
  
  const preEl = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.className = `language-${language}`;
  // Inject copyright header if not present
  codeEl.textContent = injectCopyright(codeElement.textContent, language);
  
  preEl.appendChild(codeEl);
  modalCodeContainer.appendChild(preEl);
  
  // Assemble modal
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalCodeContainer);
  modalOverlay.appendChild(modalContent);
  
  // Add to DOM and show
  document.body.appendChild(modalOverlay);
  
  // Apply syntax highlighting
  setTimeout(() => {
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(codeEl);
    }
    modalOverlay.classList.add('show-modal');
  }, 10);
  
  // Close on overlay click
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      closeCodeModal();
    }
  });
  
  // Close on escape key
  document.addEventListener('keydown', handleEscapeKey);
}

function closeCodeModal() {
  const modal = document.getElementById('code-modal');
  if (modal) {
    modal.classList.remove('show-modal');
    setTimeout(() => {
      document.body.removeChild(modal);
    }, 300);
    document.removeEventListener('keydown', handleEscapeKey);
  }
  
  // Reset all toggle buttons
  const toggleButtons = document.querySelectorAll('.code-toggle-btn');
  toggleButtons.forEach(btn => {
    btn.textContent = 'Show Full Implementation';
    btn.setAttribute('aria-expanded', 'false');
  });
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeCodeModal();
  }
}

function getLanguageFromExtension(filePath) {
  const extensionMap = {
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.java': 'java',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.r': 'r',
    '.sql': 'sql',
    '.html': 'html',
    '.xml': 'xml',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.ps1': 'powershell',
    '.bat': 'batch',
    '.dockerfile': 'dockerfile',
    '.md': 'markdown',
    '.tex': 'latex'
  };
  
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return extensionMap[ext] || 'text';
}

function createExpandableCodeSection(container, previewCode, expandedCode, language) {
  // Create preview version
  const previewBlock = document.createElement('pre');
  const previewElement = document.createElement('code');
  previewElement.className = `language-${language}`;
  // Do not inject copyright into previews
  previewElement.textContent = previewCode;
  previewBlock.appendChild(previewElement);
  
  // Create expanded version (for modal)
  const expandedElement = document.createElement('code');
  expandedElement.className = `language-${language}`;
  // Keep expanded element raw; modal will inject when opened
  expandedElement.textContent = expandedCode;
  
  // Create expand/collapse button
  const toggleButton = document.createElement('button');
  toggleButton.className = 'code-toggle-btn';
  toggleButton.textContent = 'Show Full Implementation';
  toggleButton.setAttribute('aria-expanded', 'false');
  
  // Toggle functionality - open full code in modal
  toggleButton.addEventListener('click', function() {
    const isExpanded = this.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      // Close modal
      closeCodeModal();
    } else {
      // Open modal with full code
      openCodeModal(this.expandedElement, this.codeLanguage);
      this.textContent = 'Close Full View';
      this.setAttribute('aria-expanded', 'true');
    }
  });
  
  container.appendChild(previewBlock);
  container.appendChild(toggleButton);
  
  // Store the expanded element as data for modal use
  toggleButton.expandedElement = expandedElement;
  toggleButton.codeLanguage = language;
  
  // Apply syntax highlighting after DOM insertion
  setTimeout(() => {
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(previewElement);
      Prism.highlightElement(expandedElement);
    }
  }, 100);
}

function createSingleCodeBlock(container, code, language) {
  const preEl = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.className = `language-${language}`;
  // Do not inject copyright into single inline code blocks
  codeEl.textContent = code;
  
  preEl.appendChild(codeEl);
  container.appendChild(preEl);
  
  // Apply syntax highlighting after DOM insertion
  setTimeout(() => {
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(codeEl);
    }
  }, 100);
}

function processInlineImages(text, project, projectId) {
  if (!text) return text;
  
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
              <img src="${fullPath}" alt="${altText}" class="inline-image" onclick="openImageModal('${fullPath}', '${altText}')">
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
      galleryHtml += `<img src="${fullPath}" alt="${altText}" class="gallery-image" onclick="openImageModal('${fullPath}', '${altText}')">`;
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
  
  // Convert line breaks to HTML
  // First, convert double line breaks to paragraph breaks
  text = text.replace(/\n\s*\n/g, '</p><p>');
  // Then convert single line breaks to <br> tags
  text = text.replace(/\n/g, '<br>');
  
  // Wrap in paragraph tags if not already wrapped
  if (text && !text.trim().startsWith('<p>')) {
    text = `<p>${text}</p>`;
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