/**
 * Node resolver hook for the viewer's source style.
 *
 * The app imports relative modules without an extension ("../encoding"), which
 * Vite resolves and Node does not. Without this hook nothing that imports
 * another source file can be loaded under `node --test`, which is why the
 * parsers had no test coverage at all.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      /* fall through to the original specifier */
    }
  }
  return nextResolve(specifier, context);
}
