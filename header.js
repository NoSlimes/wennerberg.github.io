document.addEventListener('DOMContentLoaded', () => {
    const projectDropdown = document.getElementById('project-dropdown');

    function populateDropdown(projectData, loadProject) {
        projectData.forEach(projectId => {
            const link = document.createElement('a');
            link.href = '#'; // Or `javascript:void(0)`
            link.textContent = projectId;
            link.dataset.project = projectId;

            // Add click listener to the links
            link.addEventListener('click', (event) => {
                event.preventDefault(); // Stop normal link behavior
                const selectedProject = event.target.dataset.project;

                //Call to the global scope
                loadProject(selectedProject);
            });

            projectDropdown.appendChild(link);
        });
    }

    function fetchProjectList(projectData,loadProject) {
        fetch('projects.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                populateDropdown(data,loadProject);  // Populate the dropdown
            })
            .catch(error => {
                console.error('Error fetching project list:', error);
                projectDropdown.innerHTML = `<p>Error fetching project list: ${error.message}</p>`;
            });
    }
    //The global scope and its functions
    window.initializeHeader = {
        fetchProjectList: fetchProjectList
    };
});