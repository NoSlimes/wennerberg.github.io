async function injectProjectSummaries() {
    const contentContainer = document.getElementById('content-container');
    if (!contentContainer) {
        console.error('Content container not found!');
        return;
    }

    try {
        const response = await fetch('./projects.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch projects.json: ${response.statusText}`);
        }

        const projects = await response.json();

        // Clear any existing content
        contentContainer.innerHTML = ''; 

        // Loop through each project and build its HTML from your template
        projects.forEach(project => {
            // Create the main container div and add its classes
            const projectDiv = document.createElement('div');
            projectDiv.classList.add('hover_skew', 'summary_container');

            // --- This is the template that matches your HTML structure ---
            // It uses the data from the project object to fill in the blanks.
            const projectHTML = `
              <h2 class="h2">${project.title}</h2>
              <div class="project_summary flex flex_around">

                  <figure class="project-card__figure">
                      <img src="${project.imageSrc}" alt="${project.imageCaption}" class="project-card__image" />
                      <figcaption class="project-card__caption">${project.imageCaption}</figcaption>
                  </figure>

                  <div>
                      <p class="project-card__description">
                          <strong>${project.projectType}</strong>
                          <br><br>
                          ${project.description}
                      </p>

                      <div class="project-links">
                          ${project.links.github ? `<a href="${project.links.github}" target="_blank">View on GitHub</a>` : ''}
                          ${project.links.demo ? `<a href="${project.links.demo}" target="_blank">Play Demo</a>` : ''}
                      </div>
                  </div>
              </div>
            `;
            // --- End of template ---

            projectDiv.innerHTML = projectHTML;
            contentContainer.appendChild(projectDiv);
        });

    } catch (err) {
        console.error('Error loading projects:', err);
        contentContainer.innerHTML = '<p>Sorry, there was an error loading projects.</p>';
    }
}

// Call the function to run it all
injectProjectSummaries();