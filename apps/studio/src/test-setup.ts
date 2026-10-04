// jsdom has no layout engine; stub what the app feature-detects.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollTo = (() => {}) as Element["scrollTo"];
