async function loadHeaderFooter() {
  try {
    const headerResponse = await fetch('/header.html');
    const footerResponse = await fetch('/footer.html');

    if (!headerResponse.ok || !footerResponse.ok) {
      throw new Error(`Failed to fetch header or footer: ${headerResponse.status} ${footerResponse.status}`);
    }

    const headerHtml = await headerResponse.text();
    const footerHtml = await footerResponse.text();

    document.getElementById('header-container').innerHTML = headerHtml;
    document.getElementById('footer-container').innerHTML = footerHtml;

    ensureBodyTextures();
    setupParallaxTextures();

    // Now that header is loaded, set up the menu toggle
    setupMenuToggle();

    populateSidebarNav();

  } catch (error) {
    console.error("Error loading header/footer:", error);
  }
}

// Logo per tag ("flair"), shared by the home cards and the project/experience heroes.
// Keys are the tag lowercased with spaces, punctuation (except + and #) and digits
// removed, so "Unity 6" and "Unity" both match "unity".
const FLAIR_ICONS = {
  'unity': 'U_Cube_1C_Black.svg',
  'c#': 'Logo_C_sharp.svg',
  'csharp': 'Logo_C_sharp.svg',
  'c++': 'ISO_C++_Logo.svg',
  'cplusplus': 'ISO_C++_Logo.svg',
  'networking': 'logo-network.svg',
  'networkingngo': 'logo-network.svg',
  'tooling': 'wrench_hammer.svg',
  'unrealengine': 'unreal-engine.svg',
  'github': 'logo-github.png',
  'linkedin': 'logo-linkedin.png',
  'azure': 'azure-devops.svg',
  'azuredevops': 'azure-devops.svg',
  'futuregames': 'fg_logo.png'
};

