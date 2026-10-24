import "./viewer/viewer.css";
import { mountViewer } from "./viewer/ui";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");
try { mountViewer(root); }
catch {
  root.replaceChildren();
  root.className = "mfv-root startup-error";
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = "The 3D viewer could not start. Check that WebGL graphics are available in Edge, then reload. Your source files were not changed.";
  const retry = document.createElement("button"); retry.textContent = "Reload viewer"; retry.onclick = () => location.reload();
  root.append(message, retry);
}
