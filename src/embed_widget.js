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
    ".fbx{--fb-ink:#18181b;--fb-muted:#71717a;--fb-tile:#f4f4f5;--fb-border:#e4e4e7;--fb-focus:#2563eb;color:var(--fb-ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:left;color-scheme:light}" +
    ".fbx,.fbx *{box-sizing:border-box}" +
    ".fbx button,.fbx input,.fbx textarea{font:inherit;letter-spacing:normal;margin:0}" +
    ".fbx button{appearance:none;text-transform:none;touch-action:manipulation;transition:transform 140ms cubic-bezier(.23,1,.32,1)}" +
    ".fbx button:active:not(:disabled){transform:scale(.97)}" +
    ".fbx button:focus-visible,.fbx a:focus-visible{outline:2px solid var(--fb-focus);outline-offset:3px}" +
    ".fbx button:disabled{cursor:default}" +
    ".fbx svg{display:block;width:20px;height:20px;flex:none;pointer-events:none}" +
    ".fbx-launch{position:fixed;" + position + ":max(20px,env(safe-area-inset-" + position + "));bottom:max(20px,env(safe-area-inset-bottom));z-index:2147483000;width:48px;height:48px;border-radius:16px;background:var(--fb-ink);color:#fff;border:1px solid rgba(255,255,255,.12);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px #00000014,0 8px 24px #0000001f}" +
    ".fbx-panel{position:fixed;" + position + ":max(20px,env(safe-area-inset-" + position + "));bottom:calc(80px + env(safe-area-inset-bottom));z-index:2147483000;width:360px;max-width:calc(100vw - 40px);max-height:calc(100vh - 104px);max-height:calc(100dvh - 104px - env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain;background:#fff;border:1px solid var(--fb-border);border-radius:20px;box-shadow:0 4px 12px #00000008,0 20px 60px #0000001a;padding:20px;visibility:hidden;opacity:0;transform:translateY(6px) scale(.98);transform-origin:bottom " + position + ";transition:opacity 140ms ease,transform 180ms cubic-bezier(.23,1,.32,1),visibility 180ms}" +
    ".fbx-panel.fbx-open{visibility:visible;opacity:1;transform:translateY(0) scale(1)}" +
    ".fbx-panel.fbx-instant,.fbx-instant button{transition:none}" +
    ".fbx-head{display:flex;align-items:center;gap:4px;min-height:44px;margin:-6px -8px 0 0}" +
    ".fbx-title{flex:1;min-width:0;font-size:18px;line-height:1.35;letter-spacing:-.4px;font-weight:600;margin:0;color:var(--fb-ink)}" +
    ".fbx-back,.fbx-close,.fbx-remove{width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex:none;background:transparent;border:none;border-radius:10px;cursor:pointer;color:var(--fb-muted);padding:12px}" +
    ".fbx-back{margin-left:-12px}" +
    ".fbx-subtitle{margin:2px 0 20px;font-size:13px;color:var(--fb-muted)}" +
    ".fbx-tiles{display:flex;flex-direction:column;gap:8px}" +
    ".fbx-tile{width:100%;background:#fff;border:1px solid var(--fb-border);border-radius:12px;padding:12px;cursor:pointer;display:flex;align-items:center;gap:12px;text-align:left;color:var(--fb-ink)}" +
    ".fbx-kind-icon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9px;background:var(--fb-tile);flex:none}" +
    ".fbx-kind-copy{flex:1;min-width:0}" +
    ".fbx-kind-copy strong{display:block;font-size:14px;font-weight:600}" +
    ".fbx-kind-copy small{display:block;font-size:12px;line-height:1.5;color:var(--fb-muted);margin-top:1px}" +
    ".fbx-tile>svg{width:16px;height:16px;color:#a1a1aa}" +
    ".fbx-label{display:block;margin-bottom:7px;font-size:12px;font-weight:500;color:#52525b}" +
    ".fbx-label span{font-weight:400;color:var(--fb-muted)}" +
    ".fbx-note,.fbx-mail{display:block;width:100%;border:1px solid var(--fb-border);background:#fff;border-radius:10px;padding:11px 12px;outline:none;color:var(--fb-ink);box-shadow:0 1px 2px #00000004}" +
    ".fbx .fbx-note{font-size:16px;line-height:1.6;min-height:128px;resize:vertical;max-height:240px}" +
    ".fbx .fbx-mail{font-size:16px;min-height:44px}" +
    ".fbx-note:focus,.fbx-mail:focus{border-color:var(--fb-focus);box-shadow:0 0 0 3px #2563eb14}" +
    ".fbx-note::placeholder,.fbx-mail::placeholder{color:var(--fb-muted);opacity:1}" +
    ".fbx-email-group{margin-top:14px}" +
    ".fbx-preview{position:relative;margin-top:12px;border:1px solid var(--fb-border);border-radius:10px;overflow:hidden}" +
    ".fbx-shot{width:100%;max-height:160px;object-fit:contain;background:var(--fb-tile);display:block}" +
    ".fbx-preview .fbx-remove{position:absolute;top:4px;right:4px;background:#fff;box-shadow:0 1px 4px #00000014}" +
    ".fbx-rec{margin-top:12px;font-size:12px;color:#52525b;background:var(--fb-tile);border-radius:10px;padding:4px 4px 4px 12px;display:flex;align-items:center;gap:8px;min-height:48px}" +
    ".fbx-rec>span:not(.fbx-dot){flex:1;font-variant-numeric:tabular-nums}" +
    ".fbx-dot{width:7px;height:7px;border-radius:50%;background:#dc2626;flex:none}" +
    ".fbx .fbx-stop{min-height:44px;border:0;background:transparent;border-radius:8px;padding:0 12px;color:#b91c1c;font-weight:600;cursor:pointer}" +
    ".fbx-tools{display:flex;align-items:center;gap:4px;margin-top:12px}" +
    ".fbx-tools-label{flex:1;color:var(--fb-muted);font-size:12px}" +
    ".fbx-cam{width:44px;height:44px;border:1px solid var(--fb-border);border-radius:10px;background:#fff;color:#52525b;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none;padding:11px}" +
    ".fbx-cam[aria-pressed=true]{background:#fef2f2;border-color:#fecaca;color:#b91c1c}" +
    ".fbx-cam:disabled{opacity:.4}" +
    ".fbx-actions{margin-top:14px}" +
    ".fbx .fbx-send{display:block;width:100%;min-height:46px;border:1px solid transparent;border-radius:10px;padding:11px;font-size:14px;font-weight:600;color:#fff;background:var(--fb-ink);cursor:pointer}" +
    ".fbx-send:disabled{background:var(--fb-tile);color:var(--fb-muted)}" +
    ".fbx-foot{margin-top:18px;text-align:center;font-size:11px;color:var(--fb-muted)}" +
    ".fbx-foot b{font-weight:500;color:#52525b}" +
    ".fbx-done{text-align:center;padding:8px 0 16px}" +
    ".fbx-check{display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:0 auto 16px;border-radius:50%;background:var(--fb-tile);color:var(--fb-ink)}" +
    ".fbx-done h3{margin:0 0 6px;font-size:18px;letter-spacing:-.3px;font-weight:600;color:var(--fb-ink)}" +
    ".fbx-done p{margin:0;font-size:13px;color:var(--fb-muted)}" +
    ".fbx-done a{display:inline-flex;align-items:center;min-height:44px;color:var(--fb-ink);text-underline-offset:3px}" +
    ".fbx-err{margin-top:12px;font-size:13px;color:#b91c1c;display:none}" +
    ".fbx-anno{position:fixed;inset:0;z-index:2147483001;background:rgba(24,24,27,.92);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:20px}" +
    ".fbx-anno canvas{max-width:94vw;max-height:70vh;background:#fff;border-radius:8px;cursor:crosshair;touch-action:none}" +
    ".fbx-bar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}" +
    ".fbx-bar button{border:1px solid #d4d4d8;border-radius:8px;padding:10px 14px;min-height:44px;font-size:13px;font-weight:500;cursor:pointer;background:#fff;color:var(--fb-ink)}" +
    ".fbx-bar button.fbx-on{background:#e4e4e7;border-color:#a1a1aa}" +
    ".fbx-hint{color:#d4d4d8;font-size:13px}" +
    "@media(hover:hover) and (pointer:fine){.fbx-tile:hover,.fbx-cam:hover:not(:disabled),.fbx-back:hover,.fbx-close:hover,.fbx-remove:hover{background:var(--fb-tile)}.fbx-send:hover:not(:disabled),.fbx-launch:hover{background:#27272a}}" +
    "@media(prefers-reduced-motion:reduce){.fbx-panel,.fbx button{transition:none}.fbx button:active:not(:disabled){transform:none}}" +
    "@media(max-width:400px){.fbx-panel{" + position + ":12px;max-width:calc(100vw - 24px);padding:18px}.fbx-launch{" + position + ":16px}}";

  var ICONS = {
    issue:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 10 17H2L12 3z"/><path d="M12 9v4m0 3h.01"/></svg>',
    idea:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17c0-2-3-3-3-7a6 6 0 0 1 12 0c0 4-3 5-3 7H9zm0 3h6m-5 3h4"/></svg>',
    other:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/></svg>',
    camera:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/><line x1="18" y1="2" x2="18" y2="6"/><line x1="16" y1="4" x2="20" y2="4"/></svg>',
    record:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="3"/><path d="M22 8.5v7L16 12z"/></svg>',
    mic:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m10 5-7 7 7 7M3 12h18"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
  };

  var KINDS = [
    { id: "bug", label: "Report an issue", detail: "Something isn't working as expected", placeholder: "What happened? What did you expect?", icon: ICONS.issue },
    { id: "idea", label: "Share an idea", detail: "A small improvement or a big idea", placeholder: "What would make this better for you?", icon: ICONS.idea },
    { id: "feedback", label: "Something else", detail: "Anything else on your mind", placeholder: "What's on your mind?", icon: ICONS.other },
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
    timer: null,
    chunks: [],
    audio: null,
    audioSeconds: 0,
    audioRecording: false,
    audioRecorder: null,
    audioTimer: null,
    audioChunks: [],
    busy: false,
  };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  var panel, backBtn, title, closeBtn, body, foot, launch, subtitle;
  var previewUrl = null;
  var generation = 0;
  var resetTimer = null;

  function render() {
    var focusId = body.contains(document.activeElement) ? document.activeElement.id : null;
    if (focusId === "fbx-stop-screen") focusId = "fbx-recbtn";
    if (focusId === "fbx-stop-voice") focusId = "fbx-micbtn";
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    body.innerHTML = "";
    panel.setAttribute("aria-busy", String(state.busy));
    closeBtn.disabled = state.busy;

    if (state.screen === "choose") {
      title.textContent = "Share feedback";
      subtitle.textContent = "A little feedback goes a long way.";
      backBtn.style.display = "none";
      var tiles = el("div", "fbx-tiles");
      KINDS.forEach(function (k) {
        var t = el("button", "fbx-tile", '<span class="fbx-kind-icon">' + k.icon + '</span><span class="fbx-kind-copy"><strong>' + k.label + "</strong><small>" + k.detail + "</small></span>" + ICONS.next);
        t.addEventListener("click", function (event) {
          state.kind = k.id;
          state.screen = "form";
          render();
          if (event.detail === 0) body.querySelector("textarea").focus();
        });
        tiles.appendChild(t);
      });
      body.appendChild(tiles);
      return;
    }

    if (state.screen === "done") {
      title.textContent = "Share feedback";
      subtitle.textContent = "";
      backBtn.style.display = "none";
      var done = el("div", "fbx-done");
      done.setAttribute("role", "status");
      done.appendChild(el("div", "fbx-check", ICONS.check));
      var h = el("h3", "", "Feedback sent");
      var p = el("p");
      if (state.issueUrl) {
        var a = document.createElement("a");
        a.href = state.issueUrl;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = "View on GitHub ↗";
        p.appendChild(a);
      } else {
        p.textContent = "Thanks for helping us make things better.";
      }
      done.appendChild(h);
      done.appendChild(p);
      body.appendChild(done);
      return;
    }

    // form screen
    var k = KINDS.filter(function (x) { return x.id === state.kind; })[0];
    title.textContent = state.kind === "feedback" ? "Tell us more" : k.label;
    subtitle.textContent = "We're listening. Tell us a little more.";
    backBtn.style.display = "flex";
    backBtn.disabled = state.busy || state.recording || state.audioRecording;

    var noteLabel = el("label", "fbx-label", "Your feedback");
    noteLabel.htmlFor = "fbx-note";
    body.appendChild(noteLabel);
    var note = el("textarea", "fbx-note");
    note.id = "fbx-note";
    note.placeholder = k.placeholder;
    note.maxLength = 5000;
    note.value = state.text;
    note.addEventListener("input", function () {
      state.text = note.value;
      sync();
    });
    body.appendChild(note);

    var emailGroup = el("div", "fbx-email-group");
    var emailLabel = el("label", "fbx-label", "Email <span>(optional)</span>");
    emailLabel.htmlFor = "fbx-mail";
    emailGroup.appendChild(emailLabel);
    var mail = el("input", "fbx-mail");
    mail.id = "fbx-mail";
    mail.type = "email";
    mail.placeholder = "you@example.com";
    mail.autocomplete = "email";
    mail.value = state.email;
    mail.addEventListener("input", function () { state.email = mail.value; });
    note.disabled = mail.disabled = state.busy;
    emailGroup.appendChild(mail);
    body.appendChild(emailGroup);

    if (state.mediaKind === "screenshot" && state.media) {
      var img = el("img", "fbx-shot");
      previewUrl = URL.createObjectURL(state.media);
      img.src = previewUrl;
      img.alt = "Attached screenshot";
      var preview = el("div", "fbx-preview");
      preview.appendChild(img);
      preview.appendChild(removeButton("Remove screenshot", function () { state.media = null; state.mediaKind = "none"; render(); }, "fbx-cambtn"));
      body.appendChild(preview);
    }
    if (state.recording) {
      var recInd = el("div", "fbx-rec", '<span class="fbx-dot"></span><span id="fbx-timer">Screen recording · ' + fmt(state.seconds) + ' / 5:00</span>');
      recInd.appendChild(stopButton(toggleRecord));
      body.appendChild(recInd);
    } else if (state.mediaKind === "recording") {
      var saved = el("div", "fbx-rec", ICONS.record + "<span>Screen recording · " + fmt(state.seconds) + "</span>");
      saved.appendChild(removeButton("Remove screen recording", function () { state.media = null; state.mediaKind = "none"; render(); }, "fbx-recbtn"));
      body.appendChild(saved);
    }
    if (state.audioRecording) {
      var micInd = el("div", "fbx-rec", '<span class="fbx-dot"></span><span id="fbx-mtimer">Voice note · ' + fmt(state.audioSeconds) + ' / 5:00</span>');
      micInd.appendChild(stopButton(toggleVoice));
      body.appendChild(micInd);
    } else if (state.audio) {
      var savedAudio = el("div", "fbx-rec", ICONS.mic + "<span>Voice note · " + fmt(state.audioSeconds) + "</span>");
      savedAudio.appendChild(removeButton("Remove voice note", function () { state.audio = null; state.audioSeconds = 0; render(); }, "fbx-micbtn"));
      body.appendChild(savedAudio);
    }

    var err = el("div", "fbx-err");
    err.setAttribute("role", "alert");
    body.appendChild(err);

    var tools = el("div", "fbx-tools");
    tools.appendChild(el("span", "fbx-tools-label", "Add context"));
    var cam = el("button", "fbx-cam", ICONS.camera);
    cam.id = "fbx-cambtn";
    cam.title = "Attach a screenshot";
    cam.setAttribute("aria-label", cam.title);
    cam.disabled = state.busy || state.recording;
    cam.addEventListener("click", function () {
      var captureGeneration = generation;
      annotate(function (blob) {
        if (captureGeneration !== generation) return;
        state.media = blob; state.mediaKind = "screenshot"; render();
      });
    });
    tools.appendChild(cam);

    var rec = el("button", "fbx-cam", ICONS.record);
    rec.title = state.recording ? "Stop screen recording" : "Record your screen (up to 5 minutes)";
    rec.setAttribute("aria-label", rec.title);
    rec.setAttribute("aria-pressed", String(state.recording));
    rec.disabled = state.busy || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder;
    rec.id = "fbx-recbtn";
    rec.addEventListener("click", toggleRecord);
    tools.appendChild(rec);

    var mic = el("button", "fbx-cam", ICONS.mic);
    mic.title = state.audioRecording ? "Stop voice note" : state.audio ? "Record a new voice note" : "Record a voice note (up to 5 minutes)";
    mic.setAttribute("aria-label", mic.title);
    mic.setAttribute("aria-pressed", String(state.audioRecording));
    mic.disabled = state.busy || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder;
    mic.id = "fbx-micbtn";
    mic.addEventListener("click", toggleVoice);
    tools.appendChild(mic);
    body.appendChild(tools);

    var actions = el("div", "fbx-actions");
    var send = el("button", "fbx-send", state.busy ? "Sending…" : "Send feedback");
    send.id = "fbx-send";
    send.addEventListener("click", submit);
    actions.appendChild(send);
    body.appendChild(actions);

    function sync() {
      var btn = document.getElementById("fbx-send");
      if (btn) {
        btn.disabled = state.busy || state.recording || state.audioRecording || state.text.trim().length === 0;
        btn.textContent = state.busy ? "Sending…" : "Send feedback";
      }
    }
    sync();
    if (focusId) {
      var focused = document.getElementById(focusId);
      if (focused && !focused.disabled) focused.focus({ preventScroll: true });
    }

    function submit() {
      if (state.busy || state.recording || state.audioRecording || !state.text.trim()) return;
      if (!mail.reportValidity()) return;
      state.busy = true;
      sync();
      panel.setAttribute("aria-busy", "true");
      [note, mail, backBtn, closeBtn, cam, rec, mic].forEach(function (control) { control.disabled = true; });
      body.querySelectorAll(".fbx-remove").forEach(function (control) { control.disabled = true; });
      err.style.display = "none";
      var requestGeneration = generation;

      function failed(message) {
        state.busy = false;
        render();
        var error = body.querySelector(".fbx-err");
        error.textContent = message;
        error.style.display = "block";
      }

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
      if (state.audio) {
        form.append("audio", state.audio, "voice.webm");
        form.append("audio_seconds", Math.round(state.audioSeconds));
      }

      fetch(endpoint + "/api/feedback", { method: "POST", body: form })
        .then(function (r) {
          return r.json().then(
            function (data) { return { status: r.status, data: data }; },
            function () { return { status: r.status, data: { error: "Couldn't read the server response." } }; },
          );
        })
        .then(function (result) {
          if (requestGeneration !== generation) return;
          state.busy = false;
          if (result.data.error && !result.data.id) {
            failed(result.status === 404 ? "This feedback board isn\u2019t set up yet. Please try again later." : result.data.error);
            return;
          }
          state.issueUrl = result.data.issueUrl || null;
          state.screen = "done";
          render();
          closeBtn.focus({ preventScroll: true });
          resetTimer = setTimeout(function () { setOpen(false); }, 6000);
        })
        .catch(function () {
          if (requestGeneration !== generation) return;
          failed("Couldn't send your feedback. Please try again.");
        });
    }
  }

  function removeButton(label, action, focusId) {
    var button = el("button", "fbx-remove", ICONS.close);
    button.setAttribute("aria-label", label);
    button.title = label;
    button.disabled = state.busy;
    button.addEventListener("click", function () {
      action();
      document.getElementById(focusId).focus({ preventScroll: true });
    });
    return button;
  }

  function stopButton(action) {
    var button = el("button", "fbx-stop", "Stop");
    button.id = action === toggleRecord ? "fbx-stop-screen" : "fbx-stop-voice";
    button.addEventListener("click", action);
    return button;
  }

  // Screen recording via getDisplayMedia, hard-capped at 5 minutes.
  function toggleRecord() {
    if (state.recording) {
      if (state.recorder && state.recorder.state !== "inactive") state.recorder.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) return;
    var recordingGeneration = generation;
    navigator.mediaDevices
      .getDisplayMedia({ video: true })
      .then(function (stream) {
        if (recordingGeneration !== generation) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        state.chunks = [];
        var mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
        state.recorder = new MediaRecorder(stream, { mimeType: mime });
        state.recorder.ondataavailable = function (e) { if (recordingGeneration === generation && e.data && e.data.size) state.chunks.push(e.data); };
        state.recorder.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          if (recordingGeneration !== generation) return;
          clearInterval(state.timer);
          state.recording = false;
          state.timer = null;
          state.media = new Blob(state.chunks, { type: "video/webm" });
          state.mediaKind = "recording";
          render();
        };
        stream.getVideoTracks()[0].addEventListener("ended", function () {
          if (state.recorder && state.recorder.state !== "inactive") state.recorder.stop();
        });
        state.seconds = 0;
        state.recording = true;
        state.recorder.start(1000);
        render();
        state.timer = setInterval(function () {
          state.seconds++;
          var t = document.getElementById("fbx-timer");
          if (t) t.textContent = "Screen recording · " + fmt(state.seconds) + " / 5:00";
          if (state.seconds >= 300 && state.recorder && state.recorder.state !== "inactive") state.recorder.stop();
        }, 1000);
      })
      .catch(function () { /* user declined; keep the form quiet */ });
  }

  function fmt(s) {
    var m = Math.floor(s / 60), r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  // Voice note via getUserMedia(audio), hard-capped at 5 minutes.
  function toggleVoice() {
    if (state.audioRecording) {
      if (state.audioRecorder && state.audioRecorder.state !== "inactive") state.audioRecorder.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return;
    var recordingGeneration = generation;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        if (recordingGeneration !== generation) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        var mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].filter(function (m) {
          return MediaRecorder.isTypeSupported(m);
        })[0] || "";
        state.audioChunks = [];
        var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        state.audioRecorder = rec;
        rec.ondataavailable = function (e) { if (recordingGeneration === generation && e.data && e.data.size) state.audioChunks.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          if (recordingGeneration !== generation) return;
          clearInterval(state.audioTimer);
          state.audioTimer = null;
          state.audioRecording = false;
          if (state.audioChunks.length) {
            state.audio = new Blob(state.audioChunks, { type: mime.split(";")[0] || "audio/webm" });
            state.audioKindMime = mime;
          }
          render();
        };
        state.audioSeconds = 0;
        state.audioRecording = true;
        rec.start();
        render();
        state.audioTimer = setInterval(function () {
          state.audioSeconds++;
          var t = document.getElementById("fbx-mtimer");
          if (t) t.textContent = "Voice note · " + fmt(state.audioSeconds) + " / 5:00";
          if (state.audioSeconds >= 300 && state.audioRecorder && state.audioRecorder.state !== "inactive") state.audioRecorder.stop();
        }, 1000);
      })
      .catch(function () { /* mic declined or unavailable; keep the form quiet */ });
  }

  function reset() {
    generation++;
    clearTimeout(resetTimer);
    resetTimer = null;
    state.screen = "choose";
    state.kind = null;
    state.text = "";
    state.email = "";
    state.media = null;
    state.mediaKind = "none";
    state.seconds = 0;
    state.issueUrl = null;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.recording && state.recorder && state.recorder.state !== "inactive") state.recorder.stop();
    state.recording = false;
    state.audio = null;
    state.audioSeconds = 0;
    if (state.audioTimer) { clearInterval(state.audioTimer); state.audioTimer = null; }
    if (state.audioRecording && state.audioRecorder && state.audioRecorder.state !== "inactive") state.audioRecorder.stop();
    state.audioRecording = false;
    state.busy = false;
    render();
  }

  // Screenshot capture + annotation overlay (pen / box / arrow, undo).
  function annotate(done) {
    var overlay = el("div", "fbx fbx-anno");
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
      x.fillStyle = "#f4f4f5"; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = "#71717a"; x.font = "600 44px sans-serif"; x.textAlign = "center";
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

  function setOpen(open, keyboard) {
    if (state.busy && !open) return;
    var returnFocus = keyboard || panel.contains(document.activeElement);
    panel.classList.toggle("fbx-instant", !!keyboard);
    panel.classList.toggle("fbx-open", open);
    panel.inert = !open;
    launch.setAttribute("aria-expanded", String(open));
    if (open) {
      fitViewport();
      if (keyboard) body.querySelector("button,textarea").focus();
    } else {
      if (returnFocus) launch.focus({ preventScroll: true });
      reset();
    }
  }

  function fitViewport() {
    if (!window.visualViewport) return;
    var viewport = window.visualViewport;
    var keyboard = Math.max(0, innerHeight - viewport.height - viewport.offsetTop);
    panel.style.bottom = keyboard > 120 ? keyboard + 12 + "px" : "";
    panel.style.maxHeight = keyboard > 120 ? Math.max(100, viewport.height - 36) + "px" : "";
  }

  function boot() {
    if (!project) return;
    var style = el("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    launch = el("button", "fbx fbx-launch",
      '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>');
    launch.setAttribute("aria-label", "Feedback");
    launch.setAttribute("aria-expanded", "false");
    launch.setAttribute("aria-controls", "fbx-panel");
    launch.setAttribute("aria-haspopup", "dialog");
    document.body.appendChild(launch);

    panel = el("div", "fbx fbx-panel");
    panel.id = "fbx-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "fbx-title");
    panel.setAttribute("aria-describedby", "fbx-subtitle");
    panel.inert = true;
    var head = el("div", "fbx-head");
    backBtn = el("button", "fbx-back", ICONS.back);
    backBtn.setAttribute("aria-label", "Back");
    backBtn.addEventListener("click", function (event) {
      state.screen = "choose"; render();
      if (event.detail === 0) body.querySelector("button").focus();
    });
    title = el("h2", "fbx-title");
    title.id = "fbx-title";
    closeBtn = el("button", "fbx-close", ICONS.close);
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", function (event) { setOpen(false, event.detail === 0); });
    head.appendChild(backBtn); head.appendChild(title); head.appendChild(closeBtn);
    panel.appendChild(head);
    subtitle = el("p", "fbx-subtitle");
    subtitle.id = "fbx-subtitle";
    panel.appendChild(subtitle);

    body = el("div");
    panel.appendChild(body);
    foot = el("div", "fbx-foot", "Powered by <b>FeedbackBee</b>");
    panel.appendChild(foot);

    document.body.appendChild(panel);
    render();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitViewport);
      window.visualViewport.addEventListener("scroll", fitViewport);
    }

    launch.addEventListener("click", function (event) {
      setOpen(!panel.classList.contains("fbx-open"), event.detail === 0);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && panel.classList.contains("fbx-open") && !document.querySelector(".fbx-anno")) {
        event.preventDefault();
        setOpen(false, true);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
