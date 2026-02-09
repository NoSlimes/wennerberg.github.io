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

        // Filter out hidden projects
        projects = projects.filter(p => p.hidden !== true);

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

            // Render flairs as circular icons when possible (fallback to text)
            function renderFlair(flair) {
                const name = (flair || '').toString();
                // normalize key: lowercase, remove non-alphanumerics except + and #, strip digits
                const key = name.toLowerCase().replace(/[^a-z0-9+#]+/g, '').replace(/[0-9]/g, '');

                // mapping of known flairs to logo files (in /assets/images/logos/) or fallback label/bg
                const map = {
                    'unity': {file: 'U_Cube_1C_Black.svg', label: 'U', bg: '#222'},
                    'c#': {file: 'Logo_C_sharp.svg'},
                    'csharp': {file: 'Logo_C_sharp.svg'},
                    'c++': {file: 'ISO_C++_Logo.svg'},
                    'cplusplus': {file: 'ISO_C++_Logo.svg'},
                    'tooling': {file: 'wrench_hammer.svg'},
                    'unrealengine': {file: 'unreal-engine.svg'},
                    'github': {file: 'logo-github.png'},
                    'linkedin': {file: 'logo-linkedin.png'},
                    'futuregames': {file: 'fg_logo.png', label: 'FG', bg: '#ff6b6b'}
                };

                const info = map[key];
                if (info && info.file) {
                    const src = `/assets/images/logos/${info.file}`;
                    return `<span class="project-flair project-flair--icon project-flair--logo" title="${name}"><img src="${src}" alt="${name} logo" loading="lazy"/></span>`;
                }

                if (info && info.label) {
                    const bg = info.bg || '#333';
                    const fg = info.fg || '#fff';
                    return `<span class="project-flair project-flair--icon" title="${name}" style="background:${bg};color:${fg};">${info.label}</span>`;
                }

                // fallback: use first two chars
                const initials = name.split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();
                return `<span class="project-flair project-flair--icon" title="${name}">${initials}</span>`;
            }

            const flairsHTML = (project.flairs || []).map(renderFlair).join(' ');

            // small toolbar with icon buttons (top-right)
            function renderToolbar(links) {
                const parts = [];
                if (links.github) parts.push(`<a class="tool-btn" href="${links.github}" target="_blank" rel="noopener noreferrer" aria-label="GitHub">${svgIcon('github')}</a>`);
                if (links.demo) parts.push(`<a class="tool-btn" href="${links.demo}" target="_blank" rel="noopener noreferrer" aria-label="Demo">${svgIcon('external')}</a>`);
                if (links.trello) parts.push(`<a class="tool-btn" href="${links.trello}" target="_blank" rel="noopener noreferrer" aria-label="Trello">${svgIcon('link')}</a>`);
                return `<div class="project-toolbar">${parts.join('')}</div>`;
            }

            function svgIcon(name) {
                if (name === 'github') return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.75 5.48.75 11.78c0 4.93 3.19 9.1 7.61 10.57.56.1.76-.24.76-.54 0-.27-.01-1-.02-1.95-3.09.67-3.74-1.49-3.74-1.49-.5-1.27-1.22-1.61-1.22-1.61-.99-.68.08-.67.08-.67 1.09.08 1.66 1.12 1.66 1.12.97 1.66 2.55 1.18 3.17.9.1-.7.38-1.18.69-1.45-2.47-.28-5.06-1.24-5.06-5.52 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.41.11-2.94 0 0 .95-.3 3.12 1.15a10.8 10.8 0 0 1 2.84-.38c.96 0 1.93.13 2.84.38 2.17-1.45 3.12-1.15 3.12-1.15.61 1.53.23 2.66.11 2.94.72.78 1.16 1.78 1.16 3 0 4.29-2.6 5.24-5.08 5.52.39.34.73 1.02.73 2.06 0 1.49-.01 2.69-.01 3.06 0 .3.2.65.77.54A11.29 11.29 0 0 0 23.25 11.8C23.25 5.48 18.27.5 12 .5z"></path></svg>`;
                if (name === 'external') return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
                return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
            }

            function parseYouTubeStart(raw) {
                if (!raw) return 0;
                if (/^\d+$/.test(raw)) return Number(raw);

                const match = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
                if (!match) return 0;
                const hours = Number(match[1] || 0);
                const minutes = Number(match[2] || 0);
                const seconds = Number(match[3] || 0);
                return (hours * 3600) + (minutes * 60) + seconds;
            }

            function getYouTubeEmbedUrl(url) {
                if (!url) return '';
                let videoId = '';
                let start = 0;

                try {
                    const urlObj = new URL(url);
                    const host = urlObj.hostname.toLowerCase();

                    if (host.includes('youtu.be')) {
                        videoId = urlObj.pathname.replace(/^\//, '');
                    } else if (host.includes('youtube.com')) {
                        if (urlObj.pathname.startsWith('/watch')) {
                            videoId = urlObj.searchParams.get('v') || '';
                        } else if (urlObj.pathname.startsWith('/embed/')) {
                            videoId = urlObj.pathname.split('/').pop() || '';
                        }
                    }

                    const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
                    start = parseYouTubeStart(tParam);
                } catch (e) {
                    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{6,})/);
                    if (!match) return '';
                    videoId = match[1];
                }

                if (!videoId) return '';
                const startParam = start > 0 ? `&start=${start}` : '';
                return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&rel=0&playsinline=1&playlist=${videoId}${startParam}`;
            }

            const trailerEmbed = getYouTubeEmbedUrl(project.cardVideoUrl);
            const mediaHtml = trailerEmbed
                ? `<div class="card-bg card-media" aria-hidden="true"><iframe src="${trailerEmbed}" title="${project.title} preview" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`
                : `<div class="card-bg" style="background-image: url('${project.imageSrc}');" aria-hidden="true"></div>`;

            // Render project with a background image div; content sits on top
            const projectHTML = `
            <div class="project_summary">
            ${mediaHtml}

            ${renderToolbar(project.links || {})}

                        <div class="project-card-content">
                        <p class="project-card__title"><strong>${project.title}</strong>${project.duration ? `<span class="project-card__duration">${project.duration}</span>` : ''}</p>

                        <div class="project-meta" style="margin: 6px 0 0 0; display:flex; gap:8px; align-items:center;">
                            <div class="project-flairs">${flairsHTML}</div>
                        </div>

            <p class="project-card__description">${project.description}</p>

            <div class="project-links" style="margin-top: 12px;">
                ${project.links.trello ? `<a href="${project.links.trello}" class="button button--secondary" target="_blank" rel="noopener noreferrer">Trello</a>` : ''}
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
