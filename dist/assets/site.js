const root = document.documentElement;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const motionControl = document.querySelector('#motion-control');
const parallax = document.querySelector('[data-parallax]');
const heroVisual = document.querySelector('.hero-visual');
const progress = document.querySelector('.reading-progress');
const isWheelDevice = matchMedia('(pointer: fine)');
let frame = 0;
let lenis;
let motionEnabled = false;
let activePreview;

function readMotionPreference() {
  try {
    return localStorage.getItem('portfolio-motion');
  } catch {
    return null;
  }
}

function updateScrollVisuals() {
  frame = 0;
  const scrollRange = root.scrollHeight - innerHeight;
  progress.style.setProperty('--progress', scrollRange > 0 ? scrollY / scrollRange : 0);
  updateNavigation();
  if (!motionEnabled) return;
  const distance = scrollY - heroVisual.offsetTop;
  const limit = innerWidth <= 660 ? 16 : 28;
  const offset = Math.min(limit, Math.max(-limit, distance * 0.10));
  parallax.style.setProperty('--offset', `${offset}px`);
}

function scheduleScrollUpdate() {
  if (!frame) frame = requestAnimationFrame(updateScrollVisuals);
}

async function updateMotion() {
  const saved = readMotionPreference();
  motionEnabled = !motionPreference.matches && saved !== 'off';
  root.classList.toggle('motion', motionEnabled);
  if (!motionEnabled && activePreview) stopPreview();
  motionControl.textContent = `Motion ${motionEnabled ? 'on' : 'off'}`;
  motionControl.setAttribute('aria-pressed', String(motionEnabled));
  if (!motionEnabled || !isWheelDevice.matches) {
    lenis?.destroy();
    lenis = undefined;
    if (!motionEnabled) parallax.style.removeProperty('--offset');
    scheduleScrollUpdate();
    return;
  }

  scheduleScrollUpdate();
  try {
    const { Lenis } = await import('./vendor/lenis-1.3.27/lenis.mjs');
    if (motionEnabled && isWheelDevice.matches && !lenis) {
      lenis = new Lenis({ autoRaf: true, smoothWheel: true, anchors: false });
    }
  } catch {
    // Native scrolling and parallax remain available if the optional library fails to load.
  }
}

motionControl.hidden = motionPreference.matches;
motionControl.setAttribute('aria-label', 'Page motion');
motionControl.addEventListener('click', () => {
  try {
    localStorage.setItem('portfolio-motion', motionEnabled ? 'off' : 'on');
  } catch {
    return;
  }
  updateMotion();
});
motionPreference.addEventListener('change', () => {
  motionControl.hidden = motionPreference.matches;
  updateMotion();
});
isWheelDevice.addEventListener('change', updateMotion);
addEventListener('scroll', scheduleScrollUpdate, { passive: true });
addEventListener('resize', scheduleScrollUpdate);
updateMotion();

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.add('in-view');
      observer.unobserve(target);
    });
  }, { threshold: 0.09 });
  document.querySelectorAll('[data-reveal]').forEach((element) => {
    element.classList.add('ready-reveal');
    observer.observe(element);
  });
}

const stages = [...document.querySelectorAll('[data-stage]')];
const stepNav = document.querySelector('.step-nav');
stepNav.setAttribute('role', 'tablist');
function selectStage(active) {
  stages.forEach((stage) => {
    const panel = document.getElementById(stage.getAttribute('aria-controls'));
    const selected = stage === active;
    stage.setAttribute('role', 'tab');
    stage.setAttribute('aria-selected', String(selected));
    stage.tabIndex = selected ? 0 : -1;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', stage.id);
    panel.tabIndex = 0;
    panel.hidden = !selected;
  });
}
stages.forEach((stage) => stage.addEventListener('click', () => selectStage(stage)));
stepNav.addEventListener('keydown', (event) => {
  const current = stages.indexOf(document.activeElement);
  const offsets = { ArrowLeft: -1, ArrowRight: 1, Home: -current, End: stages.length - 1 - current };
  if (current < 0 || !(event.key in offsets)) return;
  event.preventDefault();
  const next = stages[(current + offsets[event.key] + stages.length) % stages.length];
  selectStage(next);
  next.focus();
});
selectStage(stages[0]);

const dialog = document.querySelector('#case-dialog');
const dialogContent = document.querySelector('#dialog-content');
const closeButton = dialog.querySelector('.case-close');
const cases = new Map([...document.querySelectorAll('.fallback-details .case-detail')].map((entry) => [`#${entry.id}`, entry]));
let trigger;

function syncCaseStudy() {
  const caseStudy = cases.get(location.hash);
  if (!caseStudy) {
    if (dialog.open) dialog.close();
    return;
  }

  stopPreview();
  const view = caseStudy.cloneNode(true);
  view.removeAttribute('id');
  view.querySelector('h2').id = 'dialog-heading';
  dialogContent.replaceChildren(view);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  closeButton.focus({ preventScroll: true });
}

