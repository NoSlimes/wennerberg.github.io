// Experience detail page (experience.html?id=...). Rendering is shared with projects
// in detail-page.js; this file only loads the experience and picks its labels.

async function loadExperience() {
  const mainContent = document.querySelector('.experience-detail-page');
  try {
    // No ?id: open the first experience in sidebar order instead of a hardcoded one
    let experienceId = new URLSearchParams(window.location.search).get('id');
    if (!experienceId) {
      const index = await fetchYaml('/data/experiences.yml');
      const first = (index.experiences || []).find(e => e.hidden !== true && e.locked !== true);
      if (!first) {
        showDetailMessage(mainContent, 'No Experience Yet', '<p>Nothing to show here right now.</p><a href="/">Return to homepage</a>.');
        document.title = 'Experience | Elias Wennerberg';
        return;
      }
      experienceId = first.id;
      history.replaceState(null, '', `?id=${encodeURIComponent(experienceId)}`);
    }

    const mdResponse = await fetch(`data/experience/${experienceId}.md`);
    if (!mdResponse.ok) {
      showDetailMessage(mainContent, 'Experience Not Found',
        `<p>The experience ID "${experienceId}" does not exist.</p><a href="/">Return to homepage</a>.`);
      document.title = 'Experience Not Found';
      return;
    }

    const { frontmatter, overview, sections } = parseDetailMarkdown(await mdResponse.text(), experienceId);

    // The locked flag lives in the experience file itself
    if (frontmatter.locked === true) {
      showLockedPage('experience');
      return;
    }

    const name = frontmatter.experienceName;

    updateDetailMeta({ name, pageTitle: frontmatter.pageTitle, overview, heroImage: frontmatter.heroImage });
    document.getElementById('experience-name').textContent = name;
    document.getElementById('experience-type').innerHTML = marked.parseInline(frontmatter.experienceType || '');
    applyHeroMedia({ image: frontmatter.heroImage, videoUrl: frontmatter.heroVideoUrl, title: `${name} video` });
    document.getElementById('experience-overview').textContent = overview;

    if (frontmatter.hidden === true) showPageNotice('hidden', 'experience');
    if (frontmatter.stub === true) showPageNotice('stub', 'experience');

    renderSkillTags(document.getElementById('experience-flairs'), frontmatter.flairs);
    renderActionButtons(document.getElementById('experience-actions'), frontmatter.links);

    renderInfoBoxes(document.getElementById('experience-details-container'), [
      { title: 'Highlights', data: Array.isArray(frontmatter.highlights) ? frontmatter.highlights : [] },
      { title: 'Experience Info', data: normalizeInfo(frontmatter.experienceInfo) || {}, table: true }
    ]);

    renderSections(document.getElementById('experience-detailed-sections'), sections, name);
    renderGallery(document.getElementById('experience-gallery-container'), frontmatter.galleryImages, name, 'Gallery');
    renderVideo(document.getElementById('experience-video-container-wrapper'), frontmatter.videoURL);
  } catch (error) {
    console.error('Failed to load experience data:', error);
    showDetailMessage(mainContent, 'Error', '<p>Could not load experience information. Please try again later.</p>');
    document.title = 'Error';
  }
}

document.addEventListener('DOMContentLoaded', loadExperience);
