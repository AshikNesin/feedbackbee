// Generated from embed/widget.js by apps/web/scripts/build-embed.py. Do not edit.
export const EMBED_JS = `(function () {
  "use strict";

  var VERSION = "2.0.0";

  // A second copy of the script (SPA re-insert) exits quietly.
  if (window.FeedbackBee && window.FeedbackBee.version) return;

  var script =
    document.currentScript ||
    (function () {
      var all = document.querySelectorAll('script[src*="/embed.js"]');
      return all[all.length - 1];
    })();

  // Config: data-* attributes first, init() merges over them later.
  var config = {
    project: null,
    endpoint: location.origin,
    headless: false,
    position: "right",
    preload: false,
  };
  if (script) {
    var attrProject = script.getAttribute("data-project");
    if (attrProject) config.project = attrProject;
    var attrEndpoint = script.getAttribute("data-endpoint");
    if (attrEndpoint) config.endpoint = attrEndpoint.replace(/\\/+$/, "");
    else if (script.src) config.endpoint = new URL(script.src).origin;
    config.position = script.getAttribute("data-position") === "bottom-left" ? "left" : "right";
    var attrHeadless = script.getAttribute("data-headless");
    config.headless = attrHeadless !== null && attrHeadless !== "false";
  }

  function css() {
    var position = config.position;
    return (
      ".fbx{--fb-ink:#18181b;--fb-muted:#71717a;--fb-tile:#f4f4f5;--fb-border:#e4e4e7;--fb-focus:#2563eb;color:var(--fb-ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:left;color-scheme:light}" +
      ".fbx,.fbx *{box-sizing:border-box}" +
      ".fbx button,.fbx input,.fbx textarea{font:inherit;letter-spacing:normal;margin:0}" +
      ".fbx button{appearance:none;text-transform:none;touch-action:manipulation;transition:transform 140ms cubic-bezier(.23,1,.32,1)}" +
      ".fbx button:active:not(:disabled){transform:scale(.97)}" +
      ".fbx button:focus-visible,.fbx a:focus-visible{outline:2px solid var(--fb-focus);outline-offset:3px}" +
      ".fbx button:disabled{cursor:default}" +
      ".fbx svg{display:block;width:20px;height:20px;flex:none;pointer-events:none}" +
      ".fbx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}" +
      ".fbx-launch{position:fixed;" +
      position +
      ":max(20px,env(safe-area-inset-" +
      position +
      "));bottom:max(20px,env(safe-area-inset-bottom));z-index:2147483000;width:48px;height:48px;border-radius:16px;background:var(--fb-ink);color:#fff;border:1px solid rgba(255,255,255,.12);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px #00000014,0 8px 24px #0000001f}" +
      ".fbx-panel{position:fixed;" +
      position +
      ":max(20px,env(safe-area-inset-" +
      position +
      "));bottom:calc(80px + env(safe-area-inset-bottom));z-index:2147483000;width:340px;max-width:calc(100vw - 40px);max-height:calc(100vh - 104px);max-height:calc(100dvh - 104px - env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain;background:#fff;border:1px solid var(--fb-border);border-radius:20px;box-shadow:0 4px 12px #00000008,0 20px 60px #0000001a;padding:16px;visibility:hidden;opacity:0;transform:translateY(6px) scale(.98);transform-origin:bottom " +
      position +
      ";transition:opacity 140ms ease,transform 180ms cubic-bezier(.23,1,.32,1),visibility 180ms}" +
      ".fbx-panel.fbx-open{visibility:visible;opacity:1;transform:translateY(0) scale(1);transition:opacity 140ms ease,transform 180ms cubic-bezier(.23,1,.32,1),visibility 0s}" +
      // Headless mode: centered modal with a dimmed backdrop sibling.
      ".fbx-backdrop{position:fixed;inset:0;z-index:2147482999;background:rgba(9,9,11,.5);opacity:0;pointer-events:none;transition:opacity 160ms ease}" +
      ".fbx-backdrop.fbx-show{opacity:1;pointer-events:auto}" +
      ".fbx-backdrop.fbx-away{opacity:0!important;pointer-events:none!important;transition:none!important}" +
      ".fbx-panel.fbx-modal{left:50%;right:auto;top:50%;bottom:auto;width:380px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);transform:translate(-50%,-50%) scale(.98);transform-origin:center}" +
      ".fbx-panel.fbx-modal.fbx-open{transform:translate(-50%,-50%) scale(1)}" +
      ".fbx-panel.fbx-instant,.fbx-instant button{transition:none}" +
      ".fbx-panel.fbx-dropping{outline:2px dashed var(--fb-focus);outline-offset:-6px}" +
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
      ".fbx-mailro{display:flex;align-items:center;gap:7px;min-height:40px;margin-top:8px;padding:10px 12px;border:1px solid var(--fb-border);border-radius:10px;background:var(--fb-tile);color:#52525b;font-size:13px}" +
      ".fbx-mailro svg{width:15px;height:15px;color:var(--fb-muted);flex:none}" +
      ".fbx-mailro span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      // Attachment tray: square tiles under the note, wrapping on narrow screens.
      ".fbx-tray{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}" +
      ".fbx-tile{position:relative;width:80px;height:80px;flex:none}" +
      ".fbx-tile-btn{position:relative;display:block;width:100%;height:100%;padding:0;border:1px solid var(--fb-border);border-radius:10px;overflow:hidden;background:var(--fb-tile);cursor:pointer}" +
      ".fbx-tile-img{display:block;width:100%;height:100%;object-fit:cover}" +
      ".fbx-tile-badge{position:absolute;left:4px;bottom:4px;width:22px;height:22px;border-radius:7px;background:rgba(24,24,27,.85);color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none}" +
      ".fbx-tile-badge svg{width:12px;height:12px}" +
      ".fbx-tile-hover{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:rgba(24,24,27,.42);color:#fff;font-size:11px;font-weight:600;opacity:0;transition:opacity 140ms ease;pointer-events:none}" +
      ".fbx-tile-hover svg{width:14px;height:14px}" +
      ".fbx-tile-btn:hover .fbx-tile-hover,.fbx-tile-btn:focus-visible .fbx-tile-hover{opacity:1}" +
      ".fbx-tile-x{position:absolute;top:2px;right:2px;width:24px;height:24px;padding:6px;border-radius:999px;background:rgba(24,24,27,.85);color:#fff;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1}" +
      ".fbx-tile-x svg{width:12px;height:12px}" +
      ".fbx-tile-rec{width:auto;min-width:80px;display:flex;align-items:center;gap:8px;padding:0 30px 0 12px;border:1px solid var(--fb-border);border-radius:10px;background:var(--fb-tile);font-size:12px;color:#52525b}" +
      ".fbx-tile-rec svg{width:16px;height:16px;color:var(--fb-muted)}" +
      ".fbx-tile-rec .fbx-tile-x{top:50%;right:2px;transform:translateY(-50%);background:transparent;color:var(--fb-muted)}" +
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
      ".fbx-recbar{position:fixed;" +
      position +
      ":max(20px,env(safe-area-inset-" +
      position +
      "));bottom:max(20px,env(safe-area-inset-bottom));z-index:2147483001;display:flex;align-items:center;gap:8px;padding:6px 6px 6px 16px;border-radius:999px;background:rgba(24,24,27,.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;box-shadow:0 8px 24px #0000002e;animation:fbx-rise 200ms cubic-bezier(.23,1,.32,1)}" +
      ".fbx-recbar .fbx-dot{background:#ef4444;animation:fbx-pulse 1.4s ease-in-out infinite}" +
      ".fbx-rectime{min-width:36px;font-size:13px;font-weight:500;font-variant-numeric:tabular-nums}" +
      ".fbx .fbx-recstop{display:flex;align-items:center;gap:7px;height:34px;padding:0 14px;border:0;border-radius:999px;background:#fff;color:#18181b;font-size:13px;font-weight:600;cursor:pointer}" +
      ".fbx-sq{width:9px;height:9px;border-radius:2px;background:#dc2626}" +
      ".fbx-recx{width:34px;height:34px;padding:9px;border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.7);cursor:pointer;display:flex;align-items:center;justify-content:center}" +
      ".fbx-recx svg{width:16px;height:16px}" +
      ".fbx-panel.fbx-open.fbx-away{visibility:hidden;opacity:0;transition:none;pointer-events:none}" +
      ".fbx-snap,.fbx-qa{position:fixed;" +
      position +
      ":max(20px,env(safe-area-inset-" +
      position +
      "));bottom:calc(80px + env(safe-area-inset-bottom));z-index:2147483001}" +
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
      ".fbx-pop{position:fixed;z-index:1;display:flex;gap:4px;padding:6px;border-radius:12px;background:rgba(30,30,34,.94);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);border:1px solid rgba(255,255,255,.09);box-shadow:0 10px 32px rgba(0,0,0,.36);animation:fbx-fade 120ms ease}" +
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
      "@media(hover:hover) and (pointer:fine){.fbx .fbx-kind:not([aria-checked=true]):hover,.fbx-cam:hover:not(:disabled),.fbx-close:hover,.fbx-remove:hover,.fbx-tile-x:hover,.fbx-qa-x:hover,.fbx .fbx-qa-btn:not(.fbx-qa-primary):hover{background:var(--fb-tile)}.fbx-tile-x:hover{background:#27272a;color:#fff}.fbx-send:hover:not(:disabled),.fbx-launch:hover,.fbx .fbx-qa-primary:hover{background:#27272a}" +
      ".fbx-qa-thumb:hover .fbx-qa-hover{opacity:1}.fbx-tb button:hover:not(:disabled):not([aria-pressed=true]),.fbx-pop button:hover{background:rgba(255,255,255,.08);color:#fff}.fbx .fbx-tb .fbx-tb-done:hover{background:#e4e4e7}" +
      ".fbx-recx:hover{background:rgba(255,255,255,.1);color:#fff}.fbx .fbx-recstop:hover{background:#e4e4e7}.fbx-tb [data-tip]:hover::after{opacity:1;transform:translate(-50%,0);transition-delay:450ms}}" +
      "@media(prefers-reduced-motion:reduce){.fbx-panel,.fbx-backdrop,.fbx button{transition:none}.fbx button:active:not(:disabled){transform:none}.fbx-flash{display:none}.fbx-recbar .fbx-dot{animation:none}.fbx-snap,.fbx-recbar,.fbx-qa,.fbx-ed,.fbx-stage,.fbx-pop{animation:none}}" +
      "@media(max-width:640px){.fbx-tb{top:auto;bottom:max(12px,env(safe-area-inset-bottom));flex-wrap:wrap;justify-content:center;row-gap:4px;width:max-content}.fbx-sep{display:none}.fbx-tb button{width:38px;height:38px;padding:10px}.fbx-tb [data-tip]::after,.fbx-ed-hint{display:none}.fbx-snap,.fbx-qa{left:12px;right:12px;width:auto;max-width:none}.fbx-snap{justify-content:center}}" +
      "@media(pointer:coarse){.fbx .fbx-note,.fbx .fbx-mail{font-size:16px}.fbx .fbx-kind{min-height:40px}.fbx-send kbd{display:none}.fbx-tile-hover{display:none}.fbx-tile-x{width:28px;height:28px;padding:7px}}" +
      "@media(max-width:400px){.fbx-panel{" +
      position +
      ":12px;max-width:calc(100vw - 24px)}.fbx-launch{" +
      position +
      ":16px}}"
    );
  }

  var ICONS = {
    issue:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 10 17H2L12 3z"/><path d="M12 9v4m0 3h.01"/></svg>',
    feature_request:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17c0-2-3-3-3-7a6 6 0 0 1 12 0c0 4-3 5-3 7H9zm0 3h6m-5 3h4"/></svg>',
    other:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/></svg>',
    camera:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/><line x1="18" y1="2" x2="18" y2="6"/><line x1="16" y1="4" x2="20" y2="4"/></svg>',
    attach:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    record:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="14" rx="3"/><path d="M22 8.5v7L16 12z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>',
    arrow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 18 6M9 5.5h9.5V15"/></svg>',
    rect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/></svg>',
    ellipse:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="12" rx="8.5" ry="7"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.2-4.2L16.4 4.6a2.1 2.1 0 0 1 3 3L8.2 18.8 4 20z"/><path d="m14.5 6.5 3 3"/></svg>',
    marker:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 4.5 4.5 4.5-8 8H7v-4.5l8-8z"/><path d="M4 21h9" stroke-width="2.6" opacity=".55"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7V5h14v2M12 5v14M9 19h6"/></svg>',
    counter:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M10.5 9.5 12.5 8v8"/></svg>',
    blur: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h5v5H4zM15 4h5v5h-5zM9.5 9.5h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z" opacity=".9"/><path d="M9.5 4h5v5h-5zM4 9.5h5v5H4zM15 9.5h5v5h-5zM9.5 15h5v5h-5z" opacity=".35"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
  };

  var KINDS = [
    {
      id: "issue",
      label: "Issue",
      formTitle: "Report an issue",
      placeholder: "What went wrong? What did you expect?",
      icon: ICONS.issue,
    },
    {
      id: "feature_request",
      label: "Feature request",
      formTitle: "Request a feature",
      placeholder: "What would make this better?",
      icon: ICONS.feature_request,
    },
    {
      id: "other",
      label: "Other",
      formTitle: "Tell us more",
      placeholder: "What's on your mind?",
      icon: ICONS.other,
    },
  ];
  var KIND_BY_ID = {};
  KINDS.forEach(function (k) {
    KIND_BY_ID[k.id] = k;
  });
  // Old kind names still come from cached widgets and host code; the open()
  // promise rejects with a rename hint instead of silently using the default.
  var RENAMED_KINDS = { bug: "issue", idea: "feature_request", feedback: "other" };
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var SEND_KEYS = MAC ? "\\u2318\\u21b5" : "Ctrl+\\u21b5";
  var PASTE_HINT = " (paste screenshots with " + (MAC ? "\\u2318V" : "Ctrl+V") + ")";
  var MAX_IMAGES = 5;
  var IMAGE_MIME = /^image\\/(png|jpe?g|webp|gif|bmp|avif)$/;

  var state = {
    screen: "form",
    kind: "other",
    lockKind: false,
    text: "",
    email: "",
    emailLocked: false,
    images: [], // [{ id, shot, blob, thumb, source }]
    recording: null, // { blob, seconds } | null
    seconds: 0,
    recordingActive: false,
    rec: null,
    timer: null,
    audio: null,
    audioSeconds: 0,
    audioRecording: false,
    audioRecorder: null,
    audioTimer: null,
    audioChunks: [],
    busy: false,
    // Per-open overrides (open() options), cleared on close.
    openOpts: null,
  };

  // Sticky context set by the host (identify/setContext/init).
  var sticky = { user: null, metadata: {} };
  var listeners = {}; // event name -> [fn]
  var openPromise = null; // in-flight open() promise state
  var imageSeq = 0;
  var booted = false;
  var domReady = false;
  var styleEl = null;

  function whenReady(fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", function () {
        fn();
      });
    else fn();
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  var panel, title, closeBtn, body, foot, launch, backdrop, fileInput, liveRegion;
  var generation = 0;
  var resetTimer = null;
  var lastFocused = null; // element focused before open(); restored on close
  var prevOverflow = "";

  // ---- Events ------------------------------------------------------------

  function emit(name, detail) {
    (listeners[name] || []).slice().forEach(function (fn) {
      try {
        fn(detail);
      } catch (e) {
        /* a host listener must not break the widget */
      }
    });
    try {
      window.dispatchEvent(new CustomEvent("feedbackbee:" + name, { detail: detail }));
    } catch (e) {
      /* older browsers */
    }
  }

  function on(name, fn) {
    if (typeof fn !== "function") return function () {};
    if (!listeners[name]) listeners[name] = [];
    listeners[name].push(fn);
    return function () {
      listeners[name] = listeners[name].filter(function (f) {
        return f !== fn;
      });
    };
  }

  function off(name, fn) {
    if (listeners[name])
      listeners[name] = listeners[name].filter(function (f) {
        return f !== fn;
      });
  }

  // ---- Metadata validation (same rules as the server) ---------------------

  var META_KEY = /^[A-Za-z0-9_.-]{1,40}$/;
  var MAX_META_KEYS = 20;
  var MAX_META_BYTES = 4096;

  // Returns a plain object of valid keys; invalid ones are dropped with a warn.
  function cleanMetadata(obj, label) {
    if (!obj || typeof obj !== "object") return {};
    var out = {};
    var count = 0;
    Object.keys(obj).forEach(function (key) {
      if (count >= MAX_META_KEYS) {
        console.warn("[feedbackbee] metadata: at most 20 keys, dropping " + key);
        return;
      }
      var value = obj[key];
      if (
        !META_KEY.test(key) ||
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype"
      ) {
        console.warn(
          "[feedbackbee] " + (label || "metadata") + ": invalid key " + JSON.stringify(key),
        );
        return;
      }
      if (typeof value === "string") {
        if (value.length > 500) {
          console.warn(
            "[feedbackbee] " +
              (label || "metadata") +
              ": value for " +
              key +
              " exceeds 500 chars, dropping",
          );
          return;
        }
      } else if (typeof value === "number") {
        if (!isFinite(value)) {
          console.warn(
            "[feedbackbee] " +
              (label || "metadata") +
              ": value for " +
              key +
              " is not finite, dropping",
          );
          return;
        }
      } else if (typeof value !== "boolean") {
        console.warn(
          "[feedbackbee] " +
            (label || "metadata") +
            ": value for " +
            key +
            " must be a string, number or boolean, dropping",
        );
        return;
      }
      out[key] = value;
      count++;
    });
    return out;
  }

  function metadataSize(obj) {
    try {
      return new Blob([JSON.stringify(obj)]).size;
    } catch (e) {
      return JSON.stringify(obj).length;
    }
  }

  // Merge several metadata sources (open > identify/setContext > init) and
  // keep the combined JSON under 4 KB by dropping newly-added keys.
  function mergedMetadata() {
    var out = {};
    var key;
    for (key in sticky.metadata) out[key] = sticky.metadata[key];
    if (state.openOpts && state.openOpts.metadata) {
      for (key in state.openOpts.metadata) out[key] = state.openOpts.metadata[key];
    }
    while (metadataSize(out) > MAX_META_BYTES) {
      var added = null;
      if (state.openOpts && state.openOpts.metadata) {
        for (key in state.openOpts.metadata)
          if (!(key in sticky.metadata)) {
            added = key;
            break;
          }
      }
      if (added === null) break;
      console.warn("[feedbackbee] metadata: combined size exceeds 4 KB, dropping " + added);
      delete out[added];
    }
    return out;
  }

  // ---- Panel rendering ---------------------------------------------------

  function panelTitle() {
    if (state.openOpts && state.openOpts.title) return state.openOpts.title;
    var k = KIND_BY_ID[state.kind] || KIND_BY_ID.other;
    return k.formTitle;
  }

  function render() {
    var focusId = body.contains(document.activeElement) ? document.activeElement.id : null;
    if (focusId === "fbx-stop-voice") focusId = "fbx-micbtn";
    body.innerHTML = "";
    panel.setAttribute("aria-busy", String(state.busy));
    closeBtn.disabled = state.busy;

    if (state.screen === "done") {
      title.textContent = panelTitle();
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

    // form screen: kind chips, note, optional email, attachments, send.
    title.textContent = panelTitle();

    if (!state.lockKind) {
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
        chip.addEventListener("click", function () {
          pickKind(option.id);
        });
        chip.addEventListener("keydown", function (e) {
          var step =
            e.key === "ArrowRight" || e.key === "ArrowDown"
              ? 1
              : e.key === "ArrowLeft" || e.key === "ArrowUp"
                ? -1
                : 0;
          if (!step) return;
          e.preventDefault();
          pickKind(KINDS[(i + step + KINDS.length) % KINDS.length].id, true);
        });
        kinds.appendChild(chip);
      });
      body.appendChild(kinds);
    }

    var note = el("textarea", "fbx-note");
    note.id = "fbx-note";
    note.placeholder = notePlaceholder();
    note.setAttribute("aria-label", "Your feedback");
    note.maxLength = 5000;
    note.value = state.text;
    note.disabled = state.busy;
    note.addEventListener("input", function () {
      state.text = note.value;
      sync();
    });
    body.appendChild(note);

    if (state.emailLocked && state.email) {
      // Identified reporter: the email is a claim, shown read-only.
      var ro = el("div", "fbx-mailro", ICONS.mail + "<span></span>");
      ro.title = "Only visible to the team";
      ro.setAttribute("aria-label", "Replying to " + state.email);
      ro.lastChild.textContent = "Replying to " + state.email;
      body.appendChild(ro);
    } else {
      var mail = el("input", "fbx-mail");
      mail.id = "fbx-mail";
      mail.type = "email";
      mail.placeholder = "Email (optional, only visible to the team)";
      mail.setAttribute("aria-label", "Email (optional)");
      mail.autocomplete = "email";
      mail.value = state.email;
      mail.addEventListener("input", function () {
        state.email = mail.value;
      });
      body.appendChild(mail);
    }
    bindOpenHotkeys([note, mail || null].filter(Boolean));

    if (state.images.length || state.recording) renderTray();

    if (state.audioRecording) {
      var micInd = el(
        "div",
        "fbx-rec",
        '<span class="fbx-dot"></span><span id="fbx-mtimer">Voice note \\u00b7 ' +
          fmt(state.audioSeconds) +
          " / 5:00</span>",
      );
      micInd.appendChild(stopButton(toggleVoice));
      body.appendChild(micInd);
    } else if (state.audio) {
      var savedAudio = el(
        "div",
        "fbx-rec",
        ICONS.mic + "<span>Voice note \\u00b7 " + fmt(state.audioSeconds) + "</span>",
      );
      savedAudio.appendChild(
        removeButton(
          "Remove voice note",
          function () {
            state.audio = null;
            state.audioSeconds = 0;
            render();
          },
          "fbx-micbtn",
        ),
      );
      body.appendChild(savedAudio);
    }

    var err = el("div", "fbx-err");
    err.setAttribute("role", "alert");
    err.id = "fbx-err";
    body.appendChild(err);

    var tools = el("div", "fbx-tools");
    var cam = el("button", "fbx-cam", ICONS.camera);
    cam.id = "fbx-cambtn";
    cam.title = "Screenshot this page";
    cam.setAttribute("aria-label", cam.title);
    cam.disabled = state.busy || state.recordingActive;
    cam.addEventListener("click", takeScreenshot);
    cam.addEventListener("pointerenter", loadCapture);
    cam.addEventListener("focus", loadCapture);
    tools.appendChild(cam);

    var pick = el("button", "fbx-cam", ICONS.attach);
    pick.id = "fbx-attachbtn";
    pick.title = "Attach images";
    pick.setAttribute("aria-label", "Attach images");
    pick.disabled = state.busy;
    pick.addEventListener("click", function () {
      if (!state.busy) fileInput.click();
    });
    tools.appendChild(pick);

    var rec = el("button", "fbx-cam", ICONS.record);
    rec.title = state.recording
      ? "Remove the current recording to record a new one"
      : "Record this page (up to 5 minutes)";
    rec.setAttribute("aria-label", rec.title);
    rec.disabled = state.busy || !!state.recording || !canRecord();
    rec.id = "fbx-recbtn";
    rec.addEventListener("click", toggleRecord);
    rec.addEventListener("pointerenter", loadRecorder);
    rec.addEventListener("focus", loadRecorder);
    tools.appendChild(rec);

    var mic = el("button", "fbx-cam", ICONS.mic);
    mic.title = state.audioRecording
      ? "Stop voice note"
      : state.audio
        ? "Record a new voice note"
        : "Record a voice note (up to 5 minutes)";
    mic.setAttribute("aria-label", mic.title);
    mic.setAttribute("aria-pressed", String(state.audioRecording));
    mic.disabled =
      state.busy ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      !window.MediaRecorder;
    mic.id = "fbx-micbtn";
    mic.addEventListener("click", toggleVoice);
    tools.appendChild(mic);

    var send = el("button", "fbx-send");
    send.id = "fbx-send";
    send.title = "Send (" + (MAC ? "\\u2318" : "Ctrl") + "+Enter)";
    send.addEventListener("click", submit);
    tools.appendChild(send);
    body.appendChild(tools);

    function pickKind(id, keyboard) {
      if (state.kind === id || state.busy) return;
      state.kind = id;
      KINDS.forEach(function (option) {
        var chip = document.getElementById("fbx-kind-" + option.id);
        if (!chip) return;
        chip.setAttribute("aria-checked", String(option.id === id));
        chip.tabIndex = option.id === id ? 0 : -1;
        if (keyboard && option.id === id) chip.focus({ preventScroll: true });
      });
      var noteEl = document.getElementById("fbx-note");
      if (noteEl) noteEl.placeholder = notePlaceholder();
      title.textContent = panelTitle();
      emit("kind", { kind: id });
    }

    function sync() {
      var btn = document.getElementById("fbx-send");
      if (btn) {
        btn.disabled =
          state.busy ||
          state.recordingActive ||
          state.audioRecording ||
          state.text.trim().length === 0;
        btn.innerHTML = state.busy ? "Sending\\u2026" : "Send<kbd>" + SEND_KEYS + "</kbd>";
      }
    }
    sync();
    if (focusId) {
      var focused = document.getElementById(focusId);
      if (focused && !focused.disabled) focused.focus({ preventScroll: true });
    }

    function bindOpenHotkeys(fields) {
      fields.forEach(function (field) {
        field.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        });
      });
    }

    function submit() {
      if (state.busy || state.recordingActive || state.audioRecording || !state.text.trim()) return;
      if (!formEmailValid()) return;
      state.busy = true;
      sync();
      panel.setAttribute("aria-busy", "true");
      setControlsDisabled(true);
      hideError();
      var requestGeneration = generation;

      function failed(message, status) {
        state.busy = false;
        render();
        var error = body.querySelector(".fbx-err");
        if (error) {
          error.textContent = message;
          error.style.display = "block";
        }
        emit("error", { status: status || 0, message: message });
      }

      var form = new FormData();
      form.append("project", config.project);
      form.append("kind", state.kind);
      form.append("text", state.text.trim());
      if (state.email.trim()) form.append("email", state.email.trim());
      form.append("url", (state.openOpts && state.openOpts.url) || location.href);
      form.append("os_name", "web");
      form.append("os_version", navigator.userAgent.slice(0, 64));
      form.append("screen_w", screen.width);
      form.append("screen_h", screen.height);
      form.append("user_agent", navigator.userAgent);
      if (sticky.user && sticky.user.name)
        form.append("reporter_name", String(sticky.user.name).slice(0, 120));
      if (sticky.user && sticky.user.id)
        form.append("reporter_id", String(sticky.user.id).slice(0, 128));
      var metadata = mergedMetadata();
      if (Object.keys(metadata).length) form.append("metadata", JSON.stringify(metadata));
      var appVersion =
        (state.openOpts && state.openOpts.appVersion) ||
        (state.openOpts && state.openOpts.app_version) ||
        null;
      if (appVersion) form.append("app_version", String(appVersion).slice(0, 64));
      var imagesDone = Promise.all(
        state.images.map(function (img, i) {
          return Promise.resolve(img.blob).then(function (blob) {
            form.append("image", blob, "image-" + (i + 1) + ".png");
          });
        }),
      );
      imagesDone
        .then(function () {
          if (state.recording) {
            form.append("media", state.recording.blob, "replay.json.gz");
            form.append("media_seconds", Math.round(state.recording.seconds));
          }
          if (state.audio) {
            form.append("audio", state.audio, "voice.webm");
            form.append("audio_seconds", Math.round(state.audioSeconds));
          }
          return fetch(config.endpoint + "/api/v1/feedback", { method: "post", body: form });
        })
        .then(function (r) {
          // Envelope: {success, data: {id, state}} or {success: false, error: {message}}.
          return r.json().then(
            function (body) {
              return {
                status: r.status,
                ok: !!(body && body.success),
                data: (body && body.data) || {},
                error: body && body.error ? body.error.message : null,
              };
            },
            function () {
              return {
                status: r.status,
                ok: false,
                data: {},
                error: "Couldn't read the server response.",
              };
            },
          );
        })
        .then(function (result) {
          if (requestGeneration !== generation) return;
          state.busy = false;
          if (!result.ok) {
            failed(
              result.status === 404
                ? "This feedback board isn\\u2019t set up yet. Please try again later."
                : result.error || "Couldn't send your feedback. Please try again.",
              result.status,
            );
            return;
          }
          state.screen = "done";
          render();
          settleOpen({
            status: "submitted",
            id: result.data.id,
            kind: state.kind,
            state: result.data.state,
          });
          closeBtn.focus({ preventScroll: true });
          resetTimer = setTimeout(function () {
            closePanel("submitted");
          }, 3000);
        })
        .catch(function () {
          if (requestGeneration !== generation) return;
          failed("Couldn't send your feedback. Please try again.", 0);
        });
    }
  }

  function formEmailValid() {
    var mail = document.getElementById("fbx-mail");
    return !mail || mail.reportValidity();
  }

  function setControlsDisabled(disabled) {
    body.querySelectorAll("button,input,textarea").forEach(function (control) {
      control.disabled = disabled;
    });
  }

  function hideError() {
    var error = body.querySelector(".fbx-err");
    if (error) error.style.display = "none";
  }

  function notePlaceholder() {
    var base = (KIND_BY_ID[state.kind] || KIND_BY_ID.other).placeholder;
    var override = state.openOpts && state.openOpts.placeholder;
    var text = override || base;
    if (override || !matchMedia("(pointer:fine)").matches) return text;
    return text + PASTE_HINT;
  }

  function removeButton(label, action, focusId) {
    var button = el("button", "fbx-remove", ICONS.close);
    button.setAttribute("aria-label", label);
    button.title = label;
    button.disabled = state.busy;
    button.addEventListener("click", function () {
      action();
      focusById(focusId);
    });
    return button;
  }

  function stopButton(action) {
    var button = el("button", "fbx-stop", "Stop");
    button.id = "fbx-stop-voice";
    button.addEventListener("click", action);
    return button;
  }

  // ---- Attachment tray ----------------------------------------------------

  function renderTray() {
    var tray = el("div", "fbx-tray");
    tray.setAttribute("role", "group");
    tray.setAttribute("aria-label", "Attachments");

    state.images.forEach(function (img, i) {
      var tile = el("div", "fbx-tile");

      var annotate = el("button", "fbx-tile-btn");
      annotate.type = "button";
      annotate.setAttribute(
        "aria-label",
        "Annotate image " + (i + 1) + " of " + state.images.length,
      );
      annotate.title = "Annotate image " + (i + 1);
      annotate.disabled = state.busy;
      annotate.addEventListener("click", function () {
        editImage(img.id);
      });
      annotate.addEventListener("keydown", function (e) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          removeImage(img.id);
        }
      });
      var pic = el("img", "fbx-tile-img");
      pic.alt = "";
      if (img.thumb) pic.src = img.thumb;
      annotate.appendChild(pic);
      if (img.shot && img.shot.shapes.length)
        annotate.appendChild(el("span", "fbx-tile-badge", ICONS.pen));
      annotate.appendChild(el("span", "fbx-tile-hover", ICONS.pen + "<span>Annotate</span>"));
      annotate.id = "fbx-tilebtn-" + img.id;
      tile.appendChild(annotate);

      tile.appendChild(
        tileDelete("Delete image " + (i + 1), function () {
          removeImage(img.id);
        }),
      );
      tile.id = "fbx-tile-" + img.id;
      tray.appendChild(tile);
    });

    if (state.recording) {
      var recTile = el(
        "div",
        "fbx-tile fbx-tile-rec",
        ICONS.record + "<span>" + fmt(state.recording.seconds) + "</span>",
      );
      recTile.appendChild(tileDelete("Remove page recording", removeRecording));
      tray.appendChild(recTile);
    }

    body.appendChild(tray);
  }

  function tileDelete(label, action) {
    var x = el("button", "fbx-tile-x", ICONS.close);
    x.type = "button";
    x.setAttribute("aria-label", label);
    x.title = label;
    x.disabled = state.busy;
    x.addEventListener("click", function (e) {
      e.stopPropagation();
      action();
    });
    return x;
  }

  function removeImage(id) {
    var idx = -1;
    state.images.forEach(function (img, i) {
      if (img.id === id) idx = i;
    });
    if (idx < 0) return;
    releaseShot(state.images[idx].shot);
    state.images.splice(idx, 1);
    render();
    announce("Image removed");
    var next = state.images[Math.min(idx, state.images.length - 1)];
    if (next) focusById("fbx-tilebtn-" + next.id);
    else focusById("fbx-note");
  }

  function removeRecording() {
    state.recording = null;
    render();
    focusById("fbx-recbtn");
  }

  function announce(message) {
    if (liveRegion) liveRegion.textContent = message;
  }

  // ---- Image intake (paste / drop / pick / host) ---------------------------

  // Per the design: per tile we keep the original encoded blob, the upload
  // blob and a ~128px thumbnail canvas; the full-size base canvas is decoded
  // only while the editor is open, then released.
  function shotFromFile(file, source) {
    var decode =
      typeof createImageBitmap === "function"
        ? createImageBitmap(file, { imageOrientation: "from-image" })
        : decodeViaImg(file);
    return decode.then(function (bmp) {
      var w = bmp.width,
        h = bmp.height;
      var scale = Math.min(1, 4096 / Math.max(w, h, 1));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * scale));
      c.height = Math.max(1, Math.round(h * scale));
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      if (bmp.close) bmp.close();
      return {
        base: c,
        unit: Math.min(3, Math.max(1, c.width / Math.max(innerWidth, 1))),
        shapes: [],
        source: source,
        original: file,
      };
    });
  }

  function decodeViaImg(file) {
    return new Promise(function (ok, fail) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        ok({ width: img.naturalWidth, height: img.naturalHeight, src: img });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        fail(new Error("decode failed"));
      };
      img.src = url;
    })
      .then(function (info) {
        // drawImage accepts an <img>; wrap so the common path stays identical.
        var bmp = info.src;
        return { width: info.width, height: info.height, close: function () {}, __img: bmp };
      })
      .then(function (fake) {
        var scale = Math.min(1, 4096 / Math.max(fake.width, fake.height, 1));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(fake.width * scale));
        c.height = Math.max(1, Math.round(fake.height * scale));
        c.getContext("2d").drawImage(fake.__img, 0, 0, c.width, c.height);
        return c;
      });
  }

  function makeThumb(shot) {
    var w = 128;
    var h = Math.max(1, Math.round((shot.base.height * w) / Math.max(shot.base.width, 1)));
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    drawShot(c.getContext("2d"), shot, w / shot.base.width);
    try {
      return c.toDataURL("image/png");
    } catch (e) {
      return null;
    }
  }

  function imageRoom() {
    return MAX_IMAGES - state.images.length;
  }

  function trayFull() {
    showFormError("You can attach up to " + MAX_IMAGES + " images");
  }

  function onlyImages() {
    showFormError("Only images can be attached");
  }

  function cantRead() {
    showFormError("Couldn\\u2019t read that image");
  }

  function imageFiles(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (isImageFile(f)) out.push(f);
    }
    return out;
  }

  function isImageFile(f) {
    if (!f || typeof f.type !== "string") return false;
    return IMAGE_MIME.test(f.type);
  }

  // Adds decoded files one by one: first that fit go in, rest are reported.
  function addFiles(files, source) {
    var imgs = imageFiles(files);
    var total = files && files.length ? files.length : 0;
    if (!imgs.length) {
      if (total) onlyImages();
      return;
    }
    var room = imageRoom();
    if (room <= 0) {
      trayFull();
      return;
    }
    var take = imgs.slice(0, room);
    if (take.length < imgs.length || imgs.length < total) trayFull();
    var chain = Promise.resolve();
    var added = 0,
      failed = 0;
    take.forEach(function (f) {
      chain = chain.then(function () {
        return shotFromFile(f, source).then(
          function (shot) {
            return addImage(shot).then(function () {
              added++;
            });
          },
          function () {
            failed++;
          },
        );
      });
    });
    chain.then(function () {
      if (failed && !added) cantRead();
      else if (failed)
        announce(
          failed === 1
            ? "Couldn\\u2019t read that image"
            : "Couldn\\u2019t read " + failed + " images",
        );
    });
  }

  // shot -> tray tile. The upload blob is encoded now; the base canvas is
  // kept until the editor closes, when it's swapped for the thumbnail.
  function addImage(shot, at) {
    return shotBlob(shot).then(function (blob) {
      var img = {
        id: ++imageSeq,
        shot: shot,
        blob: blob,
        thumb: makeThumb(shot),
        source: shot.source || "pick",
      };
      if (typeof at === "number") state.images.splice(at, 0, img);
      else state.images.push(img);
      render();
      return img;
    });
  }

  function editImage(id) {
    var img = null;
    state.images.forEach(function (x) {
      if (x.id === id) img = x;
    });
    if (!img || state.busy || layer) return;
    away(true);
    editShot(
      img.shot,
      function () {
        // Done: re-encode the upload blob and refresh the tile.
        var shot = img.shot;
        shotBlob(shot).then(
          function (blob) {
            img.blob = blob;
            img.thumb = makeThumb(shot);
            releaseShot(shot);
            away(false);
            render();
            focusById("fbx-tilebtn-" + img.id);
          },
          function () {
            away(false);
            render();
            showFormError("Couldn\\u2019t save the annotation. Please try again.");
          },
        );
      },
      function () {
        away(false);
        focusById("fbx-tile-" + img.id);
      },
    );
  }

  // ---- Paste / drop / picker wiring ---------------------------------------

  function onPanelPaste(e) {
    if (!panel.classList.contains("fbx-open") || state.busy || state.screen !== "form") return;
    if (!e.clipboardData) return;
    var files = e.clipboardData.files;
    if (!files || !files.length) {
      // Some engines only expose pasted files through items.
      files = [];
      Array.prototype.forEach.call(e.clipboardData.items || [], function (item) {
        if (item.kind === "file" && IMAGE_MIME.test(item.type || "")) {
          var f = item.getAsFile();
          if (f) files.push(f);
        }
      });
    }
    var imgs = imageFiles(files);
    if (!imgs.length) return;
    var hasText = false;
    try {
      hasText = Array.prototype.indexOf.call(e.clipboardData.types || [], "text/plain") !== -1;
    } catch (err) {
      /* keep false */
    }
    // Image-only clipboard: swallow the default (nothing to insert anyway).
    if (!hasText) e.preventDefault();
    addFiles(imgs, "paste");
  }

  var dragDepth = 0;
  function onPanelDragEnter(e) {
    if (!panel.classList.contains("fbx-open") || state.screen !== "form" || state.busy) return;
    var hasFiles = false;
    try {
      hasFiles =
        e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1;
    } catch (err) {
      hasFiles = !!e.dataTransfer;
    }
    if (!hasFiles) return;
    e.preventDefault();
    dragDepth++;
    panel.classList.add("fbx-dropping");
  }

  function onPanelDragOver(e) {
    if (!panel.classList.contains("fbx-open") || state.screen !== "form" || state.busy) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onPanelDragLeave() {
    if (!dragDepth) return;
    if (--dragDepth === 0) panel.classList.remove("fbx-dropping");
  }

  function onPanelDrop(e) {
    if (!panel.classList.contains("fbx-open") || state.screen !== "form" || state.busy) return;
    e.preventDefault();
    dragDepth = 0;
    panel.classList.remove("fbx-dropping");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files, "drop");
    }
  }

  function onFilePick(e) {
    var input = e.target;
    if (input.files && input.files.length) addFiles(input.files, "pick");
    input.value = ""; // allow picking the same file again
  }

  // ---- Page recording (rrweb, lazy-loaded) --------------------------------

  var recordLib = null;
  function loadRecorder() {
    if (window.rrwebRecord) return Promise.resolve(window.rrwebRecord);
    if (!recordLib) {
      recordLib = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = config.endpoint + "/embed-record.js";
        s.async = true;
        s.onload = function () {
          window.rrwebRecord ? ok(window.rrwebRecord) : fail(new Error("recorder unavailable"));
        };
        s.onerror = function () {
          recordLib = null;
          fail(new Error("recorder unavailable"));
        };
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
    if (state.recordingActive) return stopRecording(true);
    if (state.busy || layer || state.recording || !canRecord()) return;
    var gen = generation;
    loadRecorder()
      .then(function (lib) {
        if (gen !== generation || state.recordingActive || layer) return;
        var events = [];
        var stop = (lib.record || lib.default.record)({
          emit: function (event) {
            events.push(event);
          },
          blockClass: "fbx",
          maskInputOptions: { password: true },
          slimDOMOptions: "all",
          sampling: { mousemove: 50, scroll: 150, input: "last" },
        });
        if (!stop) throw new Error("recorder failed to start");
        state.rec = { stop: stop, events: events, gen: gen };
        state.recordingActive = true;
        state.seconds = 0;
        away(true);
        if (launch) launch.classList.add("fbx-away");
        showRecordBar();
        state.timer = setInterval(function () {
          state.seconds++;
          var t = document.getElementById("fbx-rectime");
          if (t) t.textContent = fmt(state.seconds);
          if (state.seconds >= 300) stopRecording(true);
        }, 1000);
      })
      .catch(function () {
        if (gen !== generation) return;
        showFormError("Recording isn\\u2019t available on this page right now.");
      });
  }

  function showRecordBar() {
    var bar = el(
      "div",
      "fbx fbx-anno fbx-recbar",
      '<span class="fbx-dot"></span><span class="fbx-rectime" id="fbx-rectime" role="timer" aria-label="Recording time">0:00</span>',
    );
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Recording this page");
    var stopBtn = el("button", "fbx-recstop", '<span class="fbx-sq"></span>Stop');
    stopBtn.title = "Stop and attach";
    stopBtn.addEventListener("click", function () {
      stopRecording(true);
    });
    var discard = el("button", "fbx-recx", ICONS.close);
    discard.title = "Discard recording";
    discard.setAttribute("aria-label", discard.title);
    discard.addEventListener("click", function () {
      stopRecording(false);
    });
    bar.appendChild(stopBtn);
    bar.appendChild(discard);
    showLayer(bar);
  }

  function stopRecording(keep) {
    var rec = state.rec;
    if (!rec) return;
    state.rec = null;
    state.recordingActive = false;
    clearInterval(state.timer);
    state.timer = null;
    try {
      rec.stop();
    } catch (e) {
      /* already stopped */
    }
    closeLayer();
    if (launch) launch.classList.remove("fbx-away");
    if (rec.gen !== generation) return;
    if (!keep || rec.events.length < 2) {
      away(false);
      render();
      focusById("fbx-recbtn");
      return;
    }
    var seconds = state.seconds;
    packReplay(rec.events).then(
      function (blob) {
        if (rec.gen !== generation) return;
        state.recording = { blob: blob, seconds: seconds };
        away(false);
        render();
        focusById(state.text.trim() ? "fbx-send" : "fbx-note");
      },
      function () {
        if (rec.gen !== generation) return;
        showFormError("Couldn\\u2019t save the recording. Please try again.");
      },
    );
  }

  function packReplay(events) {
    var json = JSON.stringify({
      v: 1,
      url: location.href,
      viewport: { w: innerWidth, h: innerHeight },
      events: events,
    });
    var gzipped = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Response(gzipped).blob().then(function (b) {
      return new Blob([b], { type: "application/gzip" });
    });
  }

  function showFormError(message) {
    away(false);
    render();
    var error = body.querySelector(".fbx-err");
    if (error) {
      error.textContent = message;
      error.style.display = "block";
    }
  }

  function fmt(s) {
    var m = Math.floor(s / 60),
      r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  // ---- Voice note ----------------------------------------------------------

  function toggleVoice() {
    if (state.audioRecording) {
      if (state.audioRecorder && state.audioRecorder.state !== "inactive")
        state.audioRecorder.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder)
      return;
    var recordingGeneration = generation;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        if (recordingGeneration !== generation) {
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
          return;
        }
        var mime =
          ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].filter(function (m) {
            return MediaRecorder.isTypeSupported(m);
          })[0] || "";
        state.audioChunks = [];
        var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        state.audioRecorder = rec;
        rec.ondataavailable = function (e) {
          if (recordingGeneration === generation && e.data && e.data.size)
            state.audioChunks.push(e.data);
        };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
          if (recordingGeneration !== generation) return;
          clearInterval(state.audioTimer);
          state.audioTimer = null;
          state.audioRecording = false;
          if (state.audioChunks.length) {
            state.audio = new Blob(state.audioChunks, { type: mime.split(";")[0] || "audio/webm" });
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
          if (t) t.textContent = "Voice note \\u00b7 " + fmt(state.audioSeconds) + " / 5:00";
          if (
            state.audioSeconds >= 300 &&
            state.audioRecorder &&
            state.audioRecorder.state !== "inactive"
          )
            state.audioRecorder.stop();
        }, 1000);
      })
      .catch(function () {
        /* mic declined or unavailable; keep the form quiet */
      });
  }

  // ---- Reset ---------------------------------------------------------------

  function reset() {
    generation++;
    clearTimeout(resetTimer);
    resetTimer = null;
    state.screen = "form";
    state.kind = "other";
    state.lockKind = false;
    state.text = "";
    state.email = sticky.user && sticky.user.email ? sticky.user.email : "";
    state.emailLocked = !!(sticky.user && sticky.user.email);
    state.images.forEach(releaseShot);
    state.images = [];
    state.recording = null;
    state.seconds = 0;
    state.openOpts = null;
    closeLayer();
    if (panel) panel.classList.remove("fbx-away");
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    if (state.rec) {
      try {
        state.rec.stop();
      } catch (e) {
        /* already stopped */
      }
      state.rec = null;
    }
    if (launch) launch.classList.remove("fbx-away");
    state.recordingActive = false;
    state.audio = null;
    state.audioSeconds = 0;
    if (state.audioTimer) {
      clearInterval(state.audioTimer);
      state.audioTimer = null;
    }
    if (state.audioRecording && state.audioRecorder && state.audioRecorder.state !== "inactive")
      state.audioRecorder.stop();
    state.audioRecording = false;
    state.busy = false;
    render();
  }

  // ---- Screenshots ---------------------------------------------------------

  var captureLib = null;
  function loadCapture() {
    if (window.modernScreenshot) return Promise.resolve(window.modernScreenshot);
    if (!captureLib) {
      captureLib = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = config.endpoint + "/embed-capture.js";
        s.async = true;
        s.onload = function () {
          window.modernScreenshot
            ? ok(window.modernScreenshot)
            : fail(new Error("capture unavailable"));
        };
        s.onerror = function () {
          captureLib = null;
          fail(new Error("capture unavailable"));
        };
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
        style: {
          marginTop: parseFloat(rootStyle.marginTop) - scrollY + "px",
          marginLeft: parseFloat(rootStyle.marginLeft) - scrollX + "px",
        },
        filter: function (node) {
          return !(node.classList && node.classList.contains("fbx"));
        },
        features: { restoreScrollPosition: true },
        timeout: 6000,
      });
      var limit = new Promise(function (ok, fail) {
        setTimeout(function () {
          fail(new Error("capture timed out"));
        }, 15000);
      });
      return Promise.race([shot, limit]).then(function (canvas) {
        canvas.getContext("2d").getImageData(0, 0, 1, 1); // throws if the browser tainted the canvas
        return { base: canvas, unit: scale, shapes: [], source: "capture" };
      });
    });
  }

  function shareCapture() {
    return navigator.mediaDevices
      .getDisplayMedia({ video: true, preferCurrentTab: true, selfBrowserSurface: "include" })
      .then(function (stream) {
        var stop = function () {
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
        };
        var video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        return video
          .play()
          .then(function () {
            return new Promise(function (r) {
              setTimeout(r, 220);
            });
          })
          .then(
            function () {
              var c = document.createElement("canvas");
              c.width = video.videoWidth || 1280;
              c.height = video.videoHeight || 720;
              c.getContext("2d").drawImage(video, 0, 0);
              stop();
              return {
                base: c,
                unit: Math.min(3, Math.max(1, c.width / Math.max(innerWidth, 1))),
                shapes: [],
                source: "capture",
              };
            },
            function (e) {
              stop();
              throw e;
            },
          );
      });
  }

  // ---- Floating layers -----------------------------------------------------

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
    if (!panel) return;
    panel.classList.toggle("fbx-away", on);
    panel.inert = on || !panel.classList.contains("fbx-open");
    if (backdrop) backdrop.classList.toggle("fbx-away", on);
  }

  function focusById(id) {
    var node = document.getElementById(id);
    if (node && !node.disabled) node.focus({ preventScroll: true });
  }

  function takeScreenshot() {
    if (state.busy || state.recordingActive || layer) return;
    var gen = generation;
    away(true);
    var pill = el("div", "fbx fbx-snap", '<span class="fbx-spin"></span>Capturing this page\\u2026');
    pill.setAttribute("role", "status");
    showLayer(pill);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (gen !== generation) return;
        capturePage().then(
          function (shot) {
            if (gen !== generation) return;
            flash();
            reviewShot(shot);
          },
          function () {
            if (gen !== generation) return;
            captureFailed();
          },
        );
      });
    });
  }

  function flash() {
    var f = el("div", "fbx fbx-flash");
    document.body.appendChild(f);
    setTimeout(function () {
      f.remove();
    }, 450);
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

  // Quick card: thumbnail + "Annotate" / "Attach". Attach now ADDS a tile.
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

    function annotateIt() {
      editShot(
        shot,
        function () {
          addShot(shot);
        },
        function () {
          reviewShot(shot);
        },
      );
    }
    thumb.addEventListener("click", annotateIt);
    annotateBtn.addEventListener("click", annotateIt);
    attachBtn.addEventListener("click", function () {
      if (imageRoom() <= 0) {
        closeLayer();
        away(false);
        render();
        trayFull();
        return;
      }
      addShot(shot);
    });
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
    var share = null;
    if (canShare) {
      share = el("button", "fbx-qa-btn fbx-qa-primary", "Share screen");
      share.addEventListener("click", function () {
        var gen = generation;
        share.disabled = true;
        shareCapture().then(
          function (shot) {
            if (gen === generation) reviewShot(shot);
          },
          function () {
            share.disabled = false;
          },
        );
      });
      ui.actions.appendChild(share);
    }
    ui.card.appendChild(ui.actions);
    ui.close.addEventListener("click", discardCapture);
    showLayer(ui.card, escapeTo(discardCapture));
    (share || cancel).focus({ preventScroll: true });
  }

  function addShot(shot) {
    var gen = generation;
    addImage(shot).then(
      function (img) {
        if (gen !== generation) return;
        releaseShot(shot);
        closeLayer();
        away(false);
        render();
        focusById(state.text.trim() ? "fbx-send" : "fbx-note");
      },
      function () {
        if (gen !== generation) return;
        closeLayer();
        showFormError("Couldn\\u2019t attach the screenshot. Please try again.");
      },
    );
  }

  function shotBlob(shot) {
    var c = document.createElement("canvas");
    c.width = shot.base.width;
    c.height = shot.base.height;
    drawShot(c.getContext("2d"), shot, 1);
    // The upload cap is 10 MB; very busy hi-dpi pages fall back to JPEG.
    return toBlob(c, "image/png").then(function (b) {
      return b.size > 9e6 ? toBlob(c, "image/jpeg", 0.9) : b;
    });
  }

  function toBlob(c, type, quality) {
    return new Promise(function (ok, fail) {
      c.toBlob(
        function (b) {
          b ? ok(b) : fail(new Error("encode failed"));
        },
        type,
        quality,
      );
    });
  }

  // Edit a tray/capture shot: decode the base if it was released, run the
  // editor, then drop the full-size canvas again (the tile keeps the encoded
  // blobs + thumbnail).
  function editShot(shot, onDone, onCancel) {
    ensureBase(shot).then(
      function () {
        away(true);
        // The editor closes before the caller's encode work runs; releasing the
        // base canvas is the caller's job (it needs base for the re-encode).
        openEditor(
          shot,
          function () {
            closeLayer();
            onDone();
          },
          function () {
            closeLayer();
            onCancel();
          },
        );
      },
      function () {
        showFormError("Couldn\\u2019t open that image. Please try again.");
      },
    );
  }

  // Memory: keep the encoded original + upload blob + thumbnail per tile;
  // release the full-size canvas once nothing needs it.
  function releaseShot(shot) {
    if (!shot || !shot.base || shot.releasing) return;
    shot.releasing = true;
    var pristine = shot.original ? Promise.resolve(shot.original) : toBlob(shot.base, "image/png"); // base-only, no shapes
    pristine.then(
      function (blob) {
        shot.original = blob;
        shot.base = null;
        shot.releasing = false;
      },
      function () {
        shot.releasing = false;
      }, // keep the canvas; safe fallback
    );
  }

  function ensureBase(shot) {
    if (shot.base) return Promise.resolve(shot);
    if (!shot.original) return Promise.reject(new Error("no source"));
    return shotFromFile(shot.original, shot.source).then(function (fresh) {
      fresh.shapes = shot.shapes;
      shot.base = fresh.base;
      shot.unit = fresh.unit;
      shot.original = fresh.original;
      return shot;
    });
  }

  // ---- Annotation drawing --------------------------------------------------

  var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  var TEXT_SIZE = 20;
  var COLORS = [
    ["#ef4444", "Red"],
    ["#f97316", "Orange"],
    ["#facc15", "Yellow"],
    ["#22c55e", "Green"],
    ["#3b82f6", "Blue"],
    ["#a855f7", "Purple"],
    ["#18181b", "Black"],
    ["#ffffff", "White"],
  ];
  var TOOLS = [
    ["arrow", "Arrow", "A"],
    ["rect", "Rectangle", "R"],
    ["ellipse", "Ellipse", "O"],
    ["pen", "Pen", "P"],
    ["marker", "Highlighter", "H"],
    ["text", "Text", "T"],
    ["counter", "Step number", "N"],
    ["blur", "Pixelate", "B"],
  ];
  var pref = { tool: "arrow", color: COLORS[0][0] };
  var scratch = null;

  function contrast(hex) {
    var n = parseInt(hex.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170
      ? "#18181b"
      : "#ffffff";
  }

  function drawShot(c, shot, k) {
    c.save();
    c.scale(k, k);
    c.drawImage(shot.base, 0, 0);
    shot.shapes.forEach(function (s) {
      paintShape(c, s, shot.unit);
    });
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
      var x = Math.min(s.a.x, s.b ? s.b.x : 0),
        y = Math.min(s.a.y, s.b ? s.b.y : 0);
      if (s.t === "rect") {
        var w = Math.abs(s.b.x - s.a.x),
          h = Math.abs(s.b.y - s.a.y);
        c.beginPath();
        if (c.roundRect) c.roundRect(x, y, w, h, Math.min(4 * u, w / 2, h / 2));
        else c.rect(x, y, w, h);
        c.stroke();
      } else if (s.t === "ellipse") {
        c.beginPath();
        c.ellipse(
          (s.a.x + s.b.x) / 2,
          (s.a.y + s.b.y) / 2,
          Math.abs(s.b.x - s.a.x) / 2,
          Math.abs(s.b.y - s.a.y) / 2,
          0,
          0,
          Math.PI * 2,
        );
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
      c.quadraticCurveTo(
        pts[i].x,
        pts[i].y,
        (pts[i].x + pts[i + 1].x) / 2,
        (pts[i].y + pts[i + 1].y) / 2,
      );
    }
    var last = pts[pts.length - 1];
    c.lineTo(last.x, last.y);
  }

  function paintArrow(c, a, b, u) {
    var dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy);
    if (len < 1) return;
    var ux = dx / len,
      uy = dy / len,
      nx = -uy,
      ny = ux;
    var w = 4.5 * u,
      head = Math.min(len * 0.6, 18 * u),
      wing = head * 0.6,
      tail = w * 0.2;
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

  function pixelate(c, s, u) {
    var k = c.getTransform ? c.getTransform().a : 1; // thumbnails draw scaled
    var x = Math.max(0, Math.round(Math.min(s.a.x, s.b.x) * k)),
      y = Math.max(0, Math.round(Math.min(s.a.y, s.b.y) * k));
    var w = Math.min(c.canvas.width, Math.round(Math.max(s.a.x, s.b.x) * k)) - x;
    var h = Math.min(c.canvas.height, Math.round(Math.max(s.a.y, s.b.y) * k)) - y;
    if (w < 1 || h < 1) return;
    var block = Math.max(3, Math.round(10 * u * k));
    var tw = Math.ceil(w / block),
      th = Math.ceil(h / block);
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

  // ---- Annotation editor ---------------------------------------------------

  function openEditor(shot, onDone, onCancel) {
    var u = shot.unit;
    var shapes = shot.shapes.slice(),
      undone = [];
    var tool = pref.tool,
      color = pref.color;
    var draft = null,
      typing = null,
      frame = 0;

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
    function sep() {
      bar.appendChild(el("span", "fbx-sep"));
    }

    var cancelBtn = button(ICONS.close, "Cancel", "Esc");
    sep();
    var toolBtns = {};
    TOOLS.forEach(function (t) {
      toolBtns[t[0]] = button(ICONS[t[0]], t[1], t[2]);
      toolBtns[t[0]].addEventListener("click", function () {
        setTool(t[0]);
      });
    });
    sep();
    var colorBtn = button('<span class="fbx-swatch"></span>', "Color");
    colorBtn.setAttribute("aria-haspopup", "true");
    colorBtn.setAttribute("aria-expanded", "false");
    var swatch = colorBtn.firstChild;
    var undoBtn = button(ICONS.undo, "Undo", MAC ? "\\u2318Z" : "Ctrl+Z");
    var redoBtn = button(ICONS.redo, "Redo", MAC ? "\\u21e7\\u2318Z" : "Ctrl+Y");
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
      s.addEventListener("click", function () {
        setColor(pair[0]);
        togglePop(false);
        colorBtn.focus();
      });
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

    var hint = el(
      "div",
      "fbx-ed-hint",
      "Drag to draw \\u00b7 <kbd>" +
        (MAC ? "\\u2318Z" : "Ctrl+Z") +
        "</kbd> undo \\u00b7 <kbd>\\u21b5</kbd> done \\u00b7 <kbd>Esc</kbd> cancel",
    );
    overlay.appendChild(stage);
    overlay.appendChild(bar);
    overlay.appendChild(pop);
    overlay.appendChild(hint);

    function fit() {
      var small = innerWidth <= 640;
      var s = Math.min(
        (innerWidth - (small ? 24 : 64)) / canvas.width,
        (innerHeight - (small ? 220 : 140)) / canvas.height,
      );
      canvas.style.width = Math.round(canvas.width * s) + "px";
      canvas.style.height = Math.round(canvas.height * s) + "px";
    }

    function setTool(id) {
      commitText();
      tool = pref.tool = id;
      Object.keys(toolBtns).forEach(function (k) {
        toolBtns[k].setAttribute("aria-pressed", String(k === id));
      });
      canvas.style.cursor = id === "text" ? "text" : "crosshair";
    }
    function setColor(value) {
      color = pref.color = value;
      swatch.style.background = value;
      swatches.forEach(function (s, i) {
        s.setAttribute("aria-pressed", String(COLORS[i][0] === value));
      });
      if (typing) {
        typing.c = value;
        styleTextBox();
      }
    }
    function togglePop(open) {
      pop.hidden = !open;
      colorBtn.setAttribute("aria-expanded", String(open));
      if (!open) return;
      var r = colorBtn.getBoundingClientRect();
      var left = Math.max(
        8,
        Math.min(innerWidth - pop.offsetWidth - 8, r.left + r.width / 2 - pop.offsetWidth / 2),
      );
      pop.style.left = left + "px";
      pop.style.top =
        (r.top > innerHeight / 2 ? r.top - pop.offsetHeight - 10 : r.bottom + 10) + "px";
      var current = swatches.filter(function (s) {
        return s.getAttribute("aria-pressed") === "true";
      })[0];
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
      return {
        x: ((e.clientX - r.left) * canvas.width) / r.width,
        y: ((e.clientY - r.top) * canvas.height) / r.height,
      };
    }
    function constrain(a, p, shift, t) {
      if (!shift) return p;
      var dx = p.x - a.x,
        dy = p.y - a.y;
      if (t === "arrow") {
        var ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4),
          len = Math.hypot(dx, dy);
        return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
      }
      var d = Math.max(Math.abs(dx), Math.abs(dy));
      return { x: a.x + (dx < 0 ? -d : d), y: a.y + (dy < 0 ? -d : d) };
    }

    canvas.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
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
        return add({
          t: "counter",
          c: color,
          a: p,
          n:
            shapes.filter(function (s) {
              return s.t === "counter";
            }).length + 1,
        });
      }
      draft = { t: tool, c: color, a: p, b: p, pts: [p] };
      canvas.setPointerCapture(e.pointerId);
      paintSoon();
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!draft) return;
      if (draft.t === "pen" || draft.t === "marker") {
        var events = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        (events.length ? events : [e]).forEach(function (ev) {
          draft.pts.push(pt(ev));
        });
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
      if (
        e.type === "pointercancel" ||
        (!freehand && Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) < 4 * u)
      )
        return paintSoon();
      add(s);
    }
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);

    function styleTextBox() {
      var k = canvas.clientWidth / canvas.width,
        size = TEXT_SIZE * u * k,
        o = Math.max(1, 1.5 * u * k) + "px ",
        halo = contrast(typing.c);
      typing.el.style.cssText =
        "left:" +
        typing.a.x * k +
        "px;top:" +
        typing.a.y * k +
        "px;font-size:" +
        size +
        "px;color:" +
        typing.c +
        ";caret-color:" +
        typing.c +
        ";text-shadow:" +
        ["-", ""]
          .map(function (sx) {
            return ["-", ""]
              .map(function (sy) {
                return sx + o + sy + o + "0 " + halo;
              })
              .join(",");
          })
          .join(",");
    }
    function startText(p) {
      var box = el("div", "fbx-text-in");
      try {
        box.contentEditable = "plaintext-only";
      } catch (err) {
        /* older browsers */
      }
      if (box.contentEditable !== "plaintext-only") box.contentEditable = "true";
      box.setAttribute("role", "textbox");
      box.setAttribute("aria-label", "Annotation text");
      typing = { el: box, a: { x: p.x, y: p.y - TEXT_SIZE * u * 0.62 }, c: color };
      styleTextBox();
      box.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          cancelText();
          toolBtns.text.focus();
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commitText();
          toolBtns.text.focus();
        }
      });
      box.addEventListener("blur", commitText);
      stage.appendChild(box);
      box.focus();
    }
    function commitText() {
      if (!typing) return;
      var t = typing;
      typing = null;
      var text = (t.el.innerText || "").replace(/\\u00a0/g, " ").replace(/\\s+$/, "");
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
    colorBtn.addEventListener("click", function () {
      togglePop(pop.hidden);
    });

    var keys = {};
    TOOLS.forEach(function (t) {
      keys[t[2].toLowerCase()] = t[0];
    });
    function onKey(e) {
      if (typing && e.target === typing.el) return;
      var mod = e.metaKey || e.ctrlKey,
        k = e.key.length === 1 ? e.key.toLowerCase() : e.key,
        handled = true;
      if (k === "Escape") {
        if (!pop.hidden) {
          togglePop(false);
          colorBtn.focus();
        } else cancel();
      } else if (mod && k === "z") {
        e.shiftKey ? redo() : undo();
      } else if (mod && k === "y") {
        redo();
      } else if (k === "Enter" && (mod || e.target.tagName !== "BUTTON")) {
        finish();
      } else if (k === "Tab") {
        var items = Array.prototype.filter.call(overlay.querySelectorAll("button"), function (b) {
          return !b.disabled && b.offsetParent;
        });
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
    function onResize() {
      commitText();
      fit();
      togglePop(false);
    }
    function onWheel(e) {
      e.preventDefault();
    }
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

  // ---- Panel open/close -----------------------------------------------------

  function isOpen() {
    return !!(panel && panel.classList.contains("fbx-open"));
  }

  function settleOpen(result) {
    if (!openPromise) return;
    var p = openPromise;
    openPromise = null;
    p.resolve(result);
    if (result && result.status === "submitted")
      emit("submit", { id: result.id, state: result.state, kind: result.kind });
  }

  function failOpen(err) {
    if (!openPromise) return;
    var p = openPromise;
    openPromise = null;
    p.reject(err);
  }

  function applyOptions(options) {
    var opts = {};
    if (options && typeof options === "object") opts = options;
    var meta = {};
    if (opts.metadata && typeof opts.metadata === "object") {
      Object.keys(opts.metadata).forEach(function (key) {
        if (opts.metadata[key] !== null && opts.metadata[key] !== undefined)
          meta[key] = opts.metadata[key];
      });
    }
    state.openOpts = {
      metadata: cleanMetadata(meta, "open() metadata"),
      url: typeof opts.url === "string" && opts.url ? opts.url : null,
      title: typeof opts.title === "string" && opts.title ? opts.title : null,
      placeholder:
        typeof opts.placeholder === "string" && opts.placeholder ? opts.placeholder : null,
      appVersion: opts.appVersion || opts.app_version || null,
    };
    if (typeof opts.text === "string") state.text = opts.text;
    if (typeof opts.email === "string") {
      state.email = opts.email;
      state.emailLocked = true;
    }
  }

  function apiOpen(options) {
    if (!config.project) {
      return Promise.reject(
        new TypeError(
          "[feedbackbee] open() called before init({ project }) \\u2014 no project configured",
        ),
      );
    }
    var opts = options && typeof options === "object" ? options : {};
    var kind = opts.kind ? opts.kind : "other";
    if (!KIND_BY_ID[kind]) {
      var renamed = RENAMED_KINDS[kind];
      return Promise.reject(
        new TypeError(
          renamed
            ? '[feedbackbee] kind "' + kind + '" was renamed to "' + renamed + '"'
            : '[feedbackbee] unknown kind "' +
                kind +
                '" (expected "issue", "feature_request" or "other")',
        ),
      );
    }
    // Already open: hand back the in-flight promise, ignore the new options.
    if (openPromise) return openPromise.promise;
    if (!document.body) {
      // Script landed before <body> was parsed; retry once the DOM is ready.
      return new Promise(function (resolve, reject) {
        whenReady(function () {
          apiOpen(options).then(resolve, reject);
        });
      });
    }

    lastFocused = document.activeElement;
    ensureDom();
    clearTimeout(resetTimer);
    resetTimer = null;

    var pending = { resolve: null, reject: null, promise: null };
    pending.promise = new Promise(function (resolve, reject) {
      pending.resolve = resolve;
      pending.reject = reject;
    });
    openPromise = pending;

    state.kind = kind;
    state.lockKind = !!opts.lockKind;
    state.text = typeof opts.text === "string" ? opts.text : "";
    if (typeof opts.email === "string" && opts.email) {
      state.email = opts.email;
      state.emailLocked = true;
    } else if (sticky.user && sticky.user.email) {
      state.email = sticky.user.email;
      state.emailLocked = true;
    } else {
      state.email = "";
      state.emailLocked = false;
    }
    applyOptions(opts);
    if (state.screen === "done") state.screen = "form";
    render(); // paint the new kind/title/lock/email before the panel shows

    setOpen(true, false);
    emit("open", { kind: state.kind });
    warmCapture();

    // Pre-attach host-supplied images once the panel is up.
    if (opts.images && opts.images.length) addFiles(opts.images, "host");
    if (opts.attach === "screenshot" && !state.busy && !layer) {
      setTimeout(function () {
        if (openPromise === pending) takeScreenshot();
      }, 80);
    }
    return pending.promise;
  }

  function apiClose() {
    if (!isOpen() || state.busy) return;
    closePanel(state.screen === "done" ? "submitted" : "dismissed");
  }

  function closePanel(reason) {
    // reason: "dismissed" | "submitted". The submit path settles the promise
    // itself before closing, so here we only settle dismissals.
    if (reason !== "submitted" && openPromise) settleOpen({ status: "dismissed" });
    setOpen(false, true);
  }

  function setOpen(open, keyboard) {
    if (!panel) return;
    if (state.busy && !open) return;
    if (open && config.headless) {
      ensureBackdrop();
      document.body.appendChild(backdrop);
      backdrop.classList.add("fbx-show");
      lockScroll(true);
    }
    if (!open && config.headless) {
      if (backdrop) {
        backdrop.classList.remove("fbx-show");
        var b = backdrop;
        backdrop = null;
        setTimeout(function () {
          b.remove();
        }, 200);
      }
      lockScroll(false);
    }
    var insidePanel = panel.contains(document.activeElement);
    var wasSubmitted = !open && state.screen === "done";
    panel.classList.toggle("fbx-instant", !!keyboard);
    panel.classList.toggle("fbx-open", open);
    panel.inert = !open;
    if (launch) launch.setAttribute("aria-expanded", String(open));
    if (open) {
      fitViewport();
      if (keyboard || matchMedia("(pointer:fine)").matches) focusById("fbx-note");
    } else {
      if ((keyboard || insidePanel) && lastFocused && document.contains(lastFocused)) {
        lastFocused.focus({ preventScroll: true });
      } else if (launch && (keyboard || insidePanel)) {
        launch.focus({ preventScroll: true });
      }
      if (openPromise) settleOpen({ status: "dismissed" });
      emit("close", { reason: wasSubmitted ? "submitted" : "dismissed" });
      reset();
    }
  }

  function lockScroll(on) {
    if (!document.body) return;
    if (on) {
      if (document.documentElement.style.overflow === "hidden") return;
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prevOverflow;
      prevOverflow = "";
    }
  }

  function ensureBackdrop() {
    if (backdrop) return;
    backdrop = el("div", "fbx fbx-backdrop");
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.addEventListener("click", function () {
      apiClose();
    });
  }

  function fitViewport() {
    if (!window.visualViewport || !panel) return;
    var viewport = window.visualViewport;
    var keyboard = Math.max(0, innerHeight - viewport.height - viewport.offsetTop);
    // Keeps the panel above the on-screen keyboard in both layouts. The modal
    // stays centered horizontally; when lifted, it anchors by its bottom edge.
    if (config.headless) {
      var lifted = keyboard > 120;
      panel.style.top = lifted ? "auto" : "";
      panel.style.bottom = lifted ? keyboard + 12 + "px" : "";
      panel.style.transform = lifted ? "translate(-50%,0)" : "";
    } else {
      panel.style.bottom = keyboard > 120 ? keyboard + 12 + "px" : "";
    }
    panel.style.maxHeight = keyboard > 120 ? Math.max(100, viewport.height - 36) + "px" : "";
  }

  // ---- Focus trap (headless modal) ------------------------------------------

  function trapFocus(e) {
    if (e.key !== "Tab" || !config.headless || !panel || !panel.classList.contains("fbx-open"))
      return;
    if (layer || document.querySelector(".fbx-anno")) return; // editor/record layers run their own trap
    if (e.defaultPrevented) return;
    var items = focusables(panel);
    if (!items.length) return;
    var first = items[0],
      last = items[items.length - 1];
    var active = document.activeElement;
    if (!panel.contains(active)) {
      // Focus leaked out of the modal: pull it back.
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll("button,input,textarea,select,a[href],[tabindex]:not([tabindex='-1'])"),
      function (n) {
        return !n.disabled && n.offsetParent !== null;
      },
    );
  }

  function onDocumentKeydown(event) {
    if (event.key === "Escape" && isOpen() && !document.querySelector(".fbx-anno")) {
      event.preventDefault();
      apiClose();
    }
  }

  // ---- DOM construction -------------------------------------------------------

  function makeLauncher() {
    if (launch || config.headless) return;
    launch = el(
      "button",
      "fbx fbx-launch",
      '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    );
    launch.setAttribute("aria-label", "Feedback");
    launch.setAttribute("aria-expanded", "false");
    launch.setAttribute("aria-controls", "fbx-panel");
    launch.setAttribute("aria-haspopup", "dialog");
    document.body.appendChild(launch);
    launch.addEventListener("click", function (event) {
      openFromLauncher(event.detail === 0);
    });
  }

  function ensureDom() {
    if (panel) return;
    styleEl = el("style", "fbx");
    styleEl.textContent = css();
    document.head.appendChild(styleEl);

    if (!config.headless) makeLauncher();

    panel = el("div", "fbx fbx-panel");
    panel.id = "fbx-panel";
    if (config.headless) panel.classList.add("fbx-modal");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", config.headless ? "true" : "false");
    panel.setAttribute("aria-labelledby", "fbx-title");
    panel.inert = true;
    var head = el("div", "fbx-head");
    title = el("h2", "fbx-title");
    title.id = "fbx-title";
    closeBtn = el("button", "fbx-close", ICONS.close);
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", function (event) {
      apiClose();
    });
    head.appendChild(title);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    body = el("div");
    panel.appendChild(body);
    foot = el("div", "fbx-foot", "Powered by <b>FeedbackBee</b>");
    panel.appendChild(foot);

    liveRegion = el("div", "fbx fbx-sr");
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    panel.appendChild(liveRegion);

    document.body.appendChild(panel);

    fileInput = el("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.hidden = true;
    fileInput.setAttribute("aria-hidden", "true");
    fileInput.tabIndex = -1;
    fileInput.addEventListener("change", onFilePick);
    panel.appendChild(fileInput);

    panel.addEventListener("paste", onPanelPaste);
    panel.addEventListener("dragenter", onPanelDragEnter);
    panel.addEventListener("dragover", onPanelDragOver);
    panel.addEventListener("dragleave", onPanelDragLeave);
    panel.addEventListener("drop", onPanelDrop);

    render();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitViewport);
      window.visualViewport.addEventListener("scroll", fitViewport);
    }
  }

  // The launcher toggle uses the same promise path as apiOpen so hosts can
  // await launcher-opened sessions too.
  function openFromLauncher(keyboard) {
    if (isOpen()) {
      apiClose();
      return;
    }
    apiOpen({}).then(
      function () {},
      function () {},
    ); // launcher never rejects
  }

  // Headless switch at runtime: adds or removes the launcher. The panel is
  // rebuilt lazily so the CSS classes are always consistent with the mode.
  function applyConfig() {
    if (styleEl && styleEl.textContent !== css()) styleEl.textContent = css();
    if (booted && panel) {
      if (config.headless && launch) {
        launch.remove();
        launch = null;
        panel.classList.add("fbx-modal");
        panel.setAttribute("aria-modal", "true");
      } else if (!config.headless && !launch) {
        panel.classList.remove("fbx-modal");
        panel.setAttribute("aria-modal", "false");
        makeLauncher();
      }
    }
    if (config.preload) warmCaptureIdle();
  }

  function warmCapture() {
    loadCapture().catch(function () {});
  }

  var idleWarm = null;
  function warmCaptureIdle() {
    if (idleWarm) return;
    idleWarm = true;
    var idle =
      window.requestIdleCallback ||
      function (fn) {
        setTimeout(fn, 1500);
      };
    idle(function () {
      loadCapture().catch(function () {
        idleWarm = null;
      });
    });
  }

  function boot() {
    domReady = true;
    // Delegated triggers work in every mode and cost nothing.
    document.addEventListener("click", function (event) {
      var node = event.target;
      while (node && node !== document.body) {
        if (node.getAttribute && node.getAttribute("data-feedbackbee-open") !== null) {
          event.preventDefault();
          var kind = node.getAttribute("data-feedbackbee-kind");
          var lock = node.getAttribute("data-feedbackbee-lock-kind");
          var text = node.getAttribute("data-feedbackbee-text");
          var opts = {};
          if (kind) opts.kind = kind;
          if (lock !== null && lock !== "false") opts.lockKind = true;
          if (text) opts.text = text;
          apiOpen(opts);
          return;
        }
        node = node.parentNode;
      }
    });

    document.addEventListener("keydown", onDocumentKeydown);
    document.addEventListener("keydown", trapFocus, true);

    if (config.project && !config.headless) {
      ensureDom();
    } else if (config.project && config.headless) {
      // Lazy DOM in headless mode: nothing is built until the first open().
    }
    applyConfig();
    booted = true;
    readyWaiters.splice(0).forEach(function (resolve) {
      resolve();
    });
    emit("ready", { version: VERSION });
  }

  // ---- Public API -------------------------------------------------------------

  function init(newConfig) {
    if (newConfig && typeof newConfig === "object") {
      if (typeof newConfig.project === "string" && newConfig.project)
        config.project = newConfig.project;
      if (typeof newConfig.endpoint === "string" && newConfig.endpoint)
        config.endpoint = newConfig.endpoint.replace(/\\/+$/, "");
      if (newConfig.position === "bottom-left" || newConfig.position === "left")
        config.position = "left";
      else if (newConfig.position === "bottom-right" || newConfig.position === "right")
        config.position = "right";
      if (typeof newConfig.headless === "boolean") config.headless = newConfig.headless;
      if (typeof newConfig.preload === "boolean") config.preload = newConfig.preload;
    }
    if (domReady) {
      applyConfig();
      if (config.project && !config.headless && !panel) ensureDom();
    }
    return api;
  }

  var readyWaiters = [];
  function ready() {
    if (booted) return Promise.resolve();
    return new Promise(function (resolve) {
      readyWaiters.push(resolve);
    });
  }

  function identify(user) {
    if (user === null || user === undefined) {
      sticky.user = null;
      if (!isOpen()) {
        state.email = "";
        state.emailLocked = false;
      }
      return;
    }
    if (typeof user !== "object") return;
    sticky.user = {
      email: typeof user.email === "string" ? user.email : "",
      name: typeof user.name === "string" ? user.name : "",
      id: user.id !== undefined && user.id !== null ? String(user.id) : "",
    };
  }

  function setContext(metadata) {
    if (metadata === null || metadata === undefined) {
      sticky.metadata = {};
      return;
    }
    if (typeof metadata !== "object") return;
    var clean = cleanMetadata(metadata, "setContext");
    var merged = {};
    var key;
    for (key in sticky.metadata) merged[key] = sticky.metadata[key];
    for (key in clean) {
      if (clean[key] === null) delete merged[key];
      else merged[key] = clean[key];
    }
    sticky.metadata = cleanMetadata(merged, "setContext");
  }

  function apiReset() {
    sticky.user = null;
    sticky.metadata = {};
    state.email = "";
    state.emailLocked = false;
    if (openPromise) settleOpen({ status: "dismissed" });
    if (isOpen()) {
      state.busy = false; // reset() may run mid-submit; the close must win
      closePanel("dismissed");
    } else if (panel) {
      reset();
    }
  }

  var api = {
    version: VERSION,
    init: init,
    ready: ready,
    identify: identify,
    setContext: setContext,
    open: apiOpen,
    close: apiClose,
    isOpen: isOpen,
    on: on,
    off: off,
    reset: apiReset,
  };

  // ---- Stub replacement and queue replay ----------------------------------------

  function install() {
    var stub = window.FeedbackBee;
    if (stub && stub.q && typeof stub.q.length === "number") {
      // Queue created by the host's stub one-liner: replay in order.
      var queue = stub.q;
      stub.q = [];
      for (var i = 0; i < queue.length; i++) {
        replay(queue[i]);
      }
      window.FeedbackBee = api;
    } else if (stub) {
      // Incompatible host global: leave it alone, expose ours beside it.
      console.warn(
        "[feedbackbee] window.FeedbackBee is already defined; using window.__feedbackbee instead",
      );
      window.__feedbackbee = api;
    } else {
      window.FeedbackBee = api;
    }
  }

  function replay(entry) {
    if (!entry || !entry[0]) return;
    var name = entry[0],
      args = entry[1],
      resolve = entry[2],
      reject = entry[3];
    var result;
    try {
      result = api[name] && api[name].apply(api, args || []);
    } catch (err) {
      if (typeof reject === "function") reject(err);
      return;
    }
    if (resolve === undefined && reject === undefined) return; // plain [name, args] entries
    if (result && typeof result.then === "function") {
      result.then(resolve, reject);
    } else if (typeof resolve === "function") {
      resolve(result);
    }
  }

  install();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
`;
