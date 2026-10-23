// Generated from embed_widget.js by scripts/build-embed.py. Do not edit.
export const EMBED_JS = `(function () {
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
    ".fbx-panel{position:fixed;" + position + ":max(20px,env(safe-area-inset-" + position + "));bottom:calc(80px + env(safe-area-inset-bottom));z-index:2147483000;width:340px;max-width:calc(100vw - 40px);max-height:calc(100vh - 104px);max-height:calc(100dvh - 104px - env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain;background:#fff;border:1px solid var(--fb-border);border-radius:20px;box-shadow:0 4px 12px #00000008,0 20px 60px #0000001a;padding:16px;visibility:hidden;opacity:0;transform:translateY(6px) scale(.98);transform-origin:bottom " + position + ";transition:opacity 140ms ease,transform 180ms cubic-bezier(.23,1,.32,1),visibility 180ms}" +
    ".fbx-panel.fbx-open{visibility:visible;opacity:1;transform:translateY(0) scale(1);transition:opacity 140ms ease,transform 180ms cubic-bezier(.23,1,.32,1),visibility 0s}" +
    ".fbx-panel.fbx-instant,.fbx-instant button{transition:none}" +
    ".fbx-head{display:flex;align-items:center;gap:4px;min-height:36px;margin:-6px -8px 10px 0}" +
    ".fbx-title{flex:1;min-width:0;font-size:15px;line-height:1.35;letter-spacing:-.2px;font-weight:600;margin:0;color:var(--fb-ink)}" +
    ".fbx-close,.fbx-remove{width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex:none;background:transparent;border:none;border-radius:10px;cursor:pointer;color:var(--fb-muted);padding:11px}" +
    ".fbx-kinds{display:flex;gap:6px;margin-bottom:10px}" +
    ".fbx .fbx-kind{display:flex;align-items:center;gap:6px;min-height:34px;padding:0 12px 0 9px;border:1px solid var(--fb-border);border-radius:999px;background:#fff;color:#52525b;font-size:13px;font-weight:500;cursor:pointer;transition:background-color 120ms ease,color 120ms ease,border-color 120ms ease,transform 140ms cubic-bezier(.23,1,.32,1)}" +
    ".fbx-kind svg{width:15px;height:15px}" +
    ".fbx .fbx-kind[aria-checked=true]{background:var(--fb-ink);border-color:var(--fb-ink);color:#fff}" +
    ".fbx-note,.fbx-mail{display:block;width:100%;border:1px solid var(--fb-border);background:#fff;border-radius:10px;padding:10px 12px;outline:none;color:var(--fb-ink);font-size:14px}" +
    ".fbx .fbx-note{line-height:1.55;min-height:108px;resize:vertical;max-height:240px}" +
    ".fbx .fbx-mail{min-height:40px;margin-top:8px}" +
    ".fbx-note:focus,.fbx-mail:focus{border-color:var(--fb-focus);box-shadow:0 0 0 3px #2563eb14}" +
    ".fbx-note::placeholder,.fbx-mail::placeholder{color:#a1a1aa;opacity:1}" +
    ".fbx-preview{position:relative;margin-top:12px;border:1px solid var(--fb-border);border-radius:10px;overflow:hidden}" +
    ".fbx-shot{width:100%;max-height:160px;object-fit:contain;background:var(--fb-tile);display:block}" +
    ".fbx-preview .fbx-remove{position:absolute;top:4px;right:4px;background:#fff;box-shadow:0 1px 4px #00000014}" +
    ".fbx-rec{margin-top:12px;font-size:12px;color:#52525b;background:var(--fb-tile);border-radius:10px;padding:4px 4px 4px 12px;display:flex;align-items:center;gap:8px;min-height:48px}" +
    ".fbx-rec>span:not(.fbx-dot){flex:1;font-variant-numeric:tabular-nums}" +
    ".fbx-dot{width:7px;height:7px;border-radius:50%;background:#dc2626;flex:none}" +
    ".fbx .fbx-stop{min-height:44px;border:0;background:transparent;border-radius:8px;padding:0 12px;color:#b91c1c;font-weight:600;cursor:pointer}" +
    ".fbx-tools{display:flex;align-items:center;gap:2px;margin-top:12px}" +
    ".fbx-cam{width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:#71717a;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none;padding:10px}" +
    ".fbx-cam[aria-pressed=true]{background:#fef2f2;color:#b91c1c}" +
    ".fbx-cam:disabled{opacity:.35}" +
    ".fbx .fbx-send{display:flex;align-items:center;gap:8px;margin-left:auto;min-height:40px;border:1px solid transparent;border-radius:10px;padding:0 16px;font-size:14px;font-weight:600;color:#fff;background:var(--fb-ink);cursor:pointer}" +
    ".fbx-send kbd{font:inherit;font-size:12px;font-weight:500;opacity:.55}" +
    ".fbx-send:disabled{background:var(--fb-tile);color:#a1a1aa}" +
    ".fbx-foot{margin-top:12px;text-align:center;font-size:11px;color:var(--fb-muted)}" +
    ".fbx-foot b{font-weight:500;color:#52525b}" +
    ".fbx-done{text-align:center;padding:4px 0 8px}" +
    ".fbx-check{display:flex;align-items:center;justify-content:center;width:40px;height:40px;margin:0 auto 12px;border-radius:50%;background:#dcfce7;color:#15803d}" +
    ".fbx-done h3{margin:0 0 4px;font-size:16px;letter-spacing:-.2px;font-weight:600;color:var(--fb-ink)}" +
    ".fbx-done p{margin:0;font-size:13px;color:var(--fb-muted)}" +
    ".fbx-err{margin-top:12px;font-size:13px;color:#b91c1c;display:none}" +
    ".fbx-launch.fbx-away{visibility:hidden}" +
    ".fbx-recbar{position:fixed;" + position + ":max(20px,env(safe-area-inset-" + position + "));bottom:max(20px,env(safe-area-inset-bottom));z-index:2147483001;display:flex;align-items:center;gap:8px;padding:6px 6px 6px 16px;border-radius:999px;background:rgba(24,24,27,.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;box-shadow:0 8px 24px #0000002e;animation:fbx-rise 200ms cubic-bezier(.23,1,.32,1)}" +
    ".fbx-recbar .fbx-dot{background:#ef4444;animation:fbx-pulse 1.4s ease-in-out infinite}" +
    ".fbx-rectime{min-width:36px;font-size:13px;font-weight:500;font-variant-numeric:tabular-nums}" +
    ".fbx .fbx-recstop{display:flex;align-items:center;gap:7px;height:34px;padding:0 14px;border:0;border-radius:999px;background:#fff;color:#18181b;font-size:13px;font-weight:600;cursor:pointer}" +
    ".fbx-sq{width:9px;height:9px;border-radius:2px;background:#dc2626}" +
    ".fbx-recx{width:34px;height:34px;padding:9px;border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.7);cursor:pointer;display:flex;align-items:center;justify-content:center}" +
    ".fbx-recx svg{width:16px;height:16px}" +
    ".fbx-panel.fbx-open.fbx-away{visibility:hidden;opacity:0;transition:none;pointer-events:none}" +
    ".fbx-shot-btn{display:block;width:100%;padding:0;border:0;background:var(--fb-tile);cursor:pointer}" +
    ".fbx-preview .fbx-edit{right:52px}" +
    // Capture status pill, shutter flash and the post-capture card share the panel's corner.
    ".fbx-snap,.fbx-qa{position:fixed;" + position + ":max(20px,env(safe-area-inset-" + position + "));bottom:calc(80px + env(safe-area-inset-bottom));z-index:2147483001}" +
    ".fbx-snap{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:999px;background:rgba(24,24,27,.92);color:#fff;font-size:13px;font-weight:500;box-shadow:0 8px 24px #0000002e;animation:fbx-rise 200ms cubic-bezier(.23,1,.32,1) 150ms both}" +
    ".fbx-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.28);border-top-color:#fff;animation:fbx-spin .7s linear infinite}" +
    ".fbx-flash{position:fixed;inset:0;z-index:2147483002;background:#fff;pointer-events:none;opacity:0;animation:fbx-flash 420ms ease-out}" +
    ".fbx-qa{width:320px;max-width:calc(100vw - 40px);background:#fff;border:1px solid var(--fb-border);border-radius:18px;box-shadow:0 4px 12px #00000008,0 20px 60px #00000024;padding:12px;animation:fbx-rise 240ms cubic-bezier(.23,1,.32,1)}" +
    ".fbx-qa-head{display:flex;align-items:center;gap:8px;margin:-6px -6px 8px 4px;min-height:36px;font-size:13px;font-weight:600}" +
    ".fbx-qa-head span{flex:1}" +
    ".fbx-qa-x{width:36px;height:36px;padding:9px;border:0;border-radius:9px;background:transparent;color:var(--fb-muted);cursor:pointer;display:flex;align-items:center;justify-content:center}" +
    ".fbx-qa p{margin:0 4px 4px;font-size:13px;color:var(--fb-muted)}" +
    ".fbx-qa-thumb{position:relative;display:block;width:100%;padding:0;border:1px solid var(--fb-border);border-radius:10px;overflow:hidden;background:var(--fb-tile);cursor:pointer}" +
    ".fbx-qa-thumb canvas{display:block;width:100%;height:auto;max-height:220px;object-fit:contain}" +
    ".fbx-qa-hover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(24,24,27,.42);color:#fff;font-size:13px;font-weight:600;opacity:0;transition:opacity 140ms ease}" +
    ".fbx-qa-hover svg{width:16px;height:16px}" +
    ".fbx-qa-actions{display:flex;gap:8px;margin-top:10px}" +
    ".fbx .fbx-qa-btn{flex:1;min-height:42px;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--fb-border);border-radius:10px;background:#fff;color:var(--fb-ink);font-size:14px;font-weight:600;cursor:pointer;padding:0 12px}" +
    ".fbx-qa-btn svg{width:16px;height:16px}" +
    ".fbx .fbx-qa-primary{background:var(--fb-ink);border-color:transparent;color:#fff}" +
    // Annotation editor: dimmed stage plus a floating glass toolbar (CleanShot-style).
    ".fbx-ed{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;background:rgba(9,9,11,.74);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);touch-action:none;animation:fbx-fade 160ms ease}" +
    ".fbx-stage{position:relative;line-height:0;border-radius:10px;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 24px 80px rgba(0,0,0,.5);animation:fbx-pop 240ms cubic-bezier(.23,1,.32,1)}" +
    ".fbx-stage canvas{display:block;border-radius:10px;touch-action:none;cursor:crosshair}" +
    ".fbx-tb{position:fixed;top:max(14px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:2px;padding:5px;max-width:calc(100vw - 24px);border-radius:14px;background:rgba(30,30,34,.84);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);border:1px solid rgba(255,255,255,.09);box-shadow:0 10px 32px rgba(0,0,0,.36);color-scheme:dark}" +
    ".fbx-tb button,.fbx-pop button{position:relative;width:36px;height:36px;padding:9px;border:0;border-radius:9px;background:transparent;color:rgba(255,255,255,.64);cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none;transition:background-color 120ms ease,color 120ms ease,transform 140ms cubic-bezier(.23,1,.32,1)}" +
    ".fbx-tb svg{width:18px;height:18px}" +
    ".fbx-tb button[aria-pressed=true]{background:rgba(255,255,255,.15);color:#fff}" +
    ".fbx-tb button:disabled{opacity:.28}" +
    ".fbx-tb button:focus-visible,.fbx-pop button:focus-visible{outline:2px solid rgba(255,255,255,.85);outline-offset:1px}" +
    ".fbx .fbx-tb .fbx-tb-done{width:auto;padding:0 16px;margin-left:4px;background:#fff;color:#18181b;font-size:13px;font-weight:600}" +
    ".fbx-sep{width:1px;height:20px;margin:0 5px;background:rgba(255,255,255,.12);flex:none}" +
    ".fbx-swatch{width:16px;height:16px;border-radius:50%;box-shadow:0 0 0 1.5px rgba(255,255,255,.85),0 0 0 3px rgba(0,0,0,.25)}" +
    ".fbx-tb [data-tip]::after{content:attr(data-tip);position:absolute;top:calc(100% + 10px);left:50%;transform:translate(-50%,-3px);white-space:pre;padding:5px 8px;border-radius:7px;background:rgba(30,30,34,.96);color:rgba(255,255,255,.92);font-size:12px;font-weight:500;line-height:1.3;letter-spacing:.1px;box-shadow:0 4px 16px rgba(0,0,0,.3);opacity:0;pointer-events:none;transition:opacity 120ms ease,transform 120ms ease}" +
    ".fbx-pop{position:fixed;z-index:1;display:flex;gap:4px;padding:6px;border-radius:12px;background:rgba(30,30,34,.94);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.09);box-shadow:0 10px 32px rgba(0,0,0,.36);animation:fbx-fade 120ms ease}" +
    ".fbx-pop[hidden]{display:none}" +
    ".fbx-pop button{width:32px;height:32px;padding:7px}" +
    ".fbx-pop span{display:block;width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}" +
    ".fbx-pop button[aria-pressed=true] span{box-shadow:0 0 0 2px rgba(30,30,34,1),0 0 0 4px #fff}" +
    ".fbx-text-in{position:absolute;min-width:4px;margin:0;padding:0;outline:1px dashed rgba(255,255,255,.75);outline-offset:4px;border-radius:2px;font-weight:600;line-height:1.25;white-space:pre;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;cursor:text}" +
    ".fbx-ed-hint{position:fixed;bottom:max(14px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);white-space:nowrap;color:rgba(255,255,255,.5);font-size:12px;transition:opacity 300ms ease}" +
    ".fbx-ed-hint kbd{font:inherit;padding:1px 6px;margin:0 2px;border-radius:5px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.78)}" +
    "@keyframes fbx-fade{from{opacity:0}}" +
    "@keyframes fbx-pop{from{opacity:0;transform:scale(.97)}}" +
    "@keyframes fbx-rise{from{opacity:0;transform:translateY(8px) scale(.98)}}" +
    "@keyframes fbx-flash{from{opacity:.6}to{opacity:0}}" +
    "@keyframes fbx-pulse{50%{opacity:.3}}" +
    "@keyframes fbx-spin{to{transform:rotate(360deg)}}" +
    "@media(hover:hover) and (pointer:fine){.fbx .fbx-kind:not([aria-checked=true]):hover,.fbx-cam:hover:not(:disabled),.fbx-close:hover,.fbx-remove:hover,.fbx-qa-x:hover,.fbx .fbx-qa-btn:not(.fbx-qa-primary):hover{background:var(--fb-tile)}.fbx-send:hover:not(:disabled),.fbx-launch:hover,.fbx .fbx-qa-primary:hover{background:#27272a}" +
    ".fbx-qa-thumb:hover .fbx-qa-hover{opacity:1}.fbx-tb button:hover:not(:disabled):not([aria-pressed=true]),.fbx-pop button:hover{background:rgba(255,255,255,.08);color:#fff}.fbx .fbx-tb .fbx-tb-done:hover{background:#e4e4e7}" +
    ".fbx-recx:hover{background:rgba(255,255,255,.1);color:#fff}.fbx .fbx-recstop:hover{background:#e4e4e7}.fbx-tb [data-tip]:hover::after{opacity:1;transform:translate(-50%,0);transition-delay:450ms}}" +
    "@media(prefers-reduced-motion:reduce){.fbx-panel,.fbx button{transition:none}.fbx button:active:not(:disabled){transform:none}.fbx-flash{display:none}.fbx-recbar .fbx-dot{animation:none}.fbx-snap,.fbx-recbar,.fbx-qa,.fbx-ed,.fbx-stage,.fbx-pop{animation:none}}" +
    "@media(max-width:640px){.fbx-tb{top:auto;bottom:max(12px,env(safe-area-inset-bottom));flex-wrap:wrap;justify-content:center;row-gap:4px;width:max-content}.fbx-sep{display:none}.fbx-tb button{width:38px;height:38px;padding:10px}.fbx-tb [data-tip]::after,.fbx-ed-hint{display:none}.fbx-snap,.fbx-qa{left:12px;right:12px;width:auto;max-width:none}.fbx-snap{justify-content:center}}" +
    "@media(pointer:coarse){.fbx .fbx-note,.fbx .fbx-mail{font-size:16px}.fbx .fbx-kind{min-height:40px}.fbx-send kbd{display:none}}" +
    "@media(max-width:400px){.fbx-panel{" + position + ":12px;max-width:calc(100vw - 24px)}.fbx-launch{" + position + ":16px}}";

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
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 18 6M9 5.5h9.5V15"/></svg>',
    rect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/></svg>',
    ellipse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="12" rx="8.5" ry="7"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.2-4.2L16.4 4.6a2.1 2.1 0 0 1 3 3L8.2 18.8 4 20z"/><path d="m14.5 6.5 3 3"/></svg>',
    marker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 4.5 4.5 4.5-8 8H7v-4.5l8-8z"/><path d="M4 21h9" stroke-width="2.6" opacity=".55"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7V5h14v2M12 5v14M9 19h6"/></svg>',
    counter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M10.5 9.5 12.5 8v8"/></svg>',
    blur: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h5v5H4zM15 4h5v5h-5zM9.5 9.5h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z" opacity=".9"/><path d="M9.5 4h5v5h-5zM4 9.5h5v5H4zM15 9.5h5v5h-5zM9.5 15h5v5h-5z" opacity=".35"/></svg>',
  };

  var KINDS = [
    { id: "bug", label: "Issue", placeholder: "What went wrong? What did you expect?", icon: ICONS.issue },
    { id: "idea", label: "Idea", placeholder: "What would make this better?", icon: ICONS.idea },
    { id: "feedback", label: "Other", placeholder: "What's on your mind?", icon: ICONS.other },
  ];
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var SEND_KEYS = MAC ? "\\u2318\\u21b5" : "Ctrl+\\u21b5";

  var state = {
    screen: "form",
    kind: "feedback",
    text: "",
    email: "",
    media: null,
    shot: null,
    mediaKind: "none",
    seconds: 0,
    recording: false,
    rec: null,
    timer: null,
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

  var panel, title, closeBtn, body, foot, launch;
  var previewUrl = null;
  var generation = 0;
  var resetTimer = null;

  function render() {
    var focusId = body.contains(document.activeElement) ? document.activeElement.id : null;
    if (focusId === "fbx-stop-voice") focusId = "fbx-micbtn";
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    body.innerHTML = "";
    panel.setAttribute("aria-busy", String(state.busy));
    closeBtn.disabled = state.busy;

    if (state.screen === "done") {
      title.textContent = "Send feedback";
      var done = el("div", "fbx-done");
      done.setAttribute("role", "status");
      done.appendChild(el("div", "fbx-check", ICONS.check));
      var h = el("h3", "", "Thanks, feedback sent");
      var p = el("p", "", "We read every message.");
      done.appendChild(h);
      done.appendChild(p);
      body.appendChild(done);
      return;
    }

    // form screen: kind chips, note, optional email, then attachments + send.
    var k = KINDS.filter(function (x) { return x.id === state.kind; })[0];
    title.textContent = "Send feedback";

    var kinds = el("div", "fbx-kinds");
    kinds.setAttribute("role", "radiogroup");
    kinds.setAttribute("aria-label", "Feedback type");
    KINDS.forEach(function (option, i) {
      var chip = el("button", "fbx-kind", option.icon + "<span>" + option.label + "</span>");
      chip.type = "button";
      chip.id = "fbx-kind-" + option.id;
      chip.setAttribute("role", "radio");
      chip.setAttribute("aria-checked", String(option.id === state.kind));
      chip.tabIndex = option.id === state.kind ? 0 : -1;
      chip.disabled = state.busy;
      chip.addEventListener("click", function () { pickKind(option.id); });
      chip.addEventListener("keydown", function (e) {
        var step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        pickKind(KINDS[(i + step + KINDS.length) % KINDS.length].id, true);
      });
      kinds.appendChild(chip);
    });
    body.appendChild(kinds);
    function pickKind(id, keyboard) {
      if (state.kind === id) return;
      state.kind = id;
      KINDS.forEach(function (option) {
        var chip = document.getElementById("fbx-kind-" + option.id);
        chip.setAttribute("aria-checked", String(option.id === id));
        chip.tabIndex = option.id === id ? 0 : -1;
        if (keyboard && option.id === id) chip.focus();
        if (option.id === id) note.placeholder = option.placeholder;
      });
    }

    var note = el("textarea", "fbx-note");
    note.id = "fbx-note";
    note.placeholder = k.placeholder;
    note.setAttribute("aria-label", "Your feedback");
    note.maxLength = 5000;
    note.value = state.text;
    note.addEventListener("input", function () {
      state.text = note.value;
      sync();
    });
    body.appendChild(note);

    var mail = el("input", "fbx-mail");
    mail.id = "fbx-mail";
    mail.type = "email";
    mail.placeholder = "Email (optional, for follow-up)";
    mail.setAttribute("aria-label", "Email (optional)");
    mail.autocomplete = "email";
    mail.value = state.email;
    mail.addEventListener("input", function () { state.email = mail.value; });
    note.disabled = mail.disabled = state.busy;
    body.appendChild(mail);
    [note, mail].forEach(function (field) {
      field.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
      });
    });

    if (state.mediaKind === "screenshot" && state.media) {
      var img = el("img", "fbx-shot");
      previewUrl = URL.createObjectURL(state.media);
      img.src = previewUrl;
      img.alt = "Attached screenshot";
      var preview = el("div", "fbx-preview");
      if (state.shot) {
        var shotBtn = el("button", "fbx-shot-btn");
        shotBtn.setAttribute("aria-label", "Annotate screenshot");
        shotBtn.disabled = state.busy;
        shotBtn.appendChild(img);
        shotBtn.addEventListener("click", editAttached);
        preview.appendChild(shotBtn);
        var edit = el("button", "fbx-remove fbx-edit", ICONS.pen);
        edit.id = "fbx-editbtn";
        edit.title = "Annotate screenshot";
        edit.setAttribute("aria-label", edit.title);
        edit.disabled = state.busy;
        edit.addEventListener("click", editAttached);
        preview.appendChild(edit);
      } else {
        preview.appendChild(img);
      }
      preview.appendChild(removeButton("Remove screenshot", function () { state.media = null; state.shot = null; state.mediaKind = "none"; render(); }, "fbx-cambtn"));
      body.appendChild(preview);
    }
    if (state.mediaKind === "recording" && state.media) {
      var saved = el("div", "fbx-rec", ICONS.record + "<span>Page recording · " + fmt(state.seconds) + "</span>");
      saved.appendChild(removeButton("Remove page recording", function () { state.media = null; state.mediaKind = "none"; render(); }, "fbx-recbtn"));
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
    var cam = el("button", "fbx-cam", ICONS.camera);
    cam.id = "fbx-cambtn";
    cam.title = state.mediaKind === "screenshot" ? "Retake screenshot of this page" : "Screenshot this page";
    cam.setAttribute("aria-label", cam.title);
    cam.disabled = state.busy || state.recording;
    cam.addEventListener("click", takeScreenshot);
    // Warm the capture library so the first screenshot feels instant.
    cam.addEventListener("pointerenter", loadCapture);
    cam.addEventListener("focus", loadCapture);
    tools.appendChild(cam);

    var rec = el("button", "fbx-cam", ICONS.record);
    rec.title = state.mediaKind === "recording" ? "Record this page again" : "Record this page (up to 5 minutes)";
    rec.setAttribute("aria-label", rec.title);
    rec.disabled = state.busy || !canRecord();
    rec.id = "fbx-recbtn";
    rec.addEventListener("click", toggleRecord);
    rec.addEventListener("pointerenter", loadRecorder);
    rec.addEventListener("focus", loadRecorder);
    tools.appendChild(rec);

    var mic = el("button", "fbx-cam", ICONS.mic);
    mic.title = state.audioRecording ? "Stop voice note" : state.audio ? "Record a new voice note" : "Record a voice note (up to 5 minutes)";
    mic.setAttribute("aria-label", mic.title);
    mic.setAttribute("aria-pressed", String(state.audioRecording));
    mic.disabled = state.busy || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder;
    mic.id = "fbx-micbtn";
    mic.addEventListener("click", toggleVoice);
    tools.appendChild(mic);
    var send = el("button", "fbx-send");
    send.id = "fbx-send";
    send.title = "Send (" + (MAC ? "\\u2318" : "Ctrl") + "+Enter)";
    send.addEventListener("click", submit);
    tools.appendChild(send);
    body.appendChild(tools);

    function sync() {
      var btn = document.getElementById("fbx-send");
      if (btn) {
        btn.disabled = state.busy || state.recording || state.audioRecording || state.text.trim().length === 0;
        btn.innerHTML = state.busy ? "Sending\\u2026" : "Send<kbd>" + SEND_KEYS + "</kbd>";
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
      [note, mail, closeBtn, cam, rec, mic].forEach(function (control) { control.disabled = true; });
      body.querySelectorAll(".fbx-remove,.fbx-shot-btn,.fbx-kind").forEach(function (control) { control.disabled = true; });
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
        form.append("media", state.media, state.mediaKind === "screenshot" ? "screenshot.png" : "replay.json.gz");
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
            failed(result.status === 404 ? "This feedback board isn\\u2019t set up yet. Please try again later." : result.data.error);
            return;
          }
          state.screen = "done";
          render();
          closeBtn.focus({ preventScroll: true });
          resetTimer = setTimeout(function () { setOpen(false); }, 3000);
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
    button.id = "fbx-stop-voice";
    button.addEventListener("click", action);
    return button;
  }

  // Page recording without a screen-share prompt: rrweb (lazy-loaded from
  // /embed-record.js) records the page's DOM, mutations and input; the worker
  // replays it at /replay/<key>. The widget's own nodes carry the \`fbx\` class
  // and are blocked from the recording. Hard-capped at 5 minutes.
  var recordLib = null;
  function loadRecorder() {
    if (window.rrwebRecord) return Promise.resolve(window.rrwebRecord);
    if (!recordLib) {
      recordLib = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = endpoint + "/embed-record.js";
        s.async = true;
        s.onload = function () { window.rrwebRecord ? ok(window.rrwebRecord) : fail(new Error("recorder unavailable")); };
        s.onerror = function () { recordLib = null; fail(new Error("recorder unavailable")); };
        document.head.appendChild(s);
      });
      recordLib.catch(function () {});
    }
    return recordLib;
  }

  function canRecord() {
    return typeof CompressionStream === "function" && typeof MutationObserver === "function";
  }

  function toggleRecord() {
    if (state.recording) return stopRecording(true);
    if (state.busy || layer || !canRecord()) return;
    var gen = generation;
    loadRecorder().then(function (lib) {
      if (gen !== generation || state.recording || layer) return;
      var events = [];
      var stop = (lib.record || lib.default.record)({
        emit: function (event) { events.push(event); },
        blockClass: "fbx",
        maskInputOptions: { password: true },
        slimDOMOptions: "all",
        sampling: { mousemove: 50, scroll: 150, input: "last" },
      });
      if (!stop) throw new Error("recorder failed to start");
      state.rec = { stop: stop, events: events, gen: gen };
      state.recording = true;
      state.seconds = 0;
      away(true);
      launch.classList.add("fbx-away");
      showRecordBar();
      state.timer = setInterval(function () {
        state.seconds++;
        var t = document.getElementById("fbx-rectime");
        if (t) t.textContent = fmt(state.seconds);
        if (state.seconds >= 300) stopRecording(true);
      }, 1000);
    }).catch(function () {
      if (gen !== generation) return;
      showFormError("Recording isn\\u2019t available on this page right now.");
    });
  }

  // Loom-style floating control where the launcher sits.
  function showRecordBar() {
    var bar = el("div", "fbx fbx-anno fbx-recbar", '<span class="fbx-dot"></span><span class="fbx-rectime" id="fbx-rectime" role="timer" aria-label="Recording time">0:00</span>');
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Recording this page");
    var stopBtn = el("button", "fbx-recstop", '<span class="fbx-sq"></span>Stop');
    stopBtn.title = "Stop and attach";
    stopBtn.addEventListener("click", function () { stopRecording(true); });
    var discard = el("button", "fbx-recx", ICONS.close);
    discard.title = "Discard recording";
    discard.setAttribute("aria-label", discard.title);
    discard.addEventListener("click", function () { stopRecording(false); });
    bar.appendChild(stopBtn);
    bar.appendChild(discard);
    showLayer(bar);
  }

  function stopRecording(keep) {
    var rec = state.rec;
    if (!rec) return;
    state.rec = null;
    state.recording = false;
    clearInterval(state.timer);
    state.timer = null;
    try { rec.stop(); } catch (e) { /* already stopped */ }
    closeLayer();
    launch.classList.remove("fbx-away");
    if (rec.gen !== generation) return;
    if (!keep || rec.events.length < 2) {
      away(false);
      render();
      focusById("fbx-recbtn");
      return;
    }
    var seconds = state.seconds;
    packReplay(rec.events).then(function (blob) {
      if (rec.gen !== generation) return;
      state.media = blob;
      state.mediaKind = "recording";
      state.shot = null;
      state.seconds = seconds;
      away(false);
      render();
      focusById(state.text.trim() ? "fbx-send" : "fbx-note");
    }, function () {
      if (rec.gen !== generation) return;
      showFormError("Couldn\\u2019t save the recording. Please try again.");
    });
  }

  function packReplay(events) {
    var json = JSON.stringify({ v: 1, url: location.href, viewport: { w: innerWidth, h: innerHeight }, events: events });
    var gzipped = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(gzipped).blob().then(function (b) { return new Blob([b], { type: "application/gzip" }); });
  }

  function showFormError(message) {
    away(false);
    render();
    var error = body.querySelector(".fbx-err");
    if (error) { error.textContent = message; error.style.display = "block"; }
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
    state.screen = "form";
    state.kind = "feedback";
    state.text = "";
    state.email = "";
    closeLayer();
    panel.classList.remove("fbx-away");
    state.media = null;
    state.shot = null;
    state.mediaKind = "none";
    state.seconds = 0;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.rec) { try { state.rec.stop(); } catch (e) { /* already stopped */ } state.rec = null; }
    if (launch) launch.classList.remove("fbx-away");
    state.recording = false;
    state.audio = null;
    state.audioSeconds = 0;
    if (state.audioTimer) { clearInterval(state.audioTimer); state.audioTimer = null; }
    if (state.audioRecording && state.audioRecorder && state.audioRecorder.state !== "inactive") state.audioRecorder.stop();
    state.audioRecording = false;
    state.busy = false;
    render();
  }

  // ---- Screenshots -------------------------------------------------------
  // The camera captures the visible viewport in-page (DOM -> SVG -> canvas via
  // the lazily loaded /embed-capture.js), so there is no "choose a tab/screen"
  // prompt. Afterwards a small card asks whether to annotate or attach as is.
  // Screen sharing is only offered as a fallback when in-page capture fails.

  var captureLib = null;
  function loadCapture() {
    if (window.modernScreenshot) return Promise.resolve(window.modernScreenshot);
    if (!captureLib) {
      captureLib = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = endpoint + "/embed-capture.js";
        s.async = true;
        s.onload = function () { window.modernScreenshot ? ok(window.modernScreenshot) : fail(new Error("capture unavailable")); };
        s.onerror = function () { captureLib = null; fail(new Error("capture unavailable")); };
        document.head.appendChild(s);
      });
      captureLib.catch(function () {});
    }
    return captureLib;
  }

  function pageBackground() {
    var transparent = /^(transparent|rgba\\(.*,\\s*0\\))$/;
    var html = getComputedStyle(document.documentElement).backgroundColor;
    if (!transparent.test(html)) return html;
    var bodyBg = document.body ? getComputedStyle(document.body).backgroundColor : "";
    return bodyBg && !transparent.test(bodyBg) ? bodyBg : "#ffffff";
  }

  function capturePage() {
    return loadCapture().then(function (lib) {
      var root = document.documentElement;
      var rootStyle = getComputedStyle(root);
      var w = Math.min(innerWidth, root.clientWidth || innerWidth);
      var h = Math.min(innerHeight, root.clientHeight || innerHeight);
      var scale = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(w, 1));
      var shot = lib.domToCanvas(root, {
        width: w,
        height: h,
        scale: scale,
        backgroundColor: pageBackground(),
        // Shift the cloned page so the current scroll position lands in frame;
        // fixed and sticky elements keep their on-screen spots.
        style: {
          marginTop: parseFloat(rootStyle.marginTop) - scrollY + "px",
          marginLeft: parseFloat(rootStyle.marginLeft) - scrollX + "px",
        },
        filter: function (node) { return !(node.classList && node.classList.contains("fbx")); },
        features: { restoreScrollPosition: true },
        timeout: 6000,
      });
      var limit = new Promise(function (ok, fail) { setTimeout(function () { fail(new Error("capture timed out")); }, 15000); });
      return Promise.race([shot, limit]).then(function (canvas) {
        canvas.getContext("2d").getImageData(0, 0, 1, 1); // throws if the browser tainted the canvas
        return { base: canvas, unit: scale, shapes: [] };
      });
    });
  }

  // Fallback: one frame of a getDisplayMedia stream, preferring this tab.
  function shareCapture() {
    return navigator.mediaDevices
      .getDisplayMedia({ video: true, preferCurrentTab: true, selfBrowserSurface: "include" })
      .then(function (stream) {
        var stop = function () { stream.getTracks().forEach(function (t) { t.stop(); }); };
        var video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        return video.play()
          .then(function () { return new Promise(function (r) { setTimeout(r, 220); }); })
          .then(function () {
            var c = document.createElement("canvas");
            c.width = video.videoWidth || 1280;
            c.height = video.videoHeight || 720;
            c.getContext("2d").drawImage(video, 0, 0);
            stop();
            return { base: c, unit: Math.min(3, Math.max(1, c.width / Math.max(innerWidth, 1))), shapes: [] };
          }, function (e) { stop(); throw e; });
      });
  }

  // One floating layer (status pill, review card or editor) at a time.
  var layer = null;
  function showLayer(node, onKey, cleanup) {
    closeLayer();
    document.body.appendChild(node);
    if (onKey) window.addEventListener("keydown", onKey, true);
    layer = function () {
      node.remove();
      if (onKey) window.removeEventListener("keydown", onKey, true);
      if (cleanup) cleanup();
    };
  }
  function closeLayer() {
    if (!layer) return;
    var close = layer;
    layer = null;
    close();
  }

  function away(on) {
    panel.classList.toggle("fbx-away", on);
    panel.inert = on || !panel.classList.contains("fbx-open");
  }

  function focusById(id) {
    var node = document.getElementById(id);
    if (node && !node.disabled) node.focus({ preventScroll: true });
  }

  function takeScreenshot() {
    if (state.busy || state.recording || layer) return;
    var gen = generation;
    away(true);
    var pill = el("div", "fbx fbx-snap", '<span class="fbx-spin"></span>Capturing this page\\u2026');
    pill.setAttribute("role", "status");
    showLayer(pill);
    // Let the panel disappear before the (synchronous) DOM walk starts.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (gen !== generation) return;
        capturePage().then(function (shot) {
          if (gen !== generation) return;
          flash();
          reviewShot(shot);
        }, function () {
          if (gen !== generation) return;
          captureFailed();
        });
      });
    });
  }

  function flash() {
    var f = el("div", "fbx fbx-flash");
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 450);
  }

  function cardShell(label) {
    var card = el("div", "fbx fbx-anno fbx-qa");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", label);
    var head = el("div", "fbx-qa-head");
    head.appendChild(el("span")).textContent = label;
    var x = el("button", "fbx-qa-x", ICONS.close);
    x.setAttribute("aria-label", "Discard");
    x.title = "Discard (Esc)";
    head.appendChild(x);
    card.appendChild(head);
    var actions = el("div", "fbx-qa-actions");
    return { card: card, close: x, actions: actions };
  }

  function discardCapture() {
    closeLayer();
    away(false);
    focusById("fbx-cambtn");
  }

  function escapeTo(action) {
    return function (e) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      action();
    };
  }

  // CleanShot-style quick card: thumbnail + "Annotate" / "Attach".
  function reviewShot(shot) {
    var ui = cardShell("Screenshot captured");
    var thumb = el("button", "fbx-qa-thumb");
    thumb.setAttribute("aria-label", "Annotate screenshot");
    var mini = document.createElement("canvas");
    mini.width = 640;
    mini.height = Math.max(1, Math.round((640 * shot.base.height) / shot.base.width));
    drawShot(mini.getContext("2d"), shot, mini.width / shot.base.width);
    thumb.appendChild(mini);
    thumb.appendChild(el("span", "fbx-qa-hover", ICONS.pen + "Annotate"));
    ui.card.appendChild(thumb);

    var annotateBtn = el("button", "fbx-qa-btn", ICONS.pen + "<span>Annotate</span>");
    var attachBtn = el("button", "fbx-qa-btn fbx-qa-primary", "Attach");
    ui.actions.appendChild(annotateBtn);
    ui.actions.appendChild(attachBtn);
    ui.card.appendChild(ui.actions);

    function annotateIt() { openEditor(shot, function () { attachShot(shot); }, function () { reviewShot(shot); }); }
    thumb.addEventListener("click", annotateIt);
    annotateBtn.addEventListener("click", annotateIt);
    attachBtn.addEventListener("click", function () { attachShot(shot); });
    ui.close.addEventListener("click", discardCapture);
    showLayer(ui.card, escapeTo(discardCapture));
    attachBtn.focus({ preventScroll: true });
  }

  function captureFailed() {
    var canShare = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    var ui = cardShell("Couldn\\u2019t capture this page");
    ui.card.appendChild(el("p")).textContent = canShare
      ? "This page blocks in-page screenshots. You can share your screen instead."
      : "This page blocks in-page screenshots in this browser.";
    var cancel = el("button", "fbx-qa-btn", "Cancel");
    cancel.addEventListener("click", discardCapture);
    ui.actions.appendChild(cancel);
    if (canShare) {
      var share = el("button", "fbx-qa-btn fbx-qa-primary", "Share screen");
      share.addEventListener("click", function () {
        var gen = generation;
        share.disabled = true;
        shareCapture().then(function (shot) {
          if (gen === generation) reviewShot(shot);
        }, function () { share.disabled = false; });
      });
      ui.actions.appendChild(share);
    }
    ui.card.appendChild(ui.actions);
    ui.close.addEventListener("click", discardCapture);
    showLayer(ui.card, escapeTo(discardCapture));
    (share || cancel).focus({ preventScroll: true });
  }

  function attachShot(shot) {
    var gen = generation;
    shotBlob(shot).then(function (blob) {
      if (gen !== generation) return;
      closeLayer();
      state.shot = shot;
      state.media = blob;
      state.mediaKind = "screenshot";
      away(false);
      render();
      focusById(state.text.trim() ? "fbx-send" : "fbx-note");
    }, function () {
      if (gen !== generation) return;
      closeLayer();
      showFormError("Couldn\\u2019t attach the screenshot. Please try again.");
    });
  }

  function editAttached() {
    if (!state.shot || state.busy || layer) return;
    var shot = state.shot;
    away(true);
    openEditor(shot, function () { attachShot(shot); }, function () { away(false); focusById("fbx-editbtn"); });
  }

  function shotBlob(shot) {
    var c = document.createElement("canvas");
    c.width = shot.base.width;
    c.height = shot.base.height;
    drawShot(c.getContext("2d"), shot, 1);
    // The upload cap is 10 MB; very busy hi-dpi pages fall back to JPEG.
    return toBlob(c, "image/png").then(function (b) { return b.size > 9e6 ? toBlob(c, "image/jpeg", 0.9) : b; });
  }

  function toBlob(c, type, quality) {
    return new Promise(function (ok, fail) {
      c.toBlob(function (b) { b ? ok(b) : fail(new Error("encode failed")); }, type, quality);
    });
  }

  // ---- Annotation drawing --------------------------------------------------
  // Shapes live in screenshot pixels; \`unit\` is screenshot px per CSS px so
  // strokes look the same weight regardless of the capture's pixel ratio.

  var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  var TEXT_SIZE = 20;
  var COLORS = [
    ["#ef4444", "Red"], ["#f97316", "Orange"], ["#facc15", "Yellow"], ["#22c55e", "Green"],
    ["#3b82f6", "Blue"], ["#a855f7", "Purple"], ["#18181b", "Black"], ["#ffffff", "White"],
  ];
  var TOOLS = [
    ["arrow", "Arrow", "A"], ["rect", "Rectangle", "R"], ["ellipse", "Ellipse", "O"], ["pen", "Pen", "P"],
    ["marker", "Highlighter", "H"], ["text", "Text", "T"], ["counter", "Step number", "N"], ["blur", "Pixelate", "B"],
  ];
  var pref = { tool: "arrow", color: COLORS[0][0] };
  var scratch = null;

  function contrast(hex) {
    var n = parseInt(hex.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170 ? "#18181b" : "#ffffff";
  }

  // Draw the screenshot and its shapes; \`k\` scales for thumbnails.
  function drawShot(c, shot, k) {
    c.save();
    c.scale(k, k);
    c.drawImage(shot.base, 0, 0);
    shot.shapes.forEach(function (s) { paintShape(c, s, shot.unit); });
    c.restore();
  }

  function paintShape(c, s, u) {
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = c.fillStyle = s.c;
    if (s.t === "blur") {
      pixelate(c, s, u);
    } else if (s.t === "marker") {
      c.globalAlpha = 0.38;
      c.lineWidth = 18 * u;
      tracePath(c, s.pts);
      c.stroke();
    } else {
      c.shadowColor = "rgba(0,0,0,.28)";
      c.shadowBlur = 4 * u;
      c.shadowOffsetY = u;
      c.lineWidth = 4 * u;
      var x = Math.min(s.a.x, s.b ? s.b.x : 0), y = Math.min(s.a.y, s.b ? s.b.y : 0);
      if (s.t === "rect") {
        var w = Math.abs(s.b.x - s.a.x), h = Math.abs(s.b.y - s.a.y);
        c.beginPath();
        if (c.roundRect) c.roundRect(x, y, w, h, Math.min(4 * u, w / 2, h / 2));
        else c.rect(x, y, w, h);
        c.stroke();
      } else if (s.t === "ellipse") {
        c.beginPath();
        c.ellipse((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2, Math.abs(s.b.x - s.a.x) / 2, Math.abs(s.b.y - s.a.y) / 2, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (s.t === "pen") {
        if (s.pts.length === 1) {
          c.beginPath();
          c.arc(s.pts[0].x, s.pts[0].y, 2 * u, 0, Math.PI * 2);
          c.fill();
        } else {
          tracePath(c, s.pts);
          c.stroke();
        }
      } else if (s.t === "arrow") {
        paintArrow(c, s.a, s.b, u);
      } else if (s.t === "counter") {
        var r = 13 * u;
        c.beginPath();
        c.arc(s.a.x, s.a.y, r, 0, Math.PI * 2);
        c.fill();
        c.shadowColor = "transparent";
        c.lineWidth = 2 * u;
        c.strokeStyle = "#ffffff";
        c.stroke();
        c.fillStyle = contrast(s.c);
        c.font = "700 " + 14 * u + "px " + FONT;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(String(s.n), s.a.x, s.a.y + 0.5 * u);
      } else if (s.t === "text") {
        var size = TEXT_SIZE * u;
        c.font = "600 " + size + "px " + FONT;
        c.textBaseline = "top";
        s.text.split("\\n").forEach(function (line, i) {
          var ly = s.a.y + size * 0.125 + i * size * 1.25;
          c.lineWidth = 4 * u;
          c.strokeStyle = contrast(s.c);
          c.strokeText(line, s.a.x, ly);
          c.shadowColor = "transparent";
          c.fillText(line, s.a.x, ly);
        });
      }
    }
    c.restore();
  }

  function tracePath(c, pts) {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length - 1; i++) {
      c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    var last = pts[pts.length - 1];
    c.lineTo(last.x, last.y);
  }

  // Tapered shaft with a swept-back head.
  function paintArrow(c, a, b, u) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1) return;
    var ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    var w = 4.5 * u, head = Math.min(len * 0.6, 18 * u), wing = head * 0.6, tail = w * 0.2;
    var neck = { x: b.x - ux * head * 0.78, y: b.y - uy * head * 0.78 };
    var base = { x: b.x - ux * head, y: b.y - uy * head };
    c.beginPath();
    c.moveTo(a.x + nx * tail, a.y + ny * tail);
    c.lineTo(neck.x + (nx * w) / 2, neck.y + (ny * w) / 2);
    c.lineTo(base.x + nx * wing, base.y + ny * wing);
    c.lineTo(b.x, b.y);
    c.lineTo(base.x - nx * wing, base.y - ny * wing);
    c.lineTo(neck.x - (nx * w) / 2, neck.y - (ny * w) / 2);
    c.lineTo(a.x - nx * tail, a.y - ny * tail);
    c.closePath();
    c.fill();
    c.lineWidth = 1.5 * u;
    c.stroke();
  }

  // Masks whatever is already drawn under the rectangle.
  function pixelate(c, s, u) {
    var k = c.getTransform ? c.getTransform().a : 1; // thumbnails draw scaled
    var x = Math.max(0, Math.round(Math.min(s.a.x, s.b.x) * k)), y = Math.max(0, Math.round(Math.min(s.a.y, s.b.y) * k));
    var w = Math.min(c.canvas.width, Math.round(Math.max(s.a.x, s.b.x) * k)) - x;
    var h = Math.min(c.canvas.height, Math.round(Math.max(s.a.y, s.b.y) * k)) - y;
    if (w < 1 || h < 1) return;
    var block = Math.max(3, Math.round(10 * u * k));
    var tw = Math.ceil(w / block), th = Math.ceil(h / block);
    scratch = scratch || document.createElement("canvas");
    scratch.width = tw;
    scratch.height = th;
    var t = scratch.getContext("2d");
    t.imageSmoothingEnabled = true;
    t.drawImage(c.canvas, x, y, w, h, 0, 0, tw, th);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(scratch, 0, 0, tw, th, x, y, tw * block, th * block);
  }

  // ---- Annotation editor -------------------------------------------------

  function openEditor(shot, onDone, onCancel) {
    var u = shot.unit;
    var shapes = shot.shapes.slice(), undone = [];
    var tool = pref.tool, color = pref.color;
    var draft = null, typing = null, frame = 0;

    var overlay = el("div", "fbx fbx-anno fbx-ed");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Annotate screenshot");

    var bar = el("div", "fbx-tb");
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Annotation tools");
    function button(html, label, key) {
      var b = el("button", "", html);
      b.type = "button";
      b.setAttribute("aria-label", label + (key ? " (" + key + ")" : ""));
      b.setAttribute("data-tip", key ? label + "   " + key : label);
      bar.appendChild(b);
      return b;
    }
    function sep() { bar.appendChild(el("span", "fbx-sep")); }

    var cancelBtn = button(ICONS.close, "Cancel", "Esc");
    sep();
    var toolBtns = {};
    TOOLS.forEach(function (t) {
      toolBtns[t[0]] = button(ICONS[t[0]], t[1], t[2]);
      toolBtns[t[0]].addEventListener("click", function () { setTool(t[0]); });
    });
    sep();
    var colorBtn = button('<span class="fbx-swatch"></span>', "Color");
    colorBtn.setAttribute("aria-haspopup", "true");
    colorBtn.setAttribute("aria-expanded", "false");
    var swatch = colorBtn.firstChild;
    var undoBtn = button(ICONS.undo, "Undo", MAC ? "⌘Z" : "Ctrl+Z");
    var redoBtn = button(ICONS.redo, "Redo", MAC ? "⇧⌘Z" : "Ctrl+Y");
    var doneBtn = button("Done", "Done");
    doneBtn.setAttribute("data-tip", "Attach   \\u21b5");
    doneBtn.className = "fbx-tb-done";

    var pop = el("div", "fbx-pop");
    pop.setAttribute("role", "group");
    pop.setAttribute("aria-label", "Colors");
    pop.hidden = true;
    var swatches = COLORS.map(function (pair) {
      var s = el("button", "", "<span></span>");
      s.type = "button";
      s.firstChild.style.background = pair[0];
      s.setAttribute("aria-label", pair[1]);
      s.title = pair[1];
      s.addEventListener("click", function () { setColor(pair[0]); togglePop(false); colorBtn.focus(); });
      pop.appendChild(s);
      return s;
    });

    var stage = el("div", "fbx-stage");
    var canvas = el("canvas");
    canvas.width = shot.base.width;
    canvas.height = shot.base.height;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Screenshot being annotated");
    var ctx = canvas.getContext("2d");
    stage.appendChild(canvas);

    var hint = el("div", "fbx-ed-hint", "Drag to draw · <kbd>" + (MAC ? "⌘Z" : "Ctrl+Z") + "</kbd> undo · <kbd>↵</kbd> done · <kbd>Esc</kbd> cancel");
    overlay.appendChild(stage);
    overlay.appendChild(bar);
    overlay.appendChild(pop);
    overlay.appendChild(hint);

    function fit() {
      var small = innerWidth <= 640;
      var s = Math.min((innerWidth - (small ? 24 : 64)) / canvas.width, (innerHeight - (small ? 220 : 140)) / canvas.height);
      canvas.style.width = Math.round(canvas.width * s) + "px";
      canvas.style.height = Math.round(canvas.height * s) + "px";
    }

    function setTool(id) {
      commitText();
      tool = pref.tool = id;
      Object.keys(toolBtns).forEach(function (k) { toolBtns[k].setAttribute("aria-pressed", String(k === id)); });
      canvas.style.cursor = id === "text" ? "text" : "crosshair";
    }
    function setColor(value) {
      color = pref.color = value;
      swatch.style.background = value;
      swatches.forEach(function (s, i) { s.setAttribute("aria-pressed", String(COLORS[i][0] === value)); });
      if (typing) { typing.c = value; styleTextBox(); }
    }
    function togglePop(open) {
      pop.hidden = !open;
      colorBtn.setAttribute("aria-expanded", String(open));
      if (!open) return;
      var r = colorBtn.getBoundingClientRect();
      var left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left + r.width / 2 - pop.offsetWidth / 2));
      pop.style.left = left + "px";
      pop.style.top = (r.top > innerHeight / 2 ? r.top - pop.offsetHeight - 10 : r.bottom + 10) + "px";
      var current = swatches.filter(function (s) { return s.getAttribute("aria-pressed") === "true"; })[0];
      (current || swatches[0]).focus();
    }
    function sync() {
      undoBtn.disabled = !shapes.length;
      redoBtn.disabled = !undone.length;
    }
    function paintSoon() {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        drawShot(ctx, { base: shot.base, unit: u, shapes: shapes }, 1);
        if (draft) {
          paintShape(ctx, draft, u);
          if (draft.t === "blur") {
            ctx.save();
            ctx.setLineDash([4 * u, 4 * u]);
            ctx.lineWidth = u;
            ctx.strokeStyle = "rgba(255,255,255,.9)";
            ctx.strokeRect(draft.a.x, draft.a.y, draft.b.x - draft.a.x, draft.b.y - draft.a.y);
            ctx.restore();
          }
        }
      });
    }
    function add(s) {
      shapes.push(s);
      undone = [];
      sync();
      paintSoon();
      hint.style.opacity = "0";
    }
    function undo() {
      if (typing) return cancelText();
      if (!shapes.length) return;
      undone.push(shapes.pop());
      sync();
      paintSoon();
    }
    function redo() {
      if (!undone.length) return;
      shapes.push(undone.pop());
      sync();
      paintSoon();
    }

    function pt(e) {
      var r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
    }
    // Shift: squares/circles, and arrows snapped to 45 degrees.
    function constrain(a, p, shift, t) {
      if (!shift) return p;
      var dx = p.x - a.x, dy = p.y - a.y;
      if (t === "arrow") {
        var ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy);
        return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
      }
      var d = Math.max(Math.abs(dx), Math.abs(dy));
      return { x: a.x + (dx < 0 ? -d : d), y: a.y + (dy < 0 ? -d : d) };
    }

    canvas.addEventListener("mousedown", function (e) { e.preventDefault(); });
    canvas.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      togglePop(false);
      if (typing) {
        commitText();
        if (tool === "text") return;
      }
      var p = pt(e);
      if (tool === "text") return startText(p);
      if (tool === "counter") {
        return add({ t: "counter", c: color, a: p, n: shapes.filter(function (s) { return s.t === "counter"; }).length + 1 });
      }
      draft = { t: tool, c: color, a: p, b: p, pts: [p] };
      canvas.setPointerCapture(e.pointerId);
      paintSoon();
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!draft) return;
      if (draft.t === "pen" || draft.t === "marker") {
        var events = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        (events.length ? events : [e]).forEach(function (ev) { draft.pts.push(pt(ev)); });
      } else {
        draft.b = constrain(draft.a, pt(e), e.shiftKey, draft.t);
      }
      paintSoon();
    });
    function endDraw(e) {
      if (!draft) return;
      var s = draft;
      draft = null;
      var freehand = s.t === "pen" || s.t === "marker";
      if (e.type === "pointercancel" || (!freehand && Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) < 4 * u)) return paintSoon();
      add(s);
    }
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);

    // Text is typed into a positioned box, then rasterized on commit.
    function styleTextBox() {
      var k = canvas.clientWidth / canvas.width, size = TEXT_SIZE * u * k, o = Math.max(1, 1.5 * u * k) + "px ", halo = contrast(typing.c);
      typing.el.style.cssText = "left:" + typing.a.x * k + "px;top:" + typing.a.y * k + "px;font-size:" + size + "px;color:" + typing.c +
        ";caret-color:" + typing.c + ";text-shadow:" + ["-", ""].map(function (sx) {
          return ["-", ""].map(function (sy) { return sx + o + sy + o + "0 " + halo; }).join(",");
        }).join(",");
    }
    function startText(p) {
      var box = el("div", "fbx-text-in");
      try { box.contentEditable = "plaintext-only"; } catch (err) { /* older browsers */ }
      if (box.contentEditable !== "plaintext-only") box.contentEditable = "true";
      box.setAttribute("role", "textbox");
      box.setAttribute("aria-label", "Annotation text");
      typing = { el: box, a: { x: p.x, y: p.y - TEXT_SIZE * u * 0.62 }, c: color };
      styleTextBox();
      box.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); cancelText(); toolBtns.text.focus(); }
        else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); toolBtns.text.focus(); }
      });
      box.addEventListener("blur", commitText);
      stage.appendChild(box);
      box.focus();
    }
    function commitText() {
      if (!typing) return;
      var t = typing;
      typing = null;
      var text = (t.el.innerText || "").replace(/ /g, " ").replace(/\\s+$/, "");
      t.el.remove();
      if (text) add({ t: "text", c: t.c, a: t.a, text: text });
    }
    function cancelText() {
      if (!typing) return;
      var t = typing;
      typing = null;
      t.el.remove();
    }

    function finish() {
      commitText();
      shot.shapes = shapes;
      doneBtn.disabled = true;
      onDone();
    }
    function cancel() {
      cancelText();
      closeLayer();
      onCancel();
    }

    cancelBtn.addEventListener("click", cancel);
    doneBtn.addEventListener("click", finish);
    undoBtn.addEventListener("click", undo);
    redoBtn.addEventListener("click", redo);
    colorBtn.addEventListener("click", function () { togglePop(pop.hidden); });

    var keys = {};
    TOOLS.forEach(function (t) { keys[t[2].toLowerCase()] = t[0]; });
    function onKey(e) {
      if (typing && e.target === typing.el) return;
      var mod = e.metaKey || e.ctrlKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key, handled = true;
      if (k === "Escape") {
        if (!pop.hidden) { togglePop(false); colorBtn.focus(); } else cancel();
      } else if (mod && k === "z") {
        e.shiftKey ? redo() : undo();
      } else if (mod && k === "y") {
        redo();
      } else if (k === "Enter" && (mod || e.target.tagName !== "BUTTON")) {
        finish();
      } else if (k === "Tab") {
        var items = Array.prototype.filter.call(overlay.querySelectorAll("button"), function (b) { return !b.disabled && b.offsetParent; });
        var i = items.indexOf(document.activeElement);
        var next = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length];
        if (next) next.focus();
      } else if (!mod && !e.altKey && keys[k]) {
        setTool(keys[k]);
      } else {
        handled = false;
      }
      if (handled) e.preventDefault();
      // The editor is modal: keep keystrokes away from the host page.
      e.stopPropagation();
    }
    function onResize() { commitText(); fit(); togglePop(false); }
    function onWheel(e) { e.preventDefault(); }
    overlay.addEventListener("wheel", onWheel, { passive: false });

    setTool(tool);
    setColor(color);
    sync();
    fit();
    paintSoon();
    window.addEventListener("resize", onResize);
    showLayer(overlay, onKey, function () {
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
    });
    toolBtns[tool].focus({ preventScroll: true });
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
      // Type immediately; skip on touch so the keyboard doesn't cover the page.
      if (keyboard || matchMedia("(pointer:fine)").matches) focusById("fbx-note");
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
    var style = el("style", "fbx");
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
    panel.inert = true;
    var head = el("div", "fbx-head");
    title = el("h2", "fbx-title");
    title.id = "fbx-title";
    closeBtn = el("button", "fbx-close", ICONS.close);
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", function (event) { setOpen(false, event.detail === 0); });
    head.appendChild(title); head.appendChild(closeBtn);
    panel.appendChild(head);

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
`;
