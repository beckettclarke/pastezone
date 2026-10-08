var zone = document.getElementById('zone');
var statsEl = document.getElementById('stats');

function cLog(m,c){
  console.log("%cFoxJS","color: white; background: " + c + "; padding: 2px 6px; border-radius: 3px; margin-right: 5px;",m);
}

// ---------- Storage ----------
function readStore(key){
  try{ return localStorage.getItem(key); }catch(e){ return null; }
}
function writeStore(key, value){
  try{ localStorage.setItem(key, value); return true; }catch(e){ return false; }
}

var key = 'pastezone';
var saveTimer = null;
var saveFailed = false;
function savezone(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){
    if (writeStore(key, zone.value)){
      saveFailed = false;
      cLog('Synced Pastezone with local storage','darkgreen');
    } else if (!saveFailed){
      saveFailed = true;
      toast('Too large to save in this browser — export it to keep it', 'circle-exclamation', {error:true, duration:5000});
    }
  }, 250);
}

// ---------- Editing ----------
// Changes go through execCommand so they land in the browser's own undo history (⌘Z / ⌘⇧Z).
function replaceRange(start, end, text){
  if (start === end && !text) return;
  zone.focus({preventScroll:true});
  zone.setSelectionRange(start, end);
  var ok = false;
  // execCommand acts on whatever has focus, so only use it if the textarea really got it
  // (it can't while the Markdown preview hides it).
  if (document.activeElement === zone) try{
    ok = text ? document.execCommand('insertText', false, text) : document.execCommand('delete');
  }catch(e){}
  if (!ok){
    zone.setRangeText(text, start, end, 'end');
    zone.dispatchEvent(new Event('input', {bubbles:true}));
  }
}
function setzone(newValue){
  replaceRange(0, zone.value.length, newValue);
}

// ---------- Typing animation ----------
// #mirror renders the text under a transparent textarea. Only the characters inserted by
// the latest edits get wrapped in a short-lived <span>, so typing animates char by char
// while the rest of the document stays as plain text nodes.
var editor = document.getElementById('editor');
var mirror = document.getElementById('mirror');
var ANIM_MS = 650;          // keep in sync with the CSS animation length
var BULK_CHARS = 300;       // bigger insertions (pastes, tools) fade in as one block
var PLAIN_ABOVE = 50000;    // past this many chars, skip the mirror and use a plain textarea
var PLAIN_BELOW = 45000;    // ...and come back once it shrinks below this (avoids flip-flopping)
var animStyle = document.body.dataset.anim;
var plain = true;
var marks = [];
var lastValue = '';

function setPlain(on){
  if (on === plain) return;
  var top = on ? editor.scrollTop : zone.scrollTop;
  plain = on;
  document.body.classList.toggle('plain', on);
  if (on){
    mirror.textContent = '';
    zone.scrollTop = top;
  } else {
    renderMirror(performance.now());
    editor.scrollTop = top;
  }
}

function trackEdit(){
  var prev = lastValue, next = zone.value;
  lastValue = next;
  var len = next.length;
  var wantPlain = animStyle === 'off' || len > PLAIN_ABOVE || (plain && len > PLAIN_BELOW);
  if (wantPlain){ marks = []; setPlain(true); return; }

  // Find the edited region: common prefix, then common suffix.
  var max = Math.min(prev.length, len), p = 0, s = 0;
  while (p < max && prev.charCodeAt(p) === next.charCodeAt(p)) p++;
  while (s < max - p && prev.charCodeAt(prev.length - 1 - s) === next.charCodeAt(len - 1 - s)) s++;
  var removedEnd = prev.length - s;
  var inserted = len - s - p;
  var shift = len - prev.length;
  var now = performance.now();

  marks = marks.filter(function(m){
    return now - m.t < ANIM_MS && (m.end <= p || m.start >= removedEnd);
  });
  marks.forEach(function(m){
    if (m.start >= removedEnd){ m.start += shift; m.end += shift; }
  });
  if (inserted > 0) marks.push({start:p, end:p + inserted, t:now, bulk:inserted > BULK_CHARS});
  if (marks.length > 120) marks = marks.slice(-120);

  if (plain) setPlain(false);
  else renderMirror(now);
  scheduleCleanup();
}

