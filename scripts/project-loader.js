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
    // Access project data directly from the root level (not under 'projects' key)
    const project = projectsData[projectId];
    
    console.log('Project ID:', projectId);
    console.log('Available projects:', Object.keys(projectsData).filter(key => key !== 'summaries'));
    console.log('Found project:', project);

    if (!project) {
        const availableProjects = Object.keys(projectsData).filter(key => key !== 'summaries');
        console.error('Available projects:', availableProjects);
        mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>Project Not Found</h1><p>The project ID "${projectId}" does not exist.</p><p>Available projects: ${availableProjects.join(', ')}</p><a href="/">Return to homepage</a>.</div>`;
        document.title = "Project Not Found";
        return;
    }

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
    detailsContainer.innerHTML = createInfoBox('My Contributions', project.contributions) + createInfoBox('Project Info', project.projectInfo);

    const detailedContainer = document.getElementById('project-detailed-sections');
    detailedContainer.innerHTML = '';
    if (project.detailedSections && project.detailedSections.length > 0) {
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
            subBodyDiv.innerHTML = processInlineImages(subheading.body, project, projectId);
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
            bodyDiv.innerHTML = processInlineImages(section.body, project, projectId);
            sectionEl.appendChild(bodyDiv);
          }
        }
        
        // Add code snippet if present (preview or single)
        if ((section.codeSnippet && section.codeLanguage) || (section.codePreview && section.codeExpanded) || (section.codePreviewFile && section.codeExpandedFile)) {
          const codeContainer = document.createElement('div');
          codeContainer.className = 'code-snippet-container';
          
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
          
          sectionEl.appendChild(codeContainer);
        }
        
        detailedContainer.appendChild(sectionEl);
      });
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
  codeEl.textContent = codeElement.textContent;
  
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
  previewElement.textContent = previewCode;
  previewBlock.appendChild(previewElement);
  
  // Create expanded version (for modal)
  const expandedElement = document.createElement('code');
  expandedElement.className = `language-${language}`;
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
    const fullPath = imagePath.startsWith('/') ? imagePath : `/assets/projects/${projectId}/${imagePath}`;
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