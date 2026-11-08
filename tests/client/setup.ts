import { expect, afterEach } from "vite-plus/test";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MotionGlobalConfig } from "motion/react";
import { pinClockWhileLoadingAndBeforeEachTest } from "../test-clock";

pinClockWhileLoadingAndBeforeEachTest();

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Motion animations (dialogs, tooltips, tabs, …) finish at once under test, so
// assertions never catch a surface mid-fade or still mounted for its exit.
MotionGlobalConfig.skipAnimations = true;

// jsdom lacks the Pointer Capture, scroll-into-view and ResizeObserver APIs
// Radix primitives (Select, Dropdown, Tooltip, …), cmdk and the command menu rely on. Minimal stubs — enough for the
// interaction paths exercised by component tests; not a faithful polyfill.
if (typeof window !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});