function dismissCaseStudy() {
  if (history.state?.portfolioCaseStudy) {
    history.back();
  } else {
    history.replaceState(null, '', location.pathname + location.search);
    syncCaseStudy();
  }
}

if (typeof dialog.showModal === 'function') {
  root.classList.add('js');
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    const fragment = link.getAttribute('href');
    if (cases.has(fragment)) {
      event.preventDefault();
      trigger = link;
      history.pushState({ portfolioCaseStudy: true }, '', fragment);
      syncCaseStudy();
    } else if (dialog.contains(link)) {
      const target = document.getElementById(fragment.slice(1));
      if (!target) return;
      event.preventDefault();
      trigger = undefined;
      dialog.close();
      history.pushState(null, '', fragment);
      target.focus({ preventScroll: true });
      target.scrollIntoView();
    } else if (lenis) {
      const target = document.getElementById(fragment.slice(1));
      if (target) {
        if (fragment === '#work') showGallery(workLinks[0]);
        event.preventDefault();
        if (location.hash !== fragment) history.pushState(null, '', fragment);
        if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
        lenis.scrollTo(target, { duration: 0.85 });
      }
    }
  });
  closeButton.addEventListener('click', dismissCaseStudy);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dismissCaseStudy();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dismissCaseStudy();
  });
  dialog.addEventListener('close', () => {
    trigger?.focus({ preventScroll: true });
    trigger = undefined;
  });
  addEventListener('popstate', syncCaseStudy);
  addEventListener('hashchange', syncCaseStudy);
  syncCaseStudy();
}

const masthead = document.querySelector('.masthead');
const workSection = document.querySelector('#work');
const sectionLinks = navigationTargets('.masthead nav a');
const workLinks = navigationTargets('.work-nav a');
const galleryStatus = document.querySelector('#gallery-status');
let activeGallery;
workSection.classList.add('gallery-ready');

function stopPreview() {
  activePreview?.pause();
  activePreview = undefined;
}

document.querySelectorAll('video[data-preview]').forEach((video) => {
  const tile = video.closest('.tile-main');
  tile.addEventListener('pointerenter', async (event) => {
    if (event.pointerType !== 'mouse' || !motionEnabled || navigator.connection?.saveData) return;
    stopPreview();
    activePreview = video;
    if (!video.hasAttribute('src')) video.src = video.dataset.preview;
    try {
      await video.play();
    } catch {
      // Keep the poster visible when a motion preview cannot play.
    }
  });
  tile.addEventListener('pointerleave', () => {
    if (activePreview === video) stopPreview();
  });
  video.addEventListener('playing', () => video.classList.toggle('is-playing', video === activePreview));
  video.addEventListener('pause', () => video.classList.remove('is-playing'));
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPreview();
});

function showGallery(selected) {
  if (selected === activeGallery) return;
  stopPreview();
  activeGallery = selected;
  for (const entry of workLinks) entry.section.hidden = entry !== selected;
  highlightLocation(workLinks, selected);
  const name = selected.link.textContent;
  const count = selected.section.querySelectorAll('.tile').length;
  galleryStatus.textContent = `${name}, ${count} ${count === 1 ? 'project' : 'projects'}.`;
  scheduleScrollUpdate();
}

function syncGallery() {
  const selected = workLinks.find(({ link }) => link.hash === location.hash);
  if (selected) showGallery(selected);
  else if (!activeGallery || !location.hash || location.hash === '#work') showGallery(workLinks[0]);
}

for (const entry of workLinks) {
  entry.link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (location.hash !== entry.link.hash) history.pushState(null, '', entry.link.hash);
    showGallery(entry);
    if (lenis) lenis.scrollTo(workSection, { immediate: true });
    else workSection.scrollIntoView();
  });
}
addEventListener('popstate', syncGallery);
addEventListener('hashchange', syncGallery);
syncGallery();
if (workLinks.some(({ link }) => link.hash === location.hash)) {
  requestAnimationFrame(() => workSection.scrollIntoView());
}

function navigationTargets(selector) {
  return [...document.querySelectorAll(selector)].map((link) => ({
    link,
    section: document.getElementById(link.hash.slice(1))
  }));
}

function highlightLocation(links, current) {
  for (const entry of links) {
    if (entry === current) entry.link.setAttribute('aria-current', 'location');
    else entry.link.removeAttribute('aria-current');
  }
}

function updateNavigation() {
  const threshold = masthead.offsetHeight + innerHeight * .25;
  const atEnd = scrollY + innerHeight >= root.scrollHeight - 2;
  const reached = ({ section }) => section.getBoundingClientRect().top <= threshold;
  highlightLocation(sectionLinks, atEnd ? sectionLinks.at(-1) : sectionLinks.filter(reached).at(-1));

}