function renderMirror(now){
  var text = zone.value;
  var frag = document.createDocumentFragment();
  var pos = 0;
  marks.sort(function(a, b){ return a.start - b.start; });
  marks.forEach(function(m){
    if (m.start > pos) frag.append(text.slice(pos, m.start));
    var span = document.createElement('span');
    span.className = m.bulk ? 'pz-bulk' : 'pz-new';
    // A negative delay resumes the animation where it was, so re-renders don't restart it.
    span.style.animationDelay = -(now - m.t) + 'ms';
    span.textContent = text.slice(m.start, m.end);
    frag.append(span);
    pos = m.end;
  });
  // The zero-width space keeps a trailing newline's empty line the same height as in the textarea.
  frag.append(text.slice(pos) + '\u200b');
  mirror.replaceChildren(frag);
}

// Once every animation has finished, drop the spans so the mirror is one text node again.
var cleanupTimer = null;
function scheduleCleanup(){
  clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(function(){
    if (!marks.length || plain) return;
    marks = [];
    renderMirror(performance.now());
  }, ANIM_MS + 50);
}

function setAnimStyle(style){
  animStyle = style;
  document.body.dataset.anim = style;
  marks = [];
  lastValue = zone.value;
  var len = zone.value.length;
  setPlain(style === 'off' || len > PLAIN_ABOVE);
}

// ---------- Stats ----------
function countWords(text){
  var words = 0, inWord = false;
  for (var i = 0; i < text.length; i++){
    var c = text.charCodeAt(i);
    var space = c === 32 || c === 10 || c === 9 || c === 13 || c === 160;
    if (!space && !inWord) words++;
    inWord = !space;
  }
  return words;
}
function plural(n, word){
  return n.toLocaleString() + ' ' + word + (n === 1 ? '' : 's');
}
var statsTimer = null;
function updateStats(){
  clearTimeout(statsTimer);
  statsTimer = setTimeout(function(){
    var text = zone.value;
    statsEl.textContent = text ? plural(countWords(text), 'word') + ' · ' + plural(text.length, 'char') : '';
  }, 120);
}

function onChange(){
  trackEdit();
  renderPreview();
  document.body.classList.toggle('empty', zone.value === '');
  updateStats();
  savezone();
}
zone.addEventListener('input', onChange);

// ---------- Toasts ----------
var toastsEl = document.getElementById('toasts');
function toast(message, icon, opts){
  opts = opts || {};
  var el = document.createElement('div');
  el.className = 'toast' + (opts.error ? ' error' : '');
  var i = document.createElement('i');
  i.className = 'far fa-' + (icon || 'check');
  var span = document.createElement('span');
  span.textContent = message;
  el.append(i, span);
  if (opts.action){
    var b = document.createElement('button');
    b.textContent = opts.action.label;
    b.onclick = function(){ opts.action.fn(); dismiss(); };
    el.append(b);
  }
  while (toastsEl.children.length >= 3) toastsEl.firstChild.remove();
  toastsEl.append(el);
  var timer = setTimeout(dismiss, opts.duration || 2400);
  function dismiss(){
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(function(){ el.remove(); }, 250);
  }
  return el;
}

// ---------- Markdown ----------
var preview = document.getElementById('preview');
var mdBtn = document.getElementById('md-btn');
var markdownOn = false;
var mdLibs = null;

function loadScript(src){
  return new Promise(function(resolve, reject){
    var el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = reject;
    document.head.append(el);
  });
}
function loadMarkdownLibs(){
  if (!mdLibs){
    mdLibs = Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js')
    ]).then(function(){
      marked.setOptions({gfm:true, breaks:true});
      DOMPurify.addHook('afterSanitizeAttributes', function(node){
        if (node.tagName === 'A'){ node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
      });
    }, function(err){
      mdLibs = null;
      throw err;
    });
  }
  return mdLibs;
}

function renderPreview(){
  if (!markdownOn || !window.marked) return;
  if (!zone.value.trim()){
    preview.innerHTML = '<p class="md-empty">Nothing to preview yet. Double-click to start writing.</p>';
    return;
  }
  preview.innerHTML = DOMPurify.sanitize(marked.parse(zone.value));
  // Stagger the first few blocks in; the rest just appear.
  for (var i = 0; i < Math.min(preview.children.length, 24); i++) preview.children[i].style.setProperty('--i', i);
}

