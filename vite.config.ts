import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { rules } from "./src/i18n/rules-texts";

// The site has four pages, each its own address for search engines:
//   index.html                  the game              foretold.live/
//   de/index.html               the game, in German   foretold.live/de/
//   how-to-play/index.html      the rules             foretold.live/how-to-play/
//   de/spielanleitung/index.html  the rules, German   foretold.live/de/spielanleitung/
// A new page needs its line here and in public/sitemap.xml.
const pages = {
  main: resolve(__dirname, "index.html"),
  de: resolve(__dirname, "de/index.html"),
  howToPlay: resolve(__dirname, "how-to-play/index.html"),
  spielanleitung: resolve(__dirname, "de/spielanleitung/index.html"),
};

// The rules pages get the game's own rules text (src/i18n/rules-texts.ts) in
// place of their <!-- RULES --> line, as plain HTML a search engine can read.
function rulesText(): Plugin {
  return {
    name: "foretold-rules-text",
    transformIndexHtml(html) {
      if (!html.includes("<!-- RULES -->")) return html;
      const language = /<html lang="de">/.test(html) ? "de" : "en";
      return html.replace("<!-- RULES -->", rules[language]);
    },
  };
}

export default defineConfig({
  plugins: [rulesText()],
  build: {
    rollupOptions: {
      input: pages,
    },
  },
});
