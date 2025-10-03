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
        const projects = projectsData.summaries;

        contentContainer.innerHTML = '';

        projects.forEach(project => {
            const projectDiv = document.createElement('div');
            projectDiv.classList.add('summary_container', 'clickable-card');

            const flairsHTML = project.flairs
                .map(flair => `<span class="project-flair">${flair}</span>`)
                .join(' ');

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
</p>

<div class="project-flairs" style="margin: 4px 0;">
  ${flairsHTML}
</div>

<p class="project-card__description">
  ${project.description}
</p>
            <div class="project-links" style="margin-top: 20px;">
                <a href="${project.detailPageUrl}" class="button">Read More</a>
                ${project.links.github ? `<a href="${project.links.github}" class="button button--secondary" target="_blank" rel="noopener noreferrer">GitHub</a>` : ''}
                ${project.links.trello ? `<a href="${project.links.trello}" class="button button--secondary" target="_blank" rel="noopener noreferrer">Trello</a>` : ''}
                ${project.links.demo ? `<a href="${project.links.demo}" class="button button--secondary">Download Game</a>` : ''}
            </div>
        </div>
    </div>
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
