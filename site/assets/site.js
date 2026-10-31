// FeedbackBee site: copy buttons and the demo player.
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
