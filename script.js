/* Markdown -> HTML (small built-in parser)*/
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const safeUrl = u => (/^\s*(javascript|vbscript|data:(?!image\/))/i.test(u) ? '#' : u);

function inline(text) {
  let s = esc(text);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s"]+)\)/g, (_, alt, url) => `<img alt="${alt}" src="${safeUrl(url)}">`)
    .replace(/\[([^\]]+)\]\(([^)\s"]+)\)/g, (_, t, url) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[i] + '</code>');
}

function mdToHtml(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const ulRe = /^\s*[-*+]\s+/, olRe = /^\s*\d+\.\s+/;
  const isBlockStart = l => /^(#{1,6})\s+/.test(l) || /^```/.test(l) || ulRe.test(l) || olRe.test(l) || /^>\s?/.test(l);
  let out = '', i = 0, m;

  while (i < lines.length) {
    const l = lines[i];

    if (/^```/.test(l)) {                       // fenced code block
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out += '<pre><code>' + esc(buf.join('\n')) + '</code></pre>';
    } else if ((m = l.match(/^(#{1,6})\s+(.*)$/))) {   // headings
      out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++;
    } else if (ulRe.test(l) || olRe.test(l)) {         // lists
      const re = ulRe.test(l) ? ulRe : olRe, tag = re === ulRe ? 'ul' : 'ol';
      out += `<${tag}>`;
      while (i < lines.length && re.test(lines[i])) out += '<li>' + inline(lines[i++].replace(re, '')) + '</li>';
      out += `</${tag}>`;
    } else if (/^>\s?/.test(l)) {                      // blockquote
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out += '<blockquote>' + inline(buf.join(' ')) + '</blockquote>';
    } else if (!l.trim()) {
      i++;
    } else {                                           // paragraph
      const buf = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
      out += '<p>' + inline(buf.join(' ')) + '</p>';
    }
  }
  return out;
}

/* Slides are separated by a line containing only --- */
function splitSlides(md) {
  const parts = md.replace(/\r/g, '').split(/^[ \t]*---[ \t]*$/m).map(s => s.trim());
  return parts.length ? parts : [''];
}

/*Storage (localStorage)*/
const KEY = 'mdSlides.decks.v1';
const loadDecks = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const persist = () => localStorage.setItem(KEY, JSON.stringify(decks));
let decks = loadDecks();

const SAMPLE = `# My Presentation
## Written in Markdown
Edit the text on the left and watch the slide update.

---

# Slide 02
## Lists work too
- Create slides
- Edit slides
- Save slides in the browser
- Present slides

---

# Slide 03
## Code and quotes
> Separate every slide with three dashes.

\`\`\`
console.log("Hello, slides!");
\`\`\`
`;

/*Viewer (buttons + slide + counter)*/
function createViewer(mount, onFullscreenClick) {
  mount.innerHTML = `
    <div class="stage"><div class="slide"></div></div>
    <div class="controls">
      <div class="nav"><button class="btn" data-a="prev" aria-label="Previous slide">&larr; Left</button></div>
      <span class="count" aria-live="polite"></span>
      <div class="nav right">
        <button class="btn" data-a="next" aria-label="Next slide">Right &rarr;</button>
        <button class="btn" data-a="fs"></button>
      </div>
    </div>`;
  const slideEl = mount.querySelector('.slide');
  const countEl = mount.querySelector('.count');
  const prev = mount.querySelector('[data-a=prev]');
  const next = mount.querySelector('[data-a=next]');
  const fs = mount.querySelector('[data-a=fs]');
  const v = { slides: [''], index: 0 };

  v.render = () => {
    v.index = Math.max(0, Math.min(v.index, v.slides.length - 1));
    slideEl.innerHTML = mdToHtml(v.slides[v.index]);
    countEl.textContent = `${v.index + 1} / ${v.slides.length}`;
    prev.disabled = v.index === 0;                         // first slide: left disabled
    next.disabled = v.index === v.slides.length - 1;       // last slide: right disabled
  };
  v.set = (slides, index = v.index) => { v.slides = slides; v.index = index; v.render(); };
  v.go = d => { v.index += d; v.render(); };
  v.setFsLabel = isFull => { fs.textContent = isFull ? '\u2715 Exit Full Screen' : '\u26F6 Full Screen'; };

  prev.onclick = () => v.go(-1);
  next.onclick = () => v.go(1);
  fs.onclick = onFullscreenClick;
  v.setFsLabel(false);
  return v;
}

/* App state & elements */
const $ = id => document.getElementById(id);
const views = { home: $('home'), editor: $('editor'), presenter: $('presenter') };
const mdInput = $('mdInput'), titleInput = $('titleInput'), statusEl = $('status');

let view = 'home';        // 'home' | 'editor' | 'presenter'
let returnView = 'home';  // where to go after leaving the presenter
let deck = null;          // deck being edited
let dirty = false;

const previewV = createViewer($('previewMount'), () => enterPresent());
const presenterV = createViewer($('presenterMount'), () => exitPresent());
presenterV.setFsLabel(true);   // presentation mode shows the "exit" label

function show(name) {
  view = name;
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
}

/* HomE */
function renderHome() {
  const list = $('deckList');
  list.innerHTML = '';
  $('emptyMsg').classList.toggle('hidden', decks.length > 0);
  decks.slice().sort((a, b) => b.updated - a.updated).forEach(d => {
    const li = document.createElement('li');
    li.className = 'deck-item';
    const n = splitSlides(d.content).length;
    li.innerHTML = `<div><h2></h2><small>${n} slide${n === 1 ? '' : 's'} &middot; ${new Date(d.updated).toLocaleString()}</small></div>
      <div class="deck-actions">
        <button class="btn" data-a="present">Present</button>
        <button class="btn" data-a="edit">Edit</button>
        <button class="btn danger" data-a="delete">Delete</button>
      </div>`;
    li.querySelector('h2').textContent = d.title || 'Untitled';
    li.querySelector('[data-a=present]').onclick = () => { returnView = 'home'; enterPresent(0, d); };
    li.querySelector('[data-a=edit]').onclick = () => openEditor(d);
    li.querySelector('[data-a=delete]').onclick = () => {
      if (confirm(`Delete "${d.title || 'Untitled'}"?`)) {
        decks = decks.filter(x => x.id !== d.id);
        persist(); renderHome();
      }
    };
    list.appendChild(li);
  });
  show('home');
}

/* Editor */
function setDirty(flag) {
  dirty = flag;
  statusEl.textContent = flag ? 'Unsaved changes' : 'Saved';
  statusEl.classList.toggle('dirty', flag);
}

function openEditor(d) {
  deck = d || { id: 'd' + Date.now(), title: 'Untitled presentation', content: SAMPLE, updated: Date.now(), isNew: true };
  titleInput.value = deck.title;
  mdInput.value = deck.content;
  previewV.set(splitSlides(deck.content), 0);
  setDirty(!!deck.isNew);
  show('editor');
  mdInput.focus();
}

function saveDeck() {
  if (view !== 'editor' || !deck) return;
  deck.title = titleInput.value.trim() || 'Untitled presentation';
  deck.content = mdInput.value;
  deck.updated = Date.now();
  delete deck.isNew;
  if (!decks.some(d => d.id === deck.id)) decks.push(deck);
  persist();
  setDirty(false);
}

function slideAtCursor() {
  const before = mdInput.value.slice(0, mdInput.selectionStart);
  return splitSlides(before + 'x').length - 1;   // count separators before the cursor
}

mdInput.addEventListener('input', () => {
  previewV.set(splitSlides(mdInput.value), slideAtCursor());
  setDirty(true);
});
['click', 'keyup'].forEach(ev => mdInput.addEventListener(ev, e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
  const i = slideAtCursor();
  if (i !== previewV.index) previewV.set(previewV.slides, i);
}));
titleInput.addEventListener('input', () => setDirty(true));
$('saveBtn').onclick = saveDeck;
$('newBtn').onclick = () => openEditor(null);
$('backBtn').onclick = () => {
  if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
  renderHome();
};

/* ---------- Presenter / Full screen ---------- */
function enterPresent(startIndex, d) {
  if (view === 'presenter') return;
  if (view === 'editor') {
    returnView = 'editor';
    presenterV.set(splitSlides(mdInput.value), startIndex ?? previewV.index);
  } else {
    presenterV.set(splitSlides(d.content), startIndex ?? 0);
  }
  show('presenter');
  const req = document.documentElement.requestFullscreen;
  if (req) req.call(document.documentElement).catch(() => {});
}

function exitPresent() {
  if (view !== 'presenter') return;
  const idx = presenterV.index;
  if (returnView === 'editor') { show('editor'); previewV.set(previewV.slides, idx); }
  else renderHome();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

// Pressing Esc (browser exits full screen) should also leave presentation mode
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && view === 'presenter') exitPresent();
});

/* Keyboard shortcuts*/
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {   // Ctrl+S
    e.preventDefault();
    saveDeck();
    return;
  }
  if (e.key === 'F11') {                                           // F11
    e.preventDefault();
    if (view === 'editor') enterPresent();
    else if (view === 'presenter') exitPresent();
    return;
  }
  if (view === 'home') return;
  const tag = e.target.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return;               // keep arrows for typing
  const active = view === 'presenter' ? presenterV : previewV;
  if (e.key === 'ArrowRight') { e.preventDefault(); active.go(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); active.go(-1); }
});

window.addEventListener('beforeunload', e => {
  if (view === 'editor' && dirty) { e.preventDefault(); e.returnValue = ''; }
});

renderHome();