function setMarkdown(on, quiet){
  markdownOn = on;
  writeStore('pastezone-md', on ? '1' : '0');
  mdBtn.setAttribute('aria-pressed', on);
  if (!on){
    document.body.classList.remove('md');
    preview.hidden = true;
    preview.innerHTML = '';
    zone.focus({preventScroll:true});
    return;
  }
  loadMarkdownLibs().then(function(){
    if (!markdownOn) return;
    renderPreview();
    preview.hidden = false;
    preview.scrollTop = 0;
    document.body.classList.add('md');
  }, function(){
    setMarkdown(false);
    if (!quiet) toast("Couldn't load the Markdown renderer — are you offline?", 'circle-exclamation', {error:true});
  });
}
function toggleMarkdown(){ setMarkdown(!markdownOn); }

preview.addEventListener('dblclick', function(){ setMarkdown(false); });
document.addEventListener('keydown', function(e){
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'e'){
    e.preventDefault();
    toggleMarkdown();
  }
});

// ---------- Menus ----------
var openMenuName = null;
function toggleMenu(name){
  if (openMenuName === name) closeMenus();
  else openMenu(name);
}
function openMenu(name){
  closeMenus();
  openMenuName = name;
  document.getElementById(name).classList.add('open');
  document.getElementById(name + '-btn').classList.add('on');
  document.body.classList.add('menu-open');
  if (name === 'tools'){
    showReplace(false);
    toolSearch.value = '';
    filterTools();
    if (matchMedia('(hover:hover)').matches) toolSearch.focus();
  }
}
function closeMenus(){
  if (!openMenuName) return;
  document.getElementById(openMenuName).classList.remove('open');
  document.getElementById(openMenuName + '-btn').classList.remove('on');
  document.body.classList.remove('menu-open');
  openMenuName = null;
}
document.addEventListener('pointerdown', function(e){
  if (openMenuName && !e.target.closest('.pop, #btns')) closeMenus();
});
document.addEventListener('keydown', function(e){
  var k = e.key.toLowerCase();
  if (e.key === 'Escape' && openMenuName){
    closeMenus();
    zone.focus();
  } else if ((e.metaKey || e.ctrlKey) && k === 'k'){
    e.preventDefault();
    toggleMenu('tools');
  }
});

// ---------- Tools ----------
var closeAfterRun = true;

// Runs fn on the selection if there is one, otherwise on everything.
function transformText(fn, label){
  var s = zone.selectionStart, e = zone.selectionEnd;
  var whole = s === e;
  if (whole){ s = 0; e = zone.value.length; }
  var input = zone.value.slice(s, e);
  if (!input) return toast('Nothing to ' + label.toLowerCase(), 'circle-exclamation');
  var out;
  try{ out = fn(input); }catch(err){ return toast(err.message || "Couldn't " + label.toLowerCase(), 'circle-exclamation', {error:true}); }
  if (out === input) return toast('No changes', 'circle-check');
  replaceRange(s, e, out);
  if (!whole) zone.setSelectionRange(s, s + out.length);
  toast(label + (whole ? '' : ' (selection)'), 'check');
}

function lines(fn){
  return function(text){ return fn(text.split(/\r?\n/)).join('\n'); };
}
var collator = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'});

