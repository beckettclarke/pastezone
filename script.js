var zone = document.getElementById('zone');


// BEGIN CHATGPT CODE - Adds undo/redo functionality for tool actions
// undo/redo stacks for programmatic changes (kept separate from native browser undo)
var undoStack = [];
var redoStack = [];
var UNDO_LIMIT = 100;

function pushUndoState(value, start, end){
  undoStack.push({value: value, start: start, end: end});
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  // new programmatic change invalidates redo history
  redoStack = [];
}

function setzone(newValue, opts){
  opts = opts || {};
  var push = opts.push !== false; // default true
  var selStart = (typeof opts.selStart === 'number') ? opts.selStart : null;
  var selEnd = (typeof opts.selEnd === 'number') ? opts.selEnd : null;
  if (push){
    try{ pushUndoState(zone.value, zone.selectionStart, zone.selectionEnd); }catch(e){ pushUndoState(zone.value, 0, 0); }
  }
  zone.value = newValue;
  savezone();
  if (selStart !== null){
    try{ zone.selectionStart = selStart; zone.selectionEnd = selEnd; }catch(e){}
  }
}

function undo(){
  if (!undoStack.length) return false;
  // push current state to redo
  try{ redoStack.push({value: zone.value, start: zone.selectionStart, end: zone.selectionEnd}); }catch(e){ redoStack.push({value: zone.value, start: 0, end: 0}); }
  var state = undoStack.pop();
  setzone(state.value, {push:false, selStart: state.start, selEnd: state.end});
  return true;
}

function redo(){
  if (!redoStack.length) return false;
  try{ undoStack.push({value: zone.value, start: zone.selectionStart, end: zone.selectionEnd}); }catch(e){ undoStack.push({value: zone.value, start: 0, end: 0}); }
  var state = redoStack.pop();
  setzone(state.value, {push:false, selStart: state.start, selEnd: state.end});
  return true;
}
document.addEventListener('keydown', function(e){
  var key = e.key ? e.key.toLowerCase() : '';
  if ((e.ctrlKey || e.metaKey) && key === 'z'){
    if (e.shiftKey){
      if (redoStack.length){ e.preventDefault(); redo(); }
    } else {
      if (undoStack.length){ e.preventDefault(); undo(); }
    }
  }
});
// END CHATGPT


var key = 'pastezone';
var storedValue = localStorage.getItem(key);
function savezone(){
  localStorage.setItem(key, zone.value);
  cLog('Synced Pastezone with local storage','darkgreen');
}
if (storedValue){
  zone.value = storedValue;
}
zone.addEventListener('input', function (){
  savezone();
});

function cLog(m,c){
  console.log("%cFoxJS","color: white; background: " + c + "; padding: 2px 6px; border-radius: 3px; margin-right: 5px;",m);
}

function wordCount() {
 cLog('Starting word count...','darkviolet');
 var text = zone.value;
 var wcount = 0;
 var split = text.split(' ');
 for (var i = 0; i < split.length; i++) {
  if (split[i] != "") {
   wcount ++;
  }
 }
 Swal.fire(
  'Word count',
  'Your text has ' + wcount + ' words.',
  'info'
);
cLog('Counted ' + wcount + 'words','darkgreen');
}
function clearZone(){
Swal.fire({
  title: 'Clear PasteZone?',
  text: 'You won\'t be able to revert this!',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonColor: '#2eb00b',
  cancelButtonColor: '#d33',
  confirmButtonText: 'Yes, clear it!'
}).then((result) => {
  if (result.isConfirmed) {
      setzone('');
    Swal.fire(
      'Success!',
      'Your PasteZone has been cleared.',
      'success'
    );
  }
});
}

function copyZText(){
  /* Selects text */ zone.select();
  /* Copies text */ document.execCommand('copy');
  /* De-selects text */ window.getSelection().removeAllRanges();
  Swal.fire('Success!','Pastezone has been copied to clipboard.','success');
}

function speakZone(){
  let utterance = new SpeechSynthesisUtterance(zone.value);
  speechSynthesis.speak(utterance);
  Swal.fire('Success!','Reading your PasteZone.','success');
}

function tool(f,e){
  var p1=e.querySelector('.p1');
  var p2=e.querySelector('.p2');
  var p3=e.querySelector('.p3');
  p1.classList.remove('show');
  p2.classList.add('show');
  eval(f+'()');
  setTimeout(function(){
    p1.classList.remove('show');
    p2.classList.remove('show');
    p3.classList.add('show');
    setTimeout(function(){
      p3.classList.remove('show');
      p1.classList.add('show');
    },1000);
  },500);
  if (document.getElementById('toolscontent').classList.contains('cwr')){
    document.getElementById('toolsc').classList.remove('active');
  }
}

function exportTXT(){
  const link = document.createElement("a");
  const file = new Blob([zone.value], { type: 'text/plain' });
  link.href = URL.createObjectURL(file);
  link.download = "pastezone.txt";
  link.click();
  URL.revokeObjectURL(link.href);
  Swal.fire('Downloaded!','Your pastezone has been downloaded','success');
}

function urlEncode(){
  setzone(encodeURI(zone.value));
}
function urlDecode(){
  setzone(decodeURI(zone.value));
}

function base64Encode(){
  setzone(btoa(zone.value));
}
function base64Decode(){
  setzone(atob(zone.value));
}

function removeLineBreaks(){
  setzone(zone.value.replace(/(\r\n|\n|\r)/gm," "));
}
