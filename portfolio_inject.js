document.addEventListener('DOMContentLoaded', () => {
    const contentContainer = document.getElementById('content-container');
    let projectData = []; // Array will be populated dynamically
  
    let currentlyLoadedProjects = [];
    const maxOpenProjects = 3;
    let projectIndex = 0;
  
    function loadProject(projectId) {
      fetch(`projects/${projectId}.html`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text();
        })
        .then(html => {
          const projectDiv = document.createElement('div');
          projectDiv.classList.add('project');
          projectDiv.dataset.projectId = projectId;
          projectDiv.innerHTML = html;
          contentContainer.appendChild(projectDiv);
          currentlyLoadedProjects.push(projectId);
          checkMaxOpenProjects();
          projectDiv.classList.add('loaded');
        })
        .catch(error => {
          console.error('Error loading project:', error);
          const errorDiv = document.createElement('div');
          errorDiv.classList.add('error');
          errorDiv.innerHTML = `<p>Error loading ${projectId}: ${error.message}</p>`;
          contentContainer.appendChild(errorDiv);
        });
    }
  
    function checkMaxOpenProjects() {
      if (currentlyLoadedProjects.length > maxOpenProjects) {
        const projectIdToRemove = currentlyLoadedProjects.shift();
        const projectToRemove = document.querySelector(`.project[data-project-id="${projectIdToRemove}"]`);
  
        if (projectToRemove) {
          projectToRemove.classList.remove('loaded');
          setTimeout(() => {
            projectToRemove.remove();
          }, 300);
        }
      }
    }
  
    function loadMoreProjects() {
      for (let i = 0; i < maxOpenProjects && projectIndex < projectData.length; i++) {
        loadProject(projectData[projectIndex]);
        projectIndex++;
      }
    }
  
    // Function to fetch the project list from projects.json
    function fetchProjectList() {
      fetch('projects.json') // Or 'projects/projects.json' if you put the JSON in the projects subdir
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          projectData = data; // Populate the projectData array
          loadMoreProjects();  // Load initial projects after fetching the list
        })
        .catch(error => {
          console.error('Error fetching project list:', error);
          contentContainer.innerHTML = `<p>Error fetching project list: ${error.message}</p>`;
        });
    }
  
    // Call fetchProjectList to get the project data and start the loading process
    fetchProjectList();
  
    window.addEventListener('scroll', () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        loadMoreProjects();
      }
    });
  });