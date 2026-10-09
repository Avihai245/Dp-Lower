/**
 * The files that exist at the root of the campaign site: the icons in `public/` and the text/metadata routes of `src/app`.
 * Any other single path segment with a dot in it ("/wp-login.php", "/.env", "/index.html", "/ads.txt") is not a page and
 * not a file: the middleware answers it with the 404 page. (Left to the router it would be read as a language and end
 * in a 500.) The test below compares this list with `public/` and the app directory.
 */
export const ROOT_FILES = ['/apple-touch-icon.png', '/favicon.ico', '/llms-full.txt', '/llms.txt', '/robots.txt', '/sitemap.xml'] as const;

/** A single path segment with a dot in it: it looks like a file at the root. */
export const looksLikeRootFile = (pathname: string): boolean => /^\/[^/]*\.[^/]*$/.test(pathname);

export const isRootFile = (pathname: string): boolean => (ROOT_FILES as readonly string[]).includes(pathname);
