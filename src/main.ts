import "./viewer/viewer.css";
import { mountViewer } from "./viewer/ui";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");
mountViewer(root);
