/// <reference types="vite/client" />

// Lets TypeScript understand Vite's `?raw` text imports (used for the SVG).
declare module '*.svg?raw' {
  const content: string;
  export default content;
}
