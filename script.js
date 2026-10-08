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
  try{
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
  link.download = 'pastezone.txt';
  link.click();
  setTimeout(function(){ URL.revokeObjectURL(link.href); }, 1000);
  toast('Downloaded ' + link.download, 'arrow-down-to-line');
}

// ---------- Init ----------
var storedValue = readStore(key);
if (storedValue) zone.value = storedValue;
setAnimStyle(animStyle);
if (!plain && zone.value){
  // Fade the saved text in on load.
  marks = [{start:0, end:zone.value.length, t:performance.now(), bulk:true}];
  renderMirror(performance.now());
  scheduleCleanup();
}
document.body.classList.toggle('empty', zone.value === '');
updateStats();
zone.focus();
