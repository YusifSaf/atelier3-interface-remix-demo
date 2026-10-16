
// parameters to change
const CONFIG = {
  stepScrollPx: 120,      //how far the feed moves per step
  threshold: 1.6,         //how much to shake to count it as a step 
  minStepMs: 280,         //ignore shakes closer together than this ( to stop double counts)
  baselineSmoothing: 0.02 // how slowly the resting level adapts
};

const PALETTES = [
  ["#ff9a9e", "#fad0c4"], ["#a18cd1", "#fbc2eb"], ["#84fab0", "#8fd3f4"],
  ["#fccb90", "#d57eeb"], ["#e0c3fc", "#8ec5fc"], ["#f6d365", "#fda085"],
  ["#43e97b", "#38f9d7"], ["#fa709a", "#fee140"]
];
const SCENES = ["🌅", "🏔️", "🌊", "🌆", "🌲", "🏖️", "🌃", "🚲", "🍜", "☕", "🐕", "🌸"];
const USERS = ["maya.walks", "leo_in_motion", "sunny.side", "nora.snaps", "kai.explores", "juniper.day"];
const CAPTIONS = [
  "Golden hour never gets old.", "Took the long way home today.",
  "Coffee first, everything else later.", "Found this spot by accident.",
  "Weekend mood.", "Not all who wander are lost.",
  "Fresh air, clear head.", "Sunday reset."
];

const feed = document.getElementById("feed");
let postCount = 0;

function makePost(i) {
  const [c1, c2] = PALETTES[i % PALETTES.length];
  const scene = SCENES[(i * 5) % SCENES.length];
  const user = USERS[(i * 3) % USERS.length];
  const caption = CAPTIONS[(i * 7) % CAPTIONS.length];
  const likes = 120 + ((i * 937) % 4800);
  const hours = 1 + ((i * 3) % 22);

  const el = document.createElement("article");
  el.className = "post";
  el.innerHTML = `
    <div class="post-head">
      <div class="avatar">${scene}</div>
      <span class="username">${user}</span>
    </div>
    <div class="photo" style="background: linear-gradient(135deg, ${c1}, ${c2})">${scene}</div>
    <div class="actions"><span>♡</span><span>💬</span><span>➤</span></div>
    <div class="likes">${likes.toLocaleString()} likes</div>
    <div class="caption"><b>${user}</b>${caption}</div>
    <div class="time">${hours} hours ago</div>
  `;
  return el;
}

//The infinite loop
function fillFeed() {
  while (feed.scrollHeight < pos + feed.clientHeight * 3) {
    for (let k = 0; k < 4; k++) feed.appendChild(makePost(postCount++));
  }
}

let pos = 0;     // where the feed is right now
let target = 0;  // where it is heading

function animate() {
  if (Math.abs(target - pos) > 0.5) {
    pos += (target - pos) * 0.18;   // ease toward the target
    feed.scrollTop = pos;
  }
  requestAnimationFrame(animate);
}

let steps = 0;
function registerStep() {
  steps++;
  target += CONFIG.stepScrollPx;
  fillFeed();
  const dbg = document.getElementById("dbgSteps");
  if (dbg) dbg.textContent = steps;
}

//Step detection
let baseline = 9.81;   // starts at gravity and adapts over time
let armed = true;      // true = ready to count the next spike
let lastStepAt = 0;
let gotMotionData = false;

function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  gotMotionData = true;

  const magnitude = Math.hypot(a.x, a.y, a.z); // total acceleration in any direction
  baseline += CONFIG.baselineSmoothing * (magnitude - baseline); // slow moving average
  const delta = magnitude - baseline; // how far above resting we are, to subtract and figure out if the step was taken or not

  const now = performance.now();
  if (armed && delta > CONFIG.threshold && now - lastStepAt > CONFIG.minStepMs) {
    registerStep();
    armed = false;   // wait for the shake to die down before counting again
    lastStepAt = now;
  } else if (!armed && delta < CONFIG.threshold * 0.4) {
    armed = true;
  }

  const dbgDelta = document.getElementById("dbgDelta");
  if (dbgDelta) dbgDelta.textContent = delta.toFixed(2);
}

// Helpers
function toast(msg, ms = 4000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), ms);
}

async function keepScreenAwake() {
  try { await navigator.wakeLock.request("screen"); } catch (_) { /* not supported: fine */ }
}

//
async function startWalking() {
  const msg = document.getElementById("startMsg");

  if (!window.isSecureContext) {
    msg.textContent = "Motion sensors need HTTPS. Open the https:// link.";
    return;
  }

  try {
    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      const result = await DeviceMotionEvent.requestPermission(); // iOS shows a popup
      if (result !== "granted") {
        msg.textContent = "Motion access was denied. Reload the page and tap Allow.";
        return;
      }
    }
  } catch (err) {
    msg.textContent = "Could not get motion access: " + err.message;
    return;
  }

  window.addEventListener("devicemotion", onMotion);
  document.getElementById("start").hidden = true;
  keepScreenAwake();

  // If nothing arrives after a moment, this isn't a phone (or sensors are off).
  setTimeout(() => {
    if (!gotMotionData) toast("No motion data. On a computer, press Space or ↓ to fake a step.");
  }, 1500);
}

document.getElementById("startBtn").addEventListener("click", startWalking);

// Desktop testing Space / Down arrow to take one step
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowDown") {
    e.preventDefault();
    registerStep();
  }
});

// Debug panel (add ?debug=1 to the URL)
if (new URLSearchParams(location.search).has("debug")) {
  document.getElementById("debug").hidden = false;
  const thr = document.getElementById("thr");
  const px = document.getElementById("px");
  thr.value = CONFIG.threshold;
  px.value = CONFIG.stepScrollPx;
  const sync = () => {
    CONFIG.threshold = parseFloat(thr.value);
    CONFIG.stepScrollPx = parseInt(px.value, 10);
    document.getElementById("thrVal").textContent = CONFIG.threshold.toFixed(1);
    document.getElementById("pxVal").textContent = CONFIG.stepScrollPx;
  };
  thr.addEventListener("input", sync);
  px.addEventListener("input", sync);
  sync();
}

fillFeed();
animate();
