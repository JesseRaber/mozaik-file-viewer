# Wiki source

These Markdown files are the source for the GitHub Wiki of [JesseRaber/mozaik-file-viewer](https://github.com/JesseRaber/mozaik-file-viewer).

GitHub does not create `mozaik-file-viewer.wiki.git` until one page is saved in the Wiki tab. After that first UI save:

```bash
git clone https://github.com/JesseRaber/mozaik-file-viewer.wiki.git
cp wiki/Home.md wiki/Getting-Started.md wiki/Job-Files.md wiki/Privacy-and-Security.md wiki/FAQ.md wiki/_Sidebar.md wiki/_Footer.md mozaik-file-viewer.wiki/
cd mozaik-file-viewer.wiki
git add .
git commit -m "Publish shop wiki for Mozaik File Viewer"
git push
```

Live URL after the first page exists: https://github.com/JesseRaber/mozaik-file-viewer/wiki

Search engines generally do not index GitHub wikis unless the repo has 500+ stars and public wiki editing is disabled. Keep this `wiki/` folder in the code repo so the same pages stay crawlable on GitHub and can later feed GitHub Pages if needed.
