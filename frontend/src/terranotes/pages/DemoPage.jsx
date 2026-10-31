import { useEffect } from 'react';

// A demo web app kept in an article's folder (its `demos` in data/articles.js), e.g. the Wisdom Woods game at
// /articles/labs/wisdom-woods/demo. Opened in its own tab from the article; fills the window, with nothing of the site
// around it (App.jsx leaves out the footer and the rest; no opening animation, lib/introNotebook.js). The app itself
// is untouched static files; it runs in a same-origin frame so its address stays clean and moves with the edition.
// src = the app's folder (index.html), name = what it's called.
export default function DemoPage({ src, name }) {
  useEffect(() => {
    document.title = `${name} · demo`;
    const html = document.documentElement.style, was = [html.overflow, html.scrollbarGutter];
    html.overflow = 'hidden';
    html.scrollbarGutter = 'auto'; // base.css keeps a scrollbar's strip free; the frame takes the whole window
    return () => { [html.overflow, html.scrollbarGutter] = was; };
  }, [name]);
  return <iframe src={src} title={`${name}, the demo`} allow="autoplay; fullscreen" style={{ position: "fixed", inset: "0", width: "100%", height: "100%", border: "0", background: "var(--ink)" }} />;
}
