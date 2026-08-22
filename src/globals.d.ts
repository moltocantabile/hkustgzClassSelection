// Global UMD globals loaded from CDN script tags (see build/template.html).
// The app bundle references these instead of npm-importing React.
declare const React: any;
declare const ReactDOM: any;

interface Window {
  React: any;
  ReactDOM: any;
  ReactFlow: any;
  jsxRuntime?: any;
}
