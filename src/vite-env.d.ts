/// <reference types="vite/client" />

declare module "markdown-it-texmath" {
  import MarkdownIt from "markdown-it";
  const texmath: MarkdownIt.PluginSimple;
  export default texmath;
}
