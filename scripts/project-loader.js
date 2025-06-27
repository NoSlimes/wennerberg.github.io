/**
 * Takes a standard video URL and returns the appropriate embed HTML.
 * Supports YouTube, Vimeo, and direct .mp4 links.
 * @param {string} url The full URL of the video.
 * @returns {string|null} The HTML string for the embed, or null if unsupported.
 */
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
  } catch (error) {
    console.error("Could not parse video URL:", url, error);
    return null;
  }
  return embedHtml;
}

async function loadProject() {
  const mainContent = document.querySelector('.project-detail-page');
  
  try {
    const response = await fetch('/data/projects.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const projectsData = await response.json();

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    const project = projectsData[projectId];

    if (!project) {
      mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;">
                                <h1>Project Not Found</h1>
                                <p>The project ID "${projectId}" does not exist. <a href="/">Return to homepage</a>.</p>
                               </div>`;
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
      const flairElement = document.createElement('span');
      flairElement.className = 'project-flair';
      flairElement.textContent = flairText;
      flairsContainer.appendChild(flairElement);
    });

    const detailsContainer = document.getElementById('project-details-container');
    detailsContainer.innerHTML = '';
    const createInfoBox = (title, dataObject) => {
      if (!dataObject || Object.keys(dataObject).length === 0) return '';
      let listItems = '';
      for (const [key, value] of Object.entries(dataObject)) {
        listItems += `<li><strong>${key}:</strong> ${value}</li>`;
      }
      return `<div class="project-info__box"><h3>${title}</h3><ul>${listItems}</ul></div>`;
    };
    detailsContainer.innerHTML = createInfoBox('Team Info', project.teamInfo) + createInfoBox('Tech Stack', project.techStack);

    const contributionsList = document.getElementById('project-contributions');
    contributionsList.innerHTML = '';
    project.contributions.forEach(itemText => {
      const listItem = document.createElement('li');
      listItem.textContent = itemText;
      contributionsList.appendChild(listItem);
    });
    
    const galleryContainer = document.getElementById('project-gallery-container');
    galleryContainer.innerHTML = '';
    if (project.galleryImages && project.galleryImages.length > 0) {
      project.galleryImages.forEach(imageUrl => {
        const imgElement = document.createElement('img');
        imgElement.src = imageUrl;
        imgElement.alt = `${project.projectName} gallery image`;
        const linkElement = document.createElement('a');
        linkElement.href = imageUrl;
        linkElement.target = '_blank';
        linkElement.rel = 'noopener noreferrer';
        linkElement.appendChild(imgElement);
        galleryContainer.appendChild(linkElement);
      });
    }

    // Inject Video
    if (project.videoURL) {
      const videoHtml = getVideoEmbed(project.videoURL);
      if (videoHtml) {
        document.getElementById('video-container-wrapper').innerHTML = videoHtml;
      }
    }

  } catch (error) {
    console.error("Failed to load project data:", error);
    mainContent.innerHTML = `<div class="wrapper" style="text-align: center; padding: 4rem 0;"><h1>Error</h1><p>Could not load project information. Please try again later.</p></div>`;
    document.title = "Error";
  }
}

document.addEventListener('DOMContentLoaded', loadProject);