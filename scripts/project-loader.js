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

    const response = await fetch('/data/projects.yml'); 
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const yamlText = await response.text();

    const projectsData = jsyaml.load(yamlText);

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    const project = projectsData[projectId];

    if (!project) {
        mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>Project Not Found</h1><p>The project ID "${projectId}" does not exist. <a href="/">Return to homepage</a>.</p></div>`;
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
      el.className = 'project-flair';
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
        if (Array.isArray(section.body)) {
          const listEl = document.createElement('ul');
          section.body.forEach(itemText => { listEl.innerHTML += `<li>${itemText}</li>`; });
          sectionEl.appendChild(listEl);
        } else {
          sectionEl.innerHTML += `<p>${section.body}</p>`;
        }
        detailedContainer.appendChild(sectionEl);
      });
    }
  
    const galleryContainer = document.getElementById('project-gallery-container');
    galleryContainer.innerHTML = '';
    if (project.galleryImages && project.galleryImages.length > 0) {
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

        galleryContainer.appendChild(linkEl);
      });
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