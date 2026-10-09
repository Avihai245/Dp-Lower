/** Font files imported for their URL only (to preload them); the CSS of the same files is imported separately. */
declare module '*.woff2' {
  const url: string;
  export default url;
}
