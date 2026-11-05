// Project detail page (project.html?id=...). Rendering is shared with experiences
// in detail-page.js; this file only loads the project and picks its labels.

async function loadProject() {
  const mainContent = document.querySelector('.project-detail-page');
  try {
    const projectId = new URLSearchParams(window.location.search).get('id');
    const projectsData = await fetchYaml('/data/projects.yml');
    const summaries = projectsData.summaries || [];
    const summaryEntry = summaries.find(s => s.id === projectId) || null;

    // Locked projects never load their content
    if (summaryEntry && summaryEntry.locked === true) {
      showLockedPage('project');
      return;
    }

    const mdResponse = await fetch(`data/projects/${projectId}.md`);
    if (!mdResponse.ok) {
      showDetailMessage(mainContent, 'Project Not Found',
        `<p>The project ID "${projectId}" does not exist.</p><p>Available projects: ${summaries.map(p => p.id).join(', ')}</p><a href="/">Return to homepage</a>.`);
      document.title = 'Project Not Found';
      return;
    }

    const { frontmatter, overview, sections } = parseDetailMarkdown(await mdResponse.text(), projectId);
    const name = frontmatter.projectName;

    updateDetailMeta({
      name,
      pageTitle: frontmatter.pageTitle,
      overview,
      heroImage: frontmatter.heroImage,
      fallbackDescription: summaryEntry && summaryEntry.description
    });
    document.getElementById('project-name').textContent = name;
    document.getElementById('project-type').innerHTML = marked.parseInline(frontmatter.projectType || '');
    applyHeroMedia({ image: frontmatter.heroImage, videoUrl: frontmatter.heroVideoUrl, title: `${name} trailer` });
    document.getElementById('project-overview').textContent = overview;

    if (summaryEntry && summaryEntry.hidden === true) showPageNotice('hidden', 'project');
    if (summaryEntry && summaryEntry.stub === true) showPageNotice('stub', 'project');

    renderSkillTags(document.getElementById('project-flairs'), frontmatter.flairs);

    // Links from the project file, else the ones on its home page card
    const ownLinks = frontmatter.links || {};
    const links = Object.keys(ownLinks).length ? ownLinks : (summaryEntry && summaryEntry.links) || {};
    renderActionButtons(document.getElementById('project-actions'), links);

    renderInfoBoxes(document.getElementById('project-details-container'), [
      { title: 'Project Highlights', data: Array.isArray(frontmatter.highlights) ? frontmatter.highlights : [] },
      { title: 'Project Info', data: normalizeInfo(frontmatter.projectInfo) || {}, table: true }
    ]);

    renderSections(document.getElementById('project-detailed-sections'), sections, name);
    renderGallery(document.getElementById('project-gallery-container'), frontmatter.galleryImages, name, 'Project Gallery');
    renderVideo(document.getElementById('video-container-wrapper'), frontmatter.videoURL);
  } catch (error) {
    console.error('Failed to load project data:', error);
    showDetailMessage(mainContent, 'Error', '<p>Could not load project information. Please try again later.</p>');
    document.title = 'Error';
  }
}

document.addEventListener('DOMContentLoaded', loadProject);
