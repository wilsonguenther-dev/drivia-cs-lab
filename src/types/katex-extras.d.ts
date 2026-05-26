declare module "katex/dist/contrib/auto-render.mjs" {
  const renderMathInElement: (root: HTMLElement, options?: Record<string, unknown>) => void;
  export default renderMathInElement;
}
