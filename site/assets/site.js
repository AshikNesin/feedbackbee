// FeedbackBee site: copy buttons, color mode, the demo player.
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
// Color mode: an explicit choice wins over the system setting and is remembered.
var themeBtn = document.querySelector(".theme");
function isDark() {
  var explicit = document.documentElement.dataset.theme;
  return explicit ? explicit === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
function labelTheme() {
  themeBtn.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
}
labelTheme();
themeBtn.addEventListener("click", function () {
  var next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("fb:theme", next);
  } catch (e) {}
  labelTheme();
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