function base64EncodeText(text){
  var bytes = new TextEncoder().encode(text), bin = '';
  for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function base64DecodeText(text){
  var bin;
  try{ bin = atob(text.replace(/\s+/g, '')); }catch(e){ throw new Error("That isn't valid Base64"); }
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

var TOOLS = [
  {group:'Text', id:'speak', name:'Read aloud', icon:'volume', run:speakZone},
  {group:'Text', id:'stats', name:'Word count', icon:'tally', run:wordCount},
  {group:'Text', id:'replace', name:'Find & replace', icon:'magnifying-glass', keep:true, run:function(){ showReplace(true); }},

  {group:'Transform', id:'upper', name:'UPPERCASE', glyph:'AA', run:function(){ transformText(function(t){ return t.toUpperCase(); }, 'Uppercased'); }},
  {group:'Transform', id:'lower', name:'lowercase', glyph:'aa', run:function(){ transformText(function(t){ return t.toLowerCase(); }, 'Lowercased'); }},
  {group:'Transform', id:'title', name:'Title Case', glyph:'Aa', run:function(){
    transformText(function(t){
      return t.toLowerCase().replace(/(^|[\s\-\/("'\[])(\p{L})/gu, function(m, a, b){ return a + b.toUpperCase(); });
    }, 'Title cased');
  }},
  {group:'Transform', id:'breaks', name:'Remove line breaks', icon:'arrow-turn-down-left', run:function(){
    transformText(function(t){ return t.replace(/[ \t]*(\r\n|\n|\r)+[ \t]*/g, ' '); }, 'Removed line breaks');
  }},
  {group:'Transform', id:'trim', name:'Trim whitespace', icon:'broom', run:function(){
    transformText(function(t){ return t.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim(); }, 'Trimmed whitespace');
  }},
  {group:'Transform', id:'sort', name:'Sort lines', icon:'arrow-down-a-z', run:function(){
    transformText(lines(function(l){ return l.sort(collator.compare); }), 'Sorted lines');
  }},

  {group:'Encode', id:'urlenc', name:'URL encode', icon:'link', run:function(){ transformText(encodeURI, 'URL encoded'); }},
  {group:'Encode', id:'urldec', name:'URL decode', icon:'link-slash', run:function(){
    transformText(function(t){ try{ return decodeURI(t); }catch(e){ throw new Error("That isn't valid URL encoding"); } }, 'URL decoded');
  }},
  {group:'Encode', id:'b64enc', name:'Base64 encode', icon:'symbols', run:function(){ transformText(base64EncodeText, 'Base64 encoded'); }},
  {group:'Encode', id:'b64dec', name:'Base64 decode', icon:'lock-open', run:function(){ transformText(base64DecodeText, 'Base64 decoded'); }},
  {group:'Encode', id:'json', name:'Format JSON', icon:'brackets-curly', run:function(){
    transformText(function(t){
      try{ return JSON.stringify(JSON.parse(t), null, 2); }catch(e){ throw new Error("That isn't valid JSON"); }
    }, 'Formatted JSON');
  }},
  {group:'Encode', id:'jsonmin', name:'Minify JSON', icon:'brackets-square', run:function(){
    transformText(function(t){
      try{ return JSON.stringify(JSON.parse(t)); }catch(e){ throw new Error("That isn't valid JSON"); }
    }, 'Minified JSON');
  }}
];

var toolGrid = document.getElementById('tool-grid');
var toolSearch = document.getElementById('tool-search');
var toolEmpty = document.getElementById('tool-empty');

function buildTools(){
  var group = null;
  TOOLS.forEach(function(t){
    if (t.group !== group){
      group = t.group;
      var label = document.createElement('div');
      label.className = 'group-label';
      label.dataset.group = group;
      label.textContent = group;
      toolGrid.append(label);
    }
    var b = document.createElement('button');
    b.className = 'tile';
    b.dataset.group = t.group;
    b.dataset.tool = t.id;
    var ico = document.createElement('span');
    ico.className = 'ico';
    if (t.glyph){
      ico.innerHTML = '<span class="glyph"></span>';
      ico.firstChild.textContent = t.glyph;
    } else {
      ico.innerHTML = '<i class="far fa-' + t.icon + '"></i>';
    }
    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = t.name;
    b.append(ico, name);
    b.onclick = function(){ runTool(t, b); };
    t.el = b;
    toolGrid.append(b);
  });
}

function runTool(t, el){
  t.run();
  el.classList.remove('done');
  void el.offsetWidth;
  el.classList.add('done');
  if (!t.keep && closeAfterRun) closeMenus();
}

function filterTools(){
  var q = toolSearch.value.trim().toLowerCase();
  var shown = {};
  var any = false;
  TOOLS.forEach(function(t){
    var match = !q || (t.name + ' ' + t.group).toLowerCase().indexOf(q) !== -1;
    t.el.hidden = !match;
    t.el.classList.toggle('hit', !!q && match && !any);
    if (match){ shown[t.group] = true; any = true; }
  });
  toolGrid.querySelectorAll('.group-label').forEach(function(l){ l.hidden = !shown[l.dataset.group]; });
  toolEmpty.hidden = any;
}
toolSearch.addEventListener('input', filterTools);
toolSearch.addEventListener('keydown', function(e){
  if (e.key !== 'Enter') return;
  var first = TOOLS.find(function(t){ return !t.el.hidden; });
  if (first) runTool(first, first.el);
});

function wordCount(){
  var text = zone.value;
  var words = countWords(text);
  var lineCount = text ? text.split('\n').length : 0;
  var minutes = Math.max(1, Math.round(words / 230));
  toast(plural(words, 'word') + ' · ' + plural(text.length, 'character') + ' · ' + plural(lineCount, 'line') + (words ? ' · ~' + minutes + ' min read' : ''), 'tally', {duration:5000});
}

function speakZone(){
  var tile = TOOLS[0].el;
  if (speechSynthesis.speaking){
    speechSynthesis.cancel();
    return;
  }
  var text = zone.value.slice(zone.selectionStart, zone.selectionEnd) || zone.value;
  if (!text.trim()) return toast('Nothing to read', 'circle-exclamation');
  var utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = utterance.onerror = function(){
    tile.querySelector('.name').textContent = 'Read aloud';
    tile.querySelector('i').className = 'far fa-volume';
  };
  speechSynthesis.speak(utterance);
  tile.querySelector('.name').textContent = 'Stop reading';
  tile.querySelector('i').className = 'far fa-stop';
  toast('Reading aloud', 'volume', {action:{label:'Stop', fn:function(){ speechSynthesis.cancel(); }}});
}

// Find & replace
var replaceFind = document.getElementById('replace-find');
var replaceWith = document.getElementById('replace-with');
var replaceCount = document.getElementById('replace-count');
function showReplace(show){
  document.getElementById('tools-main').hidden = show;
  document.getElementById('replace-panel').hidden = !show;
  if (show){
    var sel = zone.value.slice(zone.selectionStart, zone.selectionEnd);
    if (sel && sel.indexOf('\n') === -1) replaceFind.value = sel;
    updateReplaceCount();
    replaceFind.focus();
    replaceFind.select();
  }
}
function countMatches(find){
  if (!find) return 0;
  var n = 0, i = zone.value.indexOf(find);
  while (i !== -1){ n++; i = zone.value.indexOf(find, i + find.length); }
  return n;
}
function updateReplaceCount(){
  var f = replaceFind.value;
  replaceCount.textContent = f ? plural(countMatches(f), 'match').replace('matchs', 'matches') : '';
}
replaceFind.addEventListener('input', updateReplaceCount);
function doReplace(){
  var find = replaceFind.value;
  if (!find) return replaceFind.focus();
  var n = countMatches(find);
  if (!n) return toast('No matches for “' + find + '”', 'circle-exclamation');
  setzone(zone.value.split(find).join(replaceWith.value));
  toast('Replaced ' + plural(n, 'match').replace('matchs', 'matches'), 'magnifying-glass');
  replaceFind.value = replaceWith.value = '';
  closeMenus();
}

// ---------- Settings ----------
var DEFAULTS = {
  accent:'#7cc4ff',
  font:'sans',
  size:18,
  leading:1.7,
  width:760,
  dim:0.42,
  blur:28,
  anim:'glow',
  pinBar:false,
  spellcheck:false,
  closeAfterRun:true
};
var FONTS = {
  sans:'"Satoshi", system-ui, sans-serif',
  serif:'"Newsreader", Georgia, serif',
  mono:'"JetBrains Mono", ui-monospace, monospace'
};
var FORMAT = {
  size:function(v){ return v + 'px'; },
  leading:function(v){ return (+v).toFixed(2); },
  width:function(v){ return v + 'px'; },
  dim:function(v){ return Math.round(v * 100) + '%'; },
  blur:function(v){ return v + 'px'; }
};
if (matchMedia('(prefers-reduced-motion: reduce)').matches) DEFAULTS.anim = 'off';
var settings = Object.assign({}, DEFAULTS);
try{ Object.assign(settings, JSON.parse(readStore('pastezone-settings')) || {}); }catch(e){}

function applySettings(){
  var root = document.documentElement.style;
  root.setProperty('--accent', settings.accent);
  root.setProperty('--font', FONTS[settings.font] || FONTS.sans);
  root.setProperty('--size', settings.size + 'px');
  root.setProperty('--leading', settings.leading);
  root.setProperty('--measure', settings.width + 'px');
  root.setProperty('--dim', settings.dim);
  root.setProperty('--blur', settings.blur + 'px');
  document.body.classList.toggle('pin-bar', settings.pinBar);
  zone.spellcheck = settings.spellcheck;
  closeAfterRun = settings.closeAfterRun;
  if (settings.anim !== animStyle) setAnimStyle(settings.anim);
  syncSettingsUI();
}

function syncSettingsUI(){
  document.querySelectorAll('#settings [data-setting]').forEach(function(el){
    var k = el.dataset.setting, v = settings[k];
    if (el.type === 'range'){
      el.value = v;
      el.style.setProperty('--fill', ((v - el.min) / (el.max - el.min) * 100) + '%');
      var out = document.querySelector('#settings output[data-for="' + k + '"]');
      if (out) out.textContent = FORMAT[k](v);
    } else if (el.classList.contains('check')){
      el.classList.toggle('on', !!v);
      el.setAttribute('aria-pressed', !!v);
    } else {
      el.querySelectorAll('button').forEach(function(b){
        b.classList.toggle('on', b.dataset.value === v);
        b.setAttribute('aria-pressed', b.dataset.value === v);
      });
    }
  });
}

function setSetting(k, v){
  settings[k] = v;
  applySettings();
  writeStore('pastezone-settings', JSON.stringify(settings));
}

function resetSettings(){
  settings = Object.assign({}, DEFAULTS);
  applySettings();
  writeStore('pastezone-settings', JSON.stringify(settings));
  toast('Settings reset', 'arrows-rotate');
}

document.querySelectorAll('#settings [data-setting]').forEach(function(el){
  var k = el.dataset.setting;
  if (el.type === 'range'){
    el.addEventListener('input', function(){ setSetting(k, parseFloat(el.value)); });
  } else if (el.classList.contains('check')){
    el.addEventListener('click', function(){ setSetting(k, !settings[k]); });
  } else {
    el.addEventListener('click', function(e){
      var b = e.target.closest('button');
      if (b) setSetting(k, b.dataset.value);
    });
  }
});

// ---------- Actions ----------
function copyZText(){
  if (!zone.value) return toast('Nothing to copy', 'circle-exclamation');
  var done = function(){ toast('Copied to clipboard', 'clone'); };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(zone.value).then(done, legacyCopy);
  } else {
    legacyCopy();
  }
  function legacyCopy(){
    var s = zone.selectionStart, e = zone.selectionEnd;
    zone.select();
    document.execCommand('copy');
    zone.setSelectionRange(s, e);
    done();
  }
}

function clearZone(){
  if (!zone.value) return toast('Already empty', 'circle-check');
  var previous = zone.value;
  setzone('');
  toast('Cleared', 'trash', {duration:6000, action:{label:'Undo', fn:function(){ setzone(previous); }}});
}

function exportTXT(){
  if (!zone.value) return toast('Nothing to export', 'circle-exclamation');
  var link = document.createElement('a');
  var file = new Blob([zone.value], {type:'text/plain'});
  link.href = URL.createObjectURL(file);
  link.download = markdownOn ? 'pastezone.md' : 'pastezone.txt';
  link.click();
  setTimeout(function(){ URL.revokeObjectURL(link.href); }, 1000);
  toast('Downloaded ' + link.download, 'arrow-down-to-line');
}

// ---------- Init ----------
var storedValue = readStore(key);
if (storedValue) zone.value = storedValue;
buildTools();
setAnimStyle(settings.anim);
applySettings();
if (readStore('pastezone-md') === '1') setMarkdown(true, true);
if (!plain && zone.value){
  // Fade the saved text in on load.
  marks = [{start:0, end:zone.value.length, t:performance.now(), bulk:true}];
  renderMirror(performance.now());
  scheduleCleanup();
}
document.body.classList.toggle('empty', zone.value === '');
updateStats();
zone.focus();
