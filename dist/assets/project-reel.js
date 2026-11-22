const projectLogos = {
  outcomes: ['outcomes.webp', 'Outcomes'],
  talentscreen: ['employmate.svg', 'EmployMate'],
  rcg: ['rcg.svg', 'RCG Markets', 'dark'],
  aawealth: ['aawealth.webp', 'AA Wealth Management'],
};

// The existing case cards supply the titles, categories and links for every chapter.
export function createProjectReel({ cards, scheduleUpdate, jumpTo }) {
  const section = document.querySelector('.work');
  const frame = section.querySelector('.reel-frame');
  const poster = frame.querySelector('img');
  const video = frame.querySelector('video');
  const outgoing = new Image();
  outgoing.alt = '';
  outgoing.className = 'reel-outgoing';
  outgoing.hidden = true;
  video.after(outgoing);
  const title = frame.querySelector('.reel-title');
  const category = frame.querySelector('.reel-category');
  const brand = frame.querySelector('.reel-brand');
  const logo = brand.querySelector('img');
  logo.addEventListener('load', () => { brand.hidden = false; });
  logo.addEventListener('error', () => { brand.hidden = true; });
  const position = frame.querySelector('.reel-position');
  const progress = frame.querySelector('.reel-meter i');
  const previous = frame.querySelector('[data-action="previous"]');
  const next = frame.querySelector('[data-action="next"]');
  const play = frame.querySelector('[data-action="play"]');
  const list = section.querySelector('.projects');
  const mobile = matchMedia('(max-width: 700px)');
  const chapters = cards.map((card) => {
    const link = card.querySelector('.project-link');
    return {
      card,
      href: link.getAttribute('href'),
      slug: link.hash.slice('#case-'.length),
      name: card.querySelector('h3').textContent,
      category: card.querySelector('.card-eyebrow').textContent,
    };
  });

  let visible = [];
  let active;
  let desiredTime = 0;
  let requestedPlayback = false;
  let playing = false;
  let pausedByVisitor = false;
  let near = false;
  let failed = false;
  let motion = false;
  let lastScroll = window.scrollY;
  let frameHandle = 0;
  let requestVersion = 0;
  let selectionChanged = true;
  let dissolve;

  function stopPlayback() {
    requestVersion++;
    requestedPlayback = false;
    playing = false;
    video.pause();
    play.textContent = 'Play scene';
    play.setAttribute('aria-pressed', 'false');
  }

  function unload() {
    stopPlayback();
    if (video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.load();
    }
    frame.classList.remove('video-ready');
  }

  function activate(chapter) {
    if (active === chapter) return;
    dissolve?.cancel();
    dissolve = undefined;
    outgoing.hidden = true;
    if (near && motion && active && poster.complete && poster.naturalWidth) {
      outgoing.src = poster.currentSrc || poster.src;
      outgoing.hidden = false;
    }
    unload();
    active?.card.removeAttribute('data-active');
    active = chapter;
    active.card.setAttribute('data-active', '');
    failed = false;
    pausedByVisitor = false;
    title.textContent = active.name;
    title.href = active.href;
    title.setAttribute('aria-label', 'Read the ' + active.name + ' case study');
    category.textContent = active.category;
    brand.hidden = true;
    const projectLogo = projectLogos[active.slug];
    if (projectLogo) {
      const [file, label, surface = 'light'] = projectLogo;
      brand.dataset.surface = surface;
      logo.alt = label;
      if (logo.getAttribute('src') !== '/assets/brands/' + file) {
        logo.src = '/assets/brands/' + file;
      } else {
        brand.hidden = !logo.complete || !logo.naturalWidth;
      }
    } else {
      logo.removeAttribute('src');
    }
    poster.src = '/assets/reel/' + active.slug + '.webp';
    desiredTime = 0;
  }

  function revealScene() {
    if (outgoing.hidden || dissolve) return;
    if (!motion || typeof outgoing.animate !== 'function') {
      outgoing.hidden = true;
      return;
    }
    dissolve = outgoing.animate([{opacity: 1}, {opacity: 0}], {duration: 220, easing: 'ease-out'});
    dissolve.onfinish = () => {
      outgoing.hidden = true;
      dissolve = undefined;
    };
  }
  poster.addEventListener('load', revealScene);
  poster.addEventListener('error', () => { outgoing.hidden = true; });

  function seek() {
    if (!active || !motion || !video.hasAttribute('src') || video.readyState < 2 || video.seeking ||
        requestedPlayback || pausedByVisitor || !Number.isFinite(video.duration)) return;
    const time = desiredTime * Math.max(0, video.duration - 0.06);
    if (Math.abs(video.currentTime - time) > 0.055) video.currentTime = time;
  }

  function stageTop() {
    return parseFloat(getComputedStyle(frame).top) || 0;
  }

  function focusLine() {
    const top = stageTop();
    if (mobile.matches) {
      return Math.min(innerHeight * .87, top + frame.offsetHeight + Math.max(44, (innerHeight - top - frame.offsetHeight) * .36));
    }
    return Math.min(innerHeight * .65, top + frame.offsetHeight * .53);
  }

  function refresh() {
    selectionChanged = true;
    visible = chapters.filter(({card}) => !card.hidden);
    scheduleUpdate();
  }

  function update(enabled) {
    motion = enabled && !navigator.connection?.saveData;
    play.hidden = !motion || failed;
    if (!motion) outgoing.hidden = true;
    if (!visible.length) return;
    const bounds = list.getBoundingClientRect();
    const onScreen = bounds.bottom > 0 && bounds.top < innerHeight;
    const scrollChange = Math.abs(scrollY - lastScroll);
    lastScroll = scrollY;
    if (near !== onScreen) {
      near = onScreen;
      if (!near) stopPlayback();
    }
    if (!near && active && !active.card.hidden && !selectionChanged) {
      if (!motion && video.hasAttribute('src')) unload();
      return;
    }
    selectionChanged = false;
    const y = focusLine();
    const rects = visible.map(({card}) => card.getBoundingClientRect());
    const nextIndex = rects.findIndex((rect) => rect.bottom >= y);
    const index = nextIndex === -1 ? visible.length - 1 : nextIndex;
    const rect = rects[index];
    activate(visible[index]);
    position.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(visible.length).padStart(2, '0');
    previous.disabled = index === 0;
    next.disabled = index === visible.length - 1;
    desiredTime = Math.max(0, Math.min(1, (y - rect.top) / Math.max(1, rect.height)));
    if (scrollChange > 1 && (requestedPlayback || pausedByVisitor)) {
      stopPlayback();
      pausedByVisitor = false;
    }
    if (!playing && !pausedByVisitor) progress.style.transform = 'scaleX(' + desiredTime + ')';
    frame.style.setProperty('--reel-y', motion ? ((desiredTime - .5) * 13).toFixed(1) + 'px' : '0px');
    play.hidden = !motion || failed;
    if (!motion && video.hasAttribute('src')) unload();
    if (!near || !motion || failed) return;
    if (!video.hasAttribute('src')) video.src = '/assets/reel/' + active.slug + '.mp4';
    seek();
  }

  function mediaBelongsToChapter() {
    return active && video.currentSrc.endsWith('/' + active.slug + '.mp4');
  }
  video.addEventListener('loadeddata', () => {
    if (!mediaBelongsToChapter()) return;
    frame.classList.add('video-ready');
    revealScene();
    seek();
  });
  video.addEventListener('seeked', seek);
  video.addEventListener('error', () => {
    if (!video.hasAttribute('src')) return;
    failed = true;
    stopPlayback();
    frame.classList.remove('video-ready');
    play.hidden = true;
  });
  video.addEventListener('timeupdate', () => {
    if (playing && video.duration) progress.style.transform = 'scaleX(' + video.currentTime / video.duration + ')';
  });
  video.addEventListener('ended', () => {
    stopPlayback();
    pausedByVisitor = true;
    progress.style.transform = 'scaleX(1)';
  });
  play.addEventListener('click', async () => {
    if (!motion || !active || failed) return;
    if (requestedPlayback) {
      stopPlayback();
      pausedByVisitor = true;
      return;
    }
    const version = ++requestVersion;
    requestedPlayback = true;
    pausedByVisitor = false;
    if (video.ended || video.duration - video.currentTime < .15) video.currentTime = 0;
    try {
      await video.play();
      if (version !== requestVersion) return;
      playing = true;
      play.textContent = 'Pause scene';
      play.setAttribute('aria-pressed', 'true');
    } catch {
      if (version === requestVersion) stopPlayback();
    }
  });

  function step(by) {
    const target = visible[visible.indexOf(active) + by];
    if (!target) return;
    const rect = target.card.getBoundingClientRect();
    jumpTo(Math.max(0, scrollY + rect.top + rect.height / 2 - focusLine()));
    scheduleUpdate();
  }
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPlayback();
  });
  section.classList.add('with-reel');
  frame.hidden = false;
  section.querySelector('.section-head > p').textContent = 'Scroll to move through the project reel. Open a case study for my role, the work and the result.';
  refresh();
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frameHandle);
      frameHandle = requestAnimationFrame(scheduleUpdate);
    });
    observer.observe(list);
    observer.observe(frame);
  }
  return { refresh, update, stopPlayback };
}
