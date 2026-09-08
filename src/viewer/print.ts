export function printHtml(title: string, css: string, body: Node | string, page = "11in 8.5in") {
  const ifr = document.createElement("iframe");
  ifr.setAttribute("aria-hidden", "true");
  ifr.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden";
  document.body.appendChild(ifr);
  const doc = ifr.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body></body></html>`,
  );
  doc.close();
  const style = doc.createElement("style");
  style.textContent = `
    @page{size:${page};margin:0.3in}
    body{margin:0;background:#fff;color:#1a1714;font:12px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif}
    ${css}
  `;
  doc.head.appendChild(style);
  if (typeof body === "string") {
    const wrap = doc.createElement("div");
    wrap.append(doc.createTextNode(body));
    doc.body.appendChild(wrap);
  } else {
    doc.body.appendChild(doc.importNode(body, true));
  }
  setTimeout(() => {
    try {
      ifr.contentWindow?.focus();
      ifr.contentWindow?.print();
    } catch {
      window.print();
    }
    setTimeout(() => ifr.remove(), 60000);
  }, 200);
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "\u0026amp;";
      case "<":
        return "\u0026lt;";
      case ">":
        return "\u0026gt;";
      case '"':
        return "\u0026quot;";
      case "'":
        return "\u0026#39;";
      default:
        return c;
    }
  });
}
