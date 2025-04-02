

// Function to fetch and inject project summaries
async function injectProjectSummaries() {
    const contentContainer = document.getElementById('content-container');
    if (!contentContainer) {
        console.error('Content container not found!');
        return;
    }

    try {
        // Fetch the projects.json file
        const response = await fetch('./projects.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch projects.json: ${response.statusText}`);
        }

        const projects = await response.json();

        // Loop through each project and fetch its summary
        for (const project of projects) {
            const projectPath = `./projects/summaries/${project}.html`;

            try {
                const projectResponse = await fetch(projectPath);
                if (!projectResponse.ok) {
                    console.warn(`Failed to fetch ${projectPath}: ${projectResponse.statusText}`);
                    continue;
                }

                const projectContent = await projectResponse.text();

                // Create a container for the project and append it to the content container
                const projectDiv = document.createElement('div');
                projectDiv.classList.add('project-summary');
                projectDiv.innerHTML = projectContent;
                contentContainer.appendChild(projectDiv);
            } catch (err) {
                console.error(`Error fetching project summary for ${project}:`, err);
            }
        }
    } catch (err) {
        console.error('Error loading projects:', err);
    }
}

// Call the function to inject project summaries
injectProjectSummaries();