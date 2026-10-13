/** Prints one element on its own page: copies it, with the app's stylesheets,
 * into a new window and opens the browser's print dialog ("Save as PDF" from
 * there). Printing the live page instead would clip anything inside a
 * scrolling modal and drag the sidebar along. `pageCss` is added last, for
 * the caller's own @page rules (size, margins, running header and footer).
 * Returns false when the browser blocked the popup. */
export function printElement(element: HTMLElement, title: string, pageCss = "@page{margin:14mm}"): boolean {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return false;

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("");
  const safeTitle = title.replace(/[<>&]/g, "");

  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><base href="${window.location.origin}/">${styles}` +
      // print-color-adjust is inherited, page-margin boxes included: backgrounds
      // and colours print as designed even with "Background graphics" unticked.
      `<style>html{-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
      `body{background:#fff;padding:0;margin:0}tr{break-inside:avoid}${pageCss}</style></head>` +
      `<body>${element.outerHTML}</body></html>`,
  );
  win.document.close();
  win.focus();
  // Linked stylesheets, web fonts and images load asynchronously in the new
  // window: print once the images and fonts are in, or after 3 s regardless.
  const images = Array.from(win.document.images ?? []);
  const loaded = Promise.all([
    ...images.map((img) => (img.complete ? null : new Promise((done) => (img.onload = img.onerror = done)))),
    win.document.fonts?.ready,
  ]);
  Promise.race([loaded, new Promise((done) => setTimeout(done, 3000))]).then(() => setTimeout(() => win.print(), 400));
  return true;
}
