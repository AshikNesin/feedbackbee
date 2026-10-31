// FeedbackBee site: copy buttons, the setup tabs and the demo player.
document.querySelectorAll(".copy").forEach(function (btn) {
  var timer;
  btn.addEventListener("click", function () {
    var text = btn.previousElementSibling.textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
      function () {
        btn.classList.add("done");
        btn.setAttribute("aria-label", "Copied");
        clearTimeout(timer);
        timer = setTimeout(function () {
          btn.classList.remove("done");
          btn.setAttribute("aria-label", "Copy");
        }, 1600);
      },
      function () {},
    );
  });
});
// Demo: one play button over the poster, then the browser's own controls (fullscreen and all).
// Without the script the native controls are there from the start. Home page only.
var v = document.querySelector(".demo video");
var playBtn = document.querySelector(".play-overlay");
if (v && playBtn) {
  v.controls = false;
  playBtn.addEventListener("click", function () {
    v.play().catch(function () {});
  });
  v.addEventListener("play", function () {
    playBtn.hidden = true;
    v.controls = true;
  });
  v.addEventListener("ended", function () {
    playBtn.hidden = false;
    v.controls = false;
  });
}

// Setup tabs: one panel at a time with the script (all three, labeled, without it).
var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
function selectTab(tab, focus) {
  tabs.forEach(function (t) {
    var on = t === tab;
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
}
tabs.forEach(function (tab, i) {
  tab.addEventListener("click", function () {
    selectTab(tab, false);
  });
  tab.addEventListener("keydown", function (e) {
    var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    selectTab(tabs[(i + step + tabs.length) % tabs.length], true);
  });
});
if (tabs.length) selectTab(tabs[0], false);
