/** Prints one element on its own page: copies it, with the app's stylesheets,
 * into a new window and opens the browser's print dialog ("Save as PDF" from
 * there). Printing the live page instead would clip anything inside a
 * scrolling modal and drag the sidebar along. Returns false when the browser
 * blocked the popup. */
export function printElement(element: HTMLElement, title: string): boolean {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return false;

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("");
  const safeTitle = title.replace(/[<>&]/g, "");

  win.document.write(
    `<!doctype html><html><head><title>${safeTitle}</title><base href="${window.location.origin}/">${styles}` +
      `<style>@page{margin:14mm}body{background:#fff;padding:0;margin:0}tr{break-inside:avoid}</style></head>` +
      `<body>${element.outerHTML}</body></html>`,
  );
  win.document.close();
  win.focus();
  // Linked stylesheets and images (logo, watermark) load asynchronously in the
  // new window: print once the images are in, or after 2 s regardless.
  const images = Array.from(win.document.images ?? []);
  const loaded = Promise.all(images.map((img) => (img.complete ? null : new Promise((done) => (img.onload = img.onerror = done)))));
  Promise.race([loaded, new Promise((done) => setTimeout(done, 2000))]).then(() => setTimeout(() => win.print(), 400));
  return true;
}
