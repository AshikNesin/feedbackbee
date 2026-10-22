(function () {
  "use strict";
  var script =
    document.currentScript ||
    (function () {
      var all = document.querySelectorAll("script[data-project]");
      return all[all.length - 1];
    })();
  if (!script) return;
  var project = script.getAttribute("data-project");
  var endpoint = script.getAttribute("data-endpoint") || new URL(script.src).origin;
  var position = script.getAttribute("data-position") === "bottom-left" ? "left" : "right";

  var CSS =
    ":root{--fb-ink:#2d3e50;--fb-muted:#91a4be;--fb-tile:#edf3f8;--fb-tile-ink:#5b7186;--fb-focus:#3b82f6;--fb-radius:22px}" +
    ".fbx *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif}" +
    ".fbx-launch{position:fixed;" + position + ":20px;bottom:20px;z-index:2147483000;width:52px;height:52px;border-radius:50%;background:var(--fb-ink);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(45,62,80,.28);transition:transform .15s}" +
    ".fbx-launch:hover{transform:scale(1.07)}" +
    ".fbx-panel{position:fixed;" + position + ":20px;bottom:84px;z-index:2147483000;width:360px;max-width:calc(100vw - 24px);background:#fff;border-radius:28px;box-shadow:0 24px 64px rgba(45,62,80,.24);padding:22px;display:none}" +
    ".fbx-panel.fbx-open{display:block}" +
    ".fbx-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}" +
    ".fbx-back{background:none;border:none;cursor:pointer;color:var(--fb-muted);font-size:19px;line-height:1;padding:4px;display:none}" +
    ".fbx-title{flex:1;font-size:17px;font-weight:700;color:var(--fb-ink)}" +
    ".fbx-close{background:none;border:none;cursor:pointer;color:var(--fb-muted);font-size:19px;line-height:1;padding:4px}" +
    ".fbx-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}" +
    ".fbx-tile{background:var(--fb-tile);border:none;border-radius:18px;padding:16px 6px 14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;font:inherit;color:var(--fb-tile-ink);font-weight:600;transition:transform .12s}" +
    ".fbx-tile:hover{transform:translateY(-1px)}" +
    ".fbx-tile svg{width:26px;height:26px}" +
    ".fbx-note{width:100%;border:none;background:var(--fb-tile);border-radius:var(--fb-radius);padding:14px 16px;font:inherit;font-size:15px;min-height:96px;resize:none;outline:none;color:var(--fb-ink)}" +
    ".fbx-note:focus{box-shadow:0 0 0 2.5px var(--fb-focus)}" +
    ".fbx-note::placeholder{color:var(--fb-muted);font-weight:600}" +
    ".fbx-mail{width:100%;border:none;background:var(--fb-tile);border-radius:var(--fb-radius);padding:11px 16px;font:inherit;font-size:14px;outline:none;color:var(--fb-ink);margin-top:10px}" +
    ".fbx-mail:focus{box-shadow:0 0 0 2.5px var(--fb-focus)}" +
    ".fbx-mail::placeholder{color:var(--fb-muted)}" +
    ".fbx-shot{width:100%;border-radius:16px;margin-top:10px;display:block}" +
    ".fbx-rec{margin-top:10px;font-size:12.5px;color:var(--fb-tile-ink);background:var(--fb-tile);border-radius:12px;padding:8px 12px;display:none;align-items:center;gap:8px}" +
    ".fbx-dot{width:8px;height:8px;border-radius:50%;background:#ef4444;animation:fbxblink 1.2s infinite}" +
    "@keyframes fbxblink{50%{opacity:.25}}" +
    ".fbx-actions{display:flex;gap:10px;margin-top:12px}" +
    ".fbx-cam{width:72px;height:48px;border:none;border-radius:15px;background:var(--fb-tile);color:var(--fb-tile-ink);cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none}" +
    ".fbx-cam:hover{background:#e2ebf3}" +
    ".fbx-cam svg{width:21px;height:21px}" +
    ".fbx-send{flex:1;border:none;border-radius:15px;padding:12px;font:inherit;font-size:14.5px;font-weight:700;color:#fff;background:var(--fb-ink);cursor:pointer}" +
    ".fbx-send:disabled{background:var(--fb-tile);color:var(--fb-muted);cursor:default}" +
    ".fbx-foot{margin-top:14px;text-align:center;font-size:11.5px;color:var(--fb-muted)}" +
    ".fbx-foot b{color:var(--fb-tile-ink);font-weight:600}" +
    ".fbx-done{text-align:center;padding:10px 0 4px;display:none}" +
    ".fbx-done h3{margin:0 0 6px;font-size:16px;color:var(--fb-ink)}" +
    ".fbx-done p{margin:0;font-size:13.5px;color:var(--fb-tile-ink)}" +
    ".fbx-done a{color:var(--fb-focus)}" +
    ".fbx-err{margin-top:10px;font-size:13px;color:#dc2626;display:none}" +
    ".fbx-anno{position:fixed;inset:0;z-index:2147483001;background:rgba(28,38,50,.86);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:16px}" +
    ".fbx-anno canvas{max-width:94vw;max-height:70vh;background:#fff;border-radius:12px;cursor:crosshair;touch-action:none}" +
    ".fbx-bar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}" +
    ".fbx-bar button{border:none;border-radius:11px;padding:8px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:var(--fb-ink)}" +
    ".fbx-bar button.fbx-on{background:var(--fb-focus);color:#fff}" +
    ".fbx-hint{color:#c7d4e2;font-size:13px}";

  var ICONS = {
    issue:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 2.5 20h19L12 3z" fill="#f5b940"/><rect x="11" y="9" width="2" height="5" rx="1" fill="#7c3a00"/><circle cx="12" cy="16.6" r="1.2" fill="#7c3a00"/></svg>',
    idea:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" fill="#f5b940"/><rect x="9.5" y="18.5" width="5" height="1.8" rx=".9" fill="#5b7186"/><rect x="10.3" y="21" width="3.4" height="1.8" rx=".9" fill="#5b7186"/></svg>',
    other:
      '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="#5b7186"/><circle cx="12" cy="12" r="2" fill="#5b7186"/><circle cx="19" cy="12" r="2" fill="#5b7186"/></svg>',
    camera:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/><line x1="18" y1="2" x2="18" y2="6"/><line x1="16" y1="4" x2="20" y2="4"/></svg>',
  };

  var KINDS = [
    { id: "bug", label: "Issue", icon: ICONS.issue },
    { id: "idea", label: "Idea", icon: ICONS.idea },
    { id: "feedback", label: "Other", icon: ICONS.other },
  ];

  var state = {
    screen: "choose",
    kind: null,
    text: "",
    email: "",
    media: null,
    mediaKind: "none",
    seconds: 0,
    recording: false,
    recorder: null,
    chunks: [],
    busy: false,
  };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  var panel, backBtn, title, closeBtn, body, foot;

  function render() {
    body.innerHTML = "";

    if (state.screen === "choose") {
      title.textContent = "What's on your mind?";
      backBtn.style.display = "none";
      var tiles = el("div", "fbx-tiles");
      KINDS.forEach(function (k) {
        var t = el("button", "fbx-tile", k.icon + "<span>" + k.label + "</span>");
        t.addEventListener("click", function () {
          state.kind = k.id;
          state.screen = "form";
          render();
        });
        tiles.appendChild(t);
      });
      body.appendChild(tiles);
      return;
    }

    if (state.screen === "done") {
      title.textContent = "";
      backBtn.style.display = "none";
      var done = el("div", "fbx-done");
      var h = el("h3", "", "Thank you!");
      var p = el("p");
      if (state.issueUrl) {
        var a = document.createElement("a");
        a.href = state.issueUrl;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = "Tracked on GitHub →";
        p.appendChild(a);
      } else {
        p.textContent = "We received your report.";
      }
      done.appendChild(h);
      done.appendChild(p);
      body.appendChild(done);
      return;
    }

    // form screen
    var k = KINDS.filter(function (x) { return x.id === state.kind; })[0];
    title.textContent = k.label === "Other" ? "Tell us more" : k.label === "Issue" ? "Report an issue" : "Share an idea";
    backBtn.style.display = "block";

    var note = el("textarea", "fbx-note");
    note.placeholder = "I noticed that...";
    note.maxLength = 5000;
    note.value = state.text;
    note.addEventListener("input", function () {
      state.text = note.value;
      sync();
    });
    body.appendChild(note);

    var mail = el("input", "fbx-mail");
    mail.type = "email";
    mail.placeholder = "Email (optional)";
    mail.value = state.email;
    mail.addEventListener("input", function () { state.email = mail.value; });
    body.appendChild(mail);

    if (state.mediaKind === "screenshot" && state.media) {
      var img = el("img", "fbx-shot");
      img.src = URL.createObjectURL(state.media);
      img.alt = "screenshot";
      body.appendChild(img);
    }
    if (state.recording) {
      var rec = el("div", "fbx-rec", '<span class="fbx-dot"></span><span id="fbx-timer">Recording…</span>');
      body.appendChild(rec);
    } else if (state.mediaKind === "recording") {
      var saved = el("div", "fbx-rec", "Recording saved (" + Math.round(state.seconds) + "s)");
      saved.style.display = "flex";
      body.appendChild(saved);
    }

    var err = el("div", "fbx-err");
    body.appendChild(err);

    var actions = el("div", "fbx-actions");
    var cam = el("button", "fbx-cam", ICONS.camera);
    cam.title = "Capture screenshot";
    cam.addEventListener("click", function () { annotate(function (blob) { state.media = blob; state.mediaKind = "screenshot"; render(); }); });
    actions.appendChild(cam);

    var send = el("button", "fbx-send", state.busy ? "Sending…" : "Send feedback");
    send.id = "fbx-send";
    send.addEventListener("click", submit);
    actions.appendChild(send);
    body.appendChild(actions);

    function sync() {
      var btn = document.getElementById("fbx-send");
      if (btn) btn.disabled = state.busy || state.text.trim().length === 0;
    }
    sync();

    function submit() {
      if (state.busy || !state.text.trim()) return;
      state.busy = true;
      sync();
      err.style.display = "none";

      var form = new FormData();
      form.append("project", project);
      form.append("kind", state.kind);
      form.append("text", state.text.trim());
      if (state.email.trim()) form.append("email", state.email.trim());
      form.append("url", location.href);
      form.append("os_name", "web");
      form.append("os_version", navigator.userAgent.slice(0, 64));
      form.append("screen_w", screen.width);
      form.append("screen_h", screen.height);
      form.append("user_agent", navigator.userAgent);
      if (state.media) {
        form.append("media", state.media, state.mediaKind === "screenshot" ? "screenshot.png" : "recording.webm");
        form.append("media_kind", state.mediaKind);
        if (state.mediaKind === "recording") form.append("media_seconds", Math.round(state.seconds));
      }

      fetch(endpoint + "/api/feedback", { method: "POST", body: form })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          state.busy = false;
          if (data.error && !data.id) {
            err.textContent = data.error;
            err.style.display = "block";
            sync();
            return;
          }
          state.issueUrl = data.issueUrl || null;
          state.screen = "done";
          render();
          setTimeout(reset, 6000);
        })
        .catch(function () {
          state.busy = false;
          sync();
          err.textContent = "Network error. Please try again.";
          err.style.display = "block";
        });
    }
  }

  function reset() {
    state.screen = "choose";
    state.kind = null;
    state.text = "";
    state.email = "";
    state.media = null;
    state.mediaKind = "none";
    state.seconds = 0;
    state.issueUrl = null;
    state.busy = false;
    render();
  }

  // Screenshot capture + annotation overlay (pen / box / arrow, undo).
  function annotate(done) {
    var overlay = el("div", "fbx-anno");
    var hint = el("div", "fbx-hint", "Pick how to capture");
    var pick = el("div", "fbx-bar");
    var tab = el("button", "", "Capture this tab");
    var note = el("button", "", "Draw on a note");
    var cancel = el("button", "", "Cancel");
    pick.appendChild(tab); pick.appendChild(note); pick.appendChild(cancel);
    overlay.appendChild(hint); overlay.appendChild(pick);
    document.body.appendChild(overlay);

    cancel.addEventListener("click", function () { overlay.remove(); });
    note.addEventListener("click", function () {
      var c = document.createElement("canvas");
      c.width = 1080; c.height = Math.round((1080 * innerHeight) / Math.max(innerWidth, 1)) || 720;
      var x = c.getContext("2d");
      x.fillStyle = "#f4f7fa"; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = "#91a4be"; x.font = "600 44px sans-serif"; x.textAlign = "center";
      x.fillText(location.host + location.pathname, c.width / 2, c.height / 2);
      start(c.toDataURL("image/png"));
    });
    tab.addEventListener("click", function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        hint.textContent = "This browser can't capture the screen. Use note mode.";
        return;
      }
      navigator.mediaDevices
        .getDisplayMedia({ video: true })
        .then(function (stream) {
          var video = document.createElement("video");
          video.srcObject = stream;
          video.muted = true;
          return video.play().then(function () {
            return new Promise(function (r) { setTimeout(r, 220); }).then(function () {
              var c = document.createElement("canvas");
              c.width = video.videoWidth || 1280;
              c.height = video.videoHeight || 720;
              c.getContext("2d").drawImage(video, 0, 0);
              stream.getTracks().forEach(function (t) { t.stop(); });
              start(c.toDataURL("image/png"));
            });
          });
        })
        .catch(function () { hint.textContent = "Capture declined. Draw on a note instead."; });
    });

    function start(dataUrl) {
      var img = new Image();
      img.onload = function () { run(img); };
      img.src = dataUrl;
    }

    function run(img) {
      overlay.innerHTML = "";
      var canvas = el("canvas");
      var scale = Math.min(1, (innerWidth * 0.92) / img.width);
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.style.width = img.width * scale + "px";
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      var strokes = [];
      var mode = "pen";
      var drawing = false;
      var from = null;

      var bar = el("div", "fbx-bar");
      var tools = { pen: el("button", "fbx-on", "Pen"), box: el("button", "", "Box"), arrow: el("button", "", "Arrow") };
      var undo = el("button", "", "Undo");
      var save = el("button", "", "Use screenshot");
      var close = el("button", "", "Cancel");
      Object.keys(tools).forEach(function (m) {
        tools[m].addEventListener("click", function () {
          mode = m;
          Object.keys(tools).forEach(function (x) { tools[x].classList.toggle("fbx-on", x === m); });
        });
        bar.appendChild(tools[m]);
      });
      undo.addEventListener("click", function () { strokes.pop(); repaint(); });
      save.addEventListener("click", function () {
        canvas.toBlob(function (blob) { overlay.remove(); done(blob); }, "image/png");
      });
      close.addEventListener("click", function () { overlay.remove(); });
      bar.appendChild(undo); bar.appendChild(close); bar.appendChild(save);

      var hint2 = el("div", "fbx-hint", "Draw on the capture, then use it");
      overlay.appendChild(hint2);
      overlay.appendChild(canvas);
      overlay.appendChild(bar);

      function pt(e) {
        var r = canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - r.left) / r.width) * canvas.width,
          y: ((e.clientY - r.top) / r.height) * canvas.height,
        };
      }
      function paint(s) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = Math.max(3, canvas.width / 300);
        ctx.lineCap = "round";
        if (s.mode === "pen") {
          ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke();
        } else if (s.mode === "box") {
          ctx.strokeRect(s.from.x, s.from.y, s.to.x - s.from.x, s.to.y - s.from.y);
        } else {
          var ang = Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x);
          ctx.beginPath();
          ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y);
          ctx.lineTo(s.to.x - 14 * Math.cos(ang - 0.42), s.to.y - 14 * Math.sin(ang - 0.42));
          ctx.moveTo(s.to.x, s.to.y);
          ctx.lineTo(s.to.x - 14 * Math.cos(ang + 0.42), s.to.y - 14 * Math.sin(ang + 0.42));
          ctx.stroke();
        }
      }
      function repaint() {
        ctx.drawImage(img, 0, 0);
        strokes.forEach(paint);
      }
      canvas.addEventListener("pointerdown", function (e) { drawing = true; from = pt(e); canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener("pointermove", function (e) {
        if (!drawing) return;
        repaint(); paint({ mode: mode, from: from, to: pt(e) });
      });
      canvas.addEventListener("pointerup", function (e) {
        if (!drawing) return; drawing = false;
        strokes.push({ mode: mode, from: from, to: pt(e) });
        repaint();
      });
    }
  }

  function boot() {
    if (!project) return;
    var style = el("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var launch = el("button", "fbx-launch",
      '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>');
    launch.setAttribute("aria-label", "Feedback");
    document.body.appendChild(launch);

    panel = el("div", "fbx-panel");
    var head = el("div", "fbx-head");
    backBtn = el("button", "fbx-back", "←");
    backBtn.setAttribute("aria-label", "Back");
    backBtn.addEventListener("click", function () { state.screen = "choose"; render(); });
    title = el("div", "fbx-title");
    closeBtn = el("button", "fbx-close", "✕");
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", function () { panel.classList.remove("fbx-open"); reset(); });
    head.appendChild(backBtn); head.appendChild(title); head.appendChild(closeBtn);
    panel.appendChild(head);

    body = el("div");
    panel.appendChild(body);
    foot = el("div", "fbx-foot", "Widget by <b>FeedbackBee</b>");
    panel.appendChild(foot);

    document.body.appendChild(panel);
    render();

    launch.addEventListener("click", function () {
      panel.classList.toggle("fbx-open");
      if (!panel.classList.contains("fbx-open")) reset();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
