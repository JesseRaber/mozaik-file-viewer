/** DOM helpers — textContent / attributes only. Never innerHTML for job data. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, string | number | boolean | undefined>,
  ...kids: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === false) continue;
      if (k === "class") node.className = String(v);
      else if (k === "text") node.textContent = String(v);
      else if (k.startsWith("on")) continue;
      else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, String(v));
    }
  }
  for (const kid of kids) {
    if (kid == null) continue;
    node.append(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return node;
}

export function svg(
  tag: string,
  props?: Record<string, string | number | undefined>,
  ...kids: Array<SVGElement | null | undefined>
): SVGElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined) continue;
      node.setAttribute(k, String(v));
    }
  }
  for (const kid of kids) if (kid) node.appendChild(kid);
  return node;
}

export function clear(node: Node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function on<K extends keyof HTMLElementEventMap>(
  node: EventTarget,
  type: K,
  fn: (ev: HTMLElementEventMap[K]) => void,
  opts?: AddEventListenerOptions,
) {
  node.addEventListener(type, fn as EventListener, opts);
  return () => node.removeEventListener(type, fn as EventListener, opts);
}
