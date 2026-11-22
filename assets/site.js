import { createProjectReel } from './project-reel.js';

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
  projectReel.update(motionEnabled);
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

const filterBox = document.querySelector('.filters');
const projectList = document.querySelector('.projects');
const filterButtons = [...filterBox.querySelectorAll('button')];
const projectCards = [...document.querySelectorAll('.project-card')];
const projectReel = createProjectReel({
  cards: projectCards,
  scheduleUpdate: scheduleScrollUpdate,
  jumpTo(position) {
    if (lenis) lenis.scrollTo(position, { immediate: true });
    else window.scrollTo({ top: position, behavior: 'instant' });
  }
});
const filterStatus = document.querySelector('#filter-status');
filterBox.hidden = false;
filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selection = button.dataset.filter;
    filterButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    projectList.classList.toggle('is-filtered', selection !== 'all');
    let shown = 0;
    projectCards.forEach((card) => {
      card.hidden = selection !== 'all' && !card.dataset.category.split(' ').includes(selection);
      if (!card.hidden) shown++;
    });
    projectReel.refresh();
    filterStatus.textContent = `${shown} case studies shown.`;
    scheduleScrollUpdate();
  });
});

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

  projectReel.stopPlayback();
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
        event.preventDefault();
        history.pushState(null, '', fragment);
        lenis.scrollTo(target, { offset: -88, duration: 0.85 });
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

const sectionLinks = [...document.querySelectorAll('.masthead nav a')].map(link => ({
  link, section: document.querySelector(link.hash)
}));
function updateNavigation() {
  const threshold = document.querySelector('.masthead').offsetHeight + innerHeight * .25;
  const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const current = atEnd ? sectionLinks.at(-1) : sectionLinks.filter(({section}) => section.getBoundingClientRect().top <= threshold).at(-1);
  for (const entry of sectionLinks) {
    if (entry === current) entry.link.setAttribute('aria-current', 'location');
    else entry.link.removeAttribute('aria-current');
  }
}