function flairIconFile(name) {
  const key = (name || '').toString().toLowerCase().replace(/[^a-z0-9+#]+/g, '').replace(/[0-9]/g, '');
  return FLAIR_ICONS[key] || null;
}

// Group visible projects by section (in first-seen order) with each section's
// highlighted project first. Used by the home page cards and the sidebar.
function groupProjectsForDisplay(projects) {
  const hasSections = projects.some(p => typeof p.section === 'string' && p.section.trim() !== '');
  const groups = [];

  if (hasSections) {
    const sectionMap = new Map();
    projects.forEach(project => {
      const sectionName = typeof project.section === 'string' && project.section.trim()
        ? project.section.trim()
        : 'Other Projects';
      if (!sectionMap.has(sectionName)) sectionMap.set(sectionName, []);
      sectionMap.get(sectionName).push(project);
    });
    sectionMap.forEach((sectionProjects, sectionName) => {
      groups.push({ sectionName, projects: sectionProjects });
    });
  } else {
    groups.push({ sectionName: '', projects: [...projects] });
  }

  groups.forEach(group => {
    const highlightedIndex = group.projects.findIndex(p => p.highlighted === true);
    if (highlightedIndex > 0) {
      const [highlighted] = group.projects.splice(highlightedIndex, 1);
      group.projects.unshift(highlighted);
    }
  });

  return { hasSections, groups };
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

// Embed URL for a muted, chrome-free YouTube background video.
// No loop/playlist params: a one-item playlist makes YouTube show prev/next buttons,
// so setupBackgroundVideo() loops it instead (enablejsapi lets it control the player).
function youTubeBackgroundSrc(videoId, start = 0) {
  const params = new URLSearchParams({
    autoplay: 1, mute: 1, controls: 0, rel: 0,
    playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 0,
    modestbranding: 1, enablejsapi: 1, origin: window.location.origin
  });
  if (start > 0) params.set('start', start);
  return `https://www.youtube.com/embed/${videoId}?${params}`;
}

function getHeroVideoMarkup(url, title) {
  if (!url) return '';
  try {
    const urlObj = new URL(url, window.location.href);
    const host = urlObj.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let videoId = urlObj.searchParams.get('v') || urlObj.pathname.slice(1);
      if (!videoId) return '';
      const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
      const start = parseYouTubeStart(tParam);
      const src = youTubeBackgroundSrc(videoId, start);
      return `<div class="hero-video" aria-hidden="true"><iframe src="${src}" title="${title}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`;
    }

    if (host.includes('vimeo.com')) {
      const videoId = urlObj.pathname.split('/').pop();
      if (!videoId || isNaN(videoId)) return '';
      const src = `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1&loop=1&background=1`;
      return `<div class="hero-video" aria-hidden="true"><iframe src="${src}" title="${title}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
    }

    if (urlObj.pathname.endsWith('.mp4')) {
      return `<div class="hero-video" aria-hidden="true"><video autoplay muted loop playsinline><source src="${url}" type="video/mp4"></video></div>`;
    }
  } catch (error) {
    console.error("Could not parse hero video URL:", url, error);
  }
  return '';
}

// Hero background for project and experience pages: optional image, plus an
// optional muted looping video (YouTube, Vimeo or .mp4) layered on top.
function applyHeroMedia({ image, videoUrl, title }) {
  const hero = document.getElementById('hero');
  if (!hero) return;
  if (image) hero.style.setProperty('--hero-bg-image', `url('${image}')`);
  if (!videoUrl || hero.querySelector('.hero-video')) return;
  const markup = getHeroVideoMarkup(videoUrl, title || '');
  if (markup) hero.insertAdjacentHTML('afterbegin', markup);
}

// Shown at the top of the hero when a page is hidden from the home page/sidebar
// but someone reached it anyway (direct link, old bookmark, poking at URLs...)
// Notes at the top of a detail page's hero:
//   hidden: true -> page is unlisted but someone reached it anyway (direct link, old bookmark...)
//   stub: true   -> page is listed as normal but still bare-bones
const PAGE_NOTICES = {
  hidden: {
    badge: 'Secret area',
    title: 'Huh, you found something hidden o.O',
    text: {
      project: "This project is hidden from the rest of the site, so you either clipped through a wall or someone sent you the link. Feel free to look around, just know it might be a bit rough around the edges.",
      experience: "This one isn't listed anywhere on the site, so you probably got here through a direct link. Feel free to look around, it might still be a work in progress."
    }
  },
  stub: {
    badge: 'Work in progress',
    title: "Heads up, this one's still being built",
    text: {
      project: "This project page is a work in progress, so it might be pretty bare-bones right now. More details, pictures and code are on the way, they just aren't here yet.",
      experience: "This page is still a work in progress, so it might be pretty bare-bones for now. I'm filling it in bit by bit, so check back later."
    }
  }
};

function showPageNotice(type, kind) {
  const intro = document.querySelector('#hero .hero_intro');
  const config = PAGE_NOTICES[type];
  if (!intro || !config || intro.querySelector(`.hidden-notice--${type}`)) return;

  const notice = document.createElement('div');
  notice.className = `hidden-notice hidden-notice--${type}`;
  notice.setAttribute('role', 'note');
  notice.innerHTML = `
    <span class="hidden-notice__badge"></span>
    <p class="hidden-notice__title"></p>
    <p class="hidden-notice__text"></p>
  `;
  notice.querySelector('.hidden-notice__badge').textContent = config.badge;
  notice.querySelector('.hidden-notice__title').textContent = config.title;
  notice.querySelector('.hidden-notice__text').textContent = config.text[kind] || config.text.project;

  // Stack below any notice already shown, above the title
  const existing = intro.querySelectorAll('.hidden-notice');
  if (existing.length) existing[existing.length - 1].after(notice);
  else intro.prepend(notice);
}

// Locked pages (locked: true) show only this, never their content.
// Note: the data files are still public, this just keeps the page itself closed.
const LOCKED_NOTICE_TEXT = {
  project: "Sadly this project is locked, so you're not actually allowed to see it. Maybe it's under NDA, maybe it's just not ready yet. Either way, nothing to see here (for now).",
  experience: "Sadly this one is locked, so you're not actually allowed to see it. Could be NDA stuff, could be that it's just not ready yet. Either way, nothing to see here (for now)."
};

function showLockedPage(kind) {
  const intro = document.querySelector('#hero .hero_intro');
  if (!intro) return;

  document.title = 'Locked | Elias Wennerberg';
  const robots = document.querySelector('meta[name="robots"]') || document.head.appendChild(document.createElement('meta'));
  robots.setAttribute('name', 'robots');
  robots.setAttribute('content', 'noindex, nofollow');

  // Only the hero stays; everything below it belongs to the locked page
  document.querySelectorAll('main > article').forEach(el => { el.style.display = 'none'; });

  intro.classList.add('hero_intro--locked');
  intro.innerHTML = `
    <div class="hidden-notice hidden-notice--locked" role="note">
      <span class="hidden-notice__badge">Locked area</span>
      <p class="hidden-notice__title">Huh, you found something hidden... and it's locked x.x</p>
      <p class="hidden-notice__text"></p>
    </div>
    <div class="project-actions"><a class="button" href="/">Return to Home</a></div>
  `;
  intro.querySelector('.hidden-notice__text').textContent =
    LOCKED_NOTICE_TEXT[kind] || LOCKED_NOTICE_TEXT.project;
}

const JS_YAML_URL = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js';
let jsYamlPromise = null;

// About/Resume/404 don't include js-yaml, so load it on demand
function loadJsYaml() {
  if (window.jsyaml) return Promise.resolve(window.jsyaml);
  if (!jsYamlPromise) {
    jsYamlPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = JS_YAML_URL;
      script.onload = () => resolve(window.jsyaml);
      script.onerror = () => reject(new Error('Failed to load js-yaml'));
      document.head.appendChild(script);
    });
  }
  return jsYamlPromise;
}

async function fetchYaml(url) {
  const [yaml, response] = await Promise.all([loadJsYaml(), fetch(url)]);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return yaml.load(await response.text()) || {};
}

function appendSidebarLinks(list, links) {
  links.forEach(({ href, label }) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'sidebar_link';
    a.href = href;
    a.textContent = label;
    li.appendChild(a);
    list.appendChild(li);
  });
}

// Mark the link for the current page. experience.html without ?id shows the
// first experience, so its first link counts as current.
function markActiveSidebarLink() {
  const here = new URL(window.location.href);
  document.querySelectorAll('.site_sidebar .sidebar_link').forEach(link => {
    const target = new URL(link.href, here);
    if (target.hash || target.pathname !== here.pathname) return;
    const id = here.searchParams.get('id');
    const isFirstInList = !link.closest('li').previousElementSibling;
    const matches = id ? target.searchParams.get('id') === id : !target.search || isFirstInList;
    if (matches) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

async function populateSidebarNav() {
  const projectList = document.getElementById('sidebar-projects');
  const experienceList = document.getElementById('sidebar-experience');

  const loadProjects = projectList
    ? fetchYaml('/data/projects.yml').then(data => {
      const visible = (data.summaries || []).filter(p => p.hidden !== true && p.locked !== true);
      const ordered = groupProjectsForDisplay(visible).groups.flatMap(g => g.projects);
      appendSidebarLinks(projectList, ordered.map(p => ({
        href: p.detailPageUrl || `/project.html?id=${encodeURIComponent(p.id)}`,
        label: p.navTitle || p.title || p.id
      })));
    })
    : Promise.resolve();

  const loadExperiences = experienceList
    ? fetchYaml('/data/experiences.yml').then(data => {
      const experiences = (data.experiences || []).filter(e => e.hidden !== true && e.locked !== true);
      appendSidebarLinks(experienceList, experiences.map(e => ({
        href: `/experience.html?id=${encodeURIComponent(e.id)}`,
        label: e.navTitle || e.id
      })));
      // Hide the whole section when there is nothing to list
      experienceList.closest('.sidebar_section').hidden = experiences.length === 0;
    })
    : Promise.resolve();

  const results = await Promise.allSettled([loadProjects, loadExperiences]);
  results.forEach(r => {
    if (r.status === 'rejected') console.error('Error building sidebar nav:', r.reason);
  });
  markActiveSidebarLink();
}

function ensureBodyTextures() {
  const existingLeft = document.querySelector('.texture-left');
  const existingRight = document.querySelector('.texture-right');

  if (!existingLeft) {
    const left = document.createElement('div');
    left.className = 'texture-left';
    document.body.appendChild(left);
  }

  if (!existingRight) {
    const right = document.createElement('div');
    right.className = 'texture-right';
    document.body.appendChild(right);
  }
}

function setupParallaxTextures() {
  const left = document.querySelector('.texture-left');
  const right = document.querySelector('.texture-right');
  if (!left || !right) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Textures scroll at 70% of page speed. They are position: fixed and only
  // translated, so the browser composites them instead of repainting each frame.
  const SPEED = 0.7;
  const TILE_ASPECT = 4320 / 1920; // texture height / width
  let tileHeight = 0;
  let ticking = false;

  const measure = () => {
    tileHeight = left.offsetWidth * TILE_ASPECT;
    const height = `${Math.ceil(window.innerHeight + tileHeight)}px`;
    left.style.height = height;
    right.style.height = height;
  };

  const update = () => {
    const y = tileHeight ? (window.scrollY * SPEED) % tileHeight : 0;
    const transform = `translate3d(0, ${-y}px, 0)`;
    left.style.transform = transform;
    right.style.transform = transform;
    ticking = false;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  measure();
  update();
}

function setupEmailReveal() {
  const email = String.fromCharCode(
    101, 108, 105, 97, 115, 46, 119, 101, 110, 110, 101, 114, 98, 101, 114, 103,
    64, 103, 109, 97, 105, 108, 46, 99, 111, 109
  );

  document.addEventListener('click', (event) => {
    const link = event.target.closest('.email-link');
    if (!link) return;
    event.preventDefault();
    window.location.href = `mailto:${email}`;
  });
}

function ensureImageModal() {
  if (document.getElementById('image-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'image-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <span class="modal-close">&times;</span>
    <div class="modal-content">
      <img id="modal-image-content" src="" alt="Expanded image">
    </div>
  `;

  document.body.appendChild(modal);
}

function openImageModal(imageSrc, altText) {
  const modal = document.getElementById('image-modal');
  const modalImage = document.getElementById('modal-image-content');
  if (!modal || !modalImage) return;

  modalImage.src = imageSrc;
  modalImage.alt = altText || 'Expanded image';
  modal.classList.add('show-modal');
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  if (modal) modal.classList.remove('show-modal');
}

function setupImageModal() {
  ensureImageModal();

  const modal = document.getElementById('image-modal');
  const closeBtn = modal ? modal.querySelector('.modal-close') : null;

  if (closeBtn) {
    closeBtn.addEventListener('click', closeImageModal);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeImageModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && modal.classList.contains('show-modal')) {
      closeImageModal();
    }
  });

  // Only content images enlarge: not icons/logos (tags, code dropdown headers,
  // buttons, nav) and not decorative images with an empty alt
  const shouldSkipImage = (img) => {
    if (img.dataset.noImageModal === 'true') return true;
    if (img.getAttribute('alt') === '') return true;
    if (img.closest('.modal-overlay, .code-modal-overlay')) return true;
    if (img.closest('button, [role="button"], .button, .tool-btn, .social_link')) return true;
    if (img.closest('.skill-tag, .project-flair, summary, .site_sidebar')) return true;
    if (img.closest('header, footer') && img.closest('a')) return true;
    return false;
  };

  document.addEventListener('click', (event) => {
    const img = event.target.closest('img');
    if (!img || shouldSkipImage(img)) return;

    event.preventDefault();
    img.classList.add('image-modal-trigger');
    openImageModal(img.currentSrc || img.src, img.alt || 'Expanded image');
  });

  const markTriggers = (root = document) => {
    root.querySelectorAll('img').forEach(img => {
      if (shouldSkipImage(img)) return;
      img.classList.add('image-modal-trigger');
    });
  };

  markTriggers();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('img')) {
          if (!shouldSkipImage(node)) {
            node.classList.add('image-modal-trigger');
          }
          return;
        }
        if (node.querySelectorAll) {
          markTriggers(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function setupMenuToggle() {
  const toggle = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".site_sidebar");
  const overlay = document.querySelector(".sidebar_overlay");

  function toggleSidebar() {
    const isOpen = document.body.classList.toggle("sidebar-open");
    sidebar?.classList.toggle("sidebar-open", isOpen);
    overlay?.classList.toggle("sidebar-open", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  if (toggle) {
    toggle.addEventListener("click", toggleSidebar);
  }

  if (overlay) {
    overlay.addEventListener("click", toggleSidebar);
  }

  // Close sidebar when any nav link is clicked (delegated: links are added later)
  sidebar?.addEventListener("click", (event) => {
    if (!event.target.closest(".sidebar_link")) return;
    if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
      document.body.classList.remove("sidebar-open");
      sidebar.classList.remove("sidebar-open");
      overlay?.classList.remove("sidebar-open");
      document.body.style.overflow = "";
    }
  });
}


// Background videos (hero + home cards) stay invisible until they actually play,
// so YouTube's start-up play button, pause overlay and end-screen suggestions never show.
const BACKGROUND_VIDEO_SELECTOR = '.hero-video iframe, .hero-video video, .card-media iframe, .card-media video';

function setupBackgroundVideo(el) {
  if (el.dataset.bgVideo) return;
  el.dataset.bgVideo = 'true';
  el.classList.add('bg-video');
  const setPlaying = (playing) => el.classList.toggle('is-playing', playing);

  if (el.tagName === 'VIDEO') {
    el.addEventListener('playing', () => setPlaying(true));
    el.addEventListener('pause', () => setPlaying(false));
    if (!el.paused && el.readyState > 2) setPlaying(true);
    return;
  }

  if (!el.src.includes('youtube.com/embed/')) {
    setPlaying(true); // Vimeo background mode has no UI to hide
    return;
  }

  // Talk to the YouTube player through postMessage (what the IFrame API does under the hood)
  const send = (message) => el.contentWindow?.postMessage(JSON.stringify(message), '*');
  const command = (func, args = []) => send({ event: 'command', func, args });
  const start = Number(new URL(el.src).searchParams.get('start')) || 0;
  let heard = false;
  let lastState = null;
  let duration = 0;
  let lastRestart = 0;

  const restart = () => {
    if (Date.now() - lastRestart < 2000) return;
    lastRestart = Date.now();
    command('seekTo', [start, true]);
    command('playVideo');
  };

  window.addEventListener('message', (event) => {
    if (event.source !== el.contentWindow || typeof event.data !== 'string') return;
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    heard = true;
    const info = data.info || {};
    if (info.duration) duration = info.duration;

    // Loop by seeking back just before the end, so the end screen never comes up
    if (duration && info.currentTime > duration - 0.6) restart();

    const state = data.event === 'onStateChange' ? data.info : info.playerState;
    if (state === undefined || state === lastState) return;
    lastState = state;

    // Buffering (e.g. after a loop seek) keeps whatever is showing; no flicker
    if (state === 3) return;

    if (state === 1) {
      // Captions follow the viewer's YouTube settings, so drop them once playing
      command('unloadModule', ['captions']);
      command('unloadModule', ['cc']);
      setPlaying(true);
    } else {
      setPlaying(false);
      if (state === 0) restart();
    }
  });

  // The player only reports back after it has heard "listening", so keep asking until it answers
  const startListening = () => {
    let tries = 0;
    const timer = setInterval(() => {
      if (heard || ++tries > 40) return clearInterval(timer);
      send({ event: 'listening', id: 1, channel: 'widget' });
    }, 250);
  };
  el.addEventListener('load', startListening);
  startListening();
}

function watchBackgroundVideos() {
  document.querySelectorAll(BACKGROUND_VIDEO_SELECTOR).forEach(setupBackgroundVideo);
  new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches(BACKGROUND_VIDEO_SELECTOR)) setupBackgroundVideo(node);
      node.querySelectorAll(BACKGROUND_VIDEO_SELECTOR).forEach(setupBackgroundVideo);
    }));
  }).observe(document.body, { childList: true, subtree: true });
}

loadHeaderFooter();

document.addEventListener('DOMContentLoaded', setupImageModal);
document.addEventListener('DOMContentLoaded', watchBackgroundVideos);
document.addEventListener('DOMContentLoaded', setupEmailReveal);
