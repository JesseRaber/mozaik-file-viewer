/**
 * Test bootstrap: install the .ts resolver hook and give the parsers a DOM.
 *
 * parseDes, parseOpt and parseLabelData call `new DOMParser()`, a browser API.
 * linkedom supplies a standards-compliant one so they can be tested in Node.
 */
import { register } from "node:module";
import { DOMParser } from "linkedom";

register("./ts-resolve.mjs", import.meta.url);
globalThis.DOMParser = DOMParser;
