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
document.body.classList.toggle('empty', zone.value === '');
updateStats();
zone.focus();
