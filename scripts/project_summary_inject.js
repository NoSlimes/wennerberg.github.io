async function injectProjectSummaries() {
    const contentContainer = document.getElementById('project-card-container');
    if (!contentContainer) {
        console.error('Content container not found!');
        return;
    }

    try {
        const response = await fetch('/data/projects.yml');
        if (!response.ok) {
            throw new Error(`Failed to fetch projects.yml: ${response.statusText}`);
        }

        const yamlText = await response.text();
        const projectsData = jsyaml.load(yamlText);
        let projects = projectsData.summaries || [];

        // If any project has `highlighted: true`, move the first one to the start
        const highlightedIndex = projects.findIndex(p => p.highlighted === true);
        if (highlightedIndex > 0) {
            const [highlighted] = projects.splice(highlightedIndex, 1);
            projects.unshift(highlighted);
        }

        contentContainer.innerHTML = '';

        projects.forEach(project => {
            const projectDiv = document.createElement('div');
            projectDiv.classList.add('summary_container', 'clickable-card');
            if (project.highlighted) projectDiv.classList.add('highlighted');

            const flairsHTML = project.flairs
                .map(flair => `<span class="project-flair">${flair}</span>`)
                .join(' ');

            // Render project with a background image div; content sits on top
            // Render the project title as an absolutely positioned element so it appears
            // outside the content panel in the top-left corner of the card
            const projectHTML = `
            <div class="project_summary">
            <div class="card-bg" style="background-image: url('${project.imageSrc}');" aria-hidden="true"></div>

            <div class="project-card-content">
            <p class="project-card__title"><strong>${project.title}</strong></p>

            <div class="project-flairs" style="margin: 8px 0;">${flairsHTML}</div>

            <p class="project-card__description">${project.description}</p>

            <div class="project-links" style="margin-top: 20px;">
                <a href="${project.detailPageUrl}" class="button">Read More</a>
                ${project.links.github ? `<a href="${project.links.github}" class="button button--secondary" target="_blank" rel="noopener noreferrer">GitHub</a>` : ''}
                ${project.links.trello ? `<a href="${project.links.trello}" class="button button--secondary" target="_blank" rel="noopener noreferrer">Trello</a>` : ''}
                ${project.links.demo ? `<a href="${project.links.demo}" class="button button--secondary">Download Game</a>` : ''}
            </div>
            </div>
        </div>
        <h2 class="project-card-title">${project.projectType}</h2>
    `;
            projectDiv.innerHTML = projectHTML;

            projectDiv.addEventListener('click', (e) => {
                const isButtonOrLink = e.target.closest('a, button');
                if (!isButtonOrLink) {
                    window.location.href = project.detailPageUrl;
                }
            });

            contentContainer.appendChild(projectDiv);
        });

    } catch (err) {
        console.error('Error loading projects:', err);
        contentContainer.innerHTML = '<p>Sorry, there was an error loading projects.</p>';
    }
}

injectProjectSummaries();
