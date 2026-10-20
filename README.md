# MD Slides

A browser-based slide maker where you write presentations in Markdown. Edit on one side, watch the slides update on the other, then present full screen. Built with plain HTML, CSS and JavaScript, with no frameworks or libraries.

> Course assignment for BS Information Technology (Fall 2024), Department of Information Technology, Faculty of Computing and Information Technology, University of the Punjab, Lahore.

## Features

- **Create** new presentations from a starter template
- **Edit** in a split view: Markdown editor on the left, live slide preview on the right
- **Save** presentations in the browser's `localStorage`, so they are still there after you close and reopen the browser
- **Present** slides full screen
- **One Markdown file per presentation**, with `---` on its own line separating slides
- **Navigation buttons** (Left, Right, Full Screen) in both the editor preview and presentation mode
  - Left is disabled on the first slide
  - Right is disabled on the last slide
  - The full screen button switches to an "Exit Full Screen" label while presenting
- **Slide counter** at the bottom of every slide view, shown as `current / total`
- **Keyboard shortcuts**

| Key | Action |
|-----|--------|
| Right Arrow | Next slide |
| Left Arrow | Previous slide |
| F11 | Enter or exit presentation mode |
| Ctrl + S | Save the presentation |

Arrow keys are ignored while the cursor is inside the text editor, so you can still move around while typing.

## Getting started

No installation or build step is needed.

1. Download or clone this repository.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox).

```bash
git clone https://github.com/<your-username>/md-slides.git
cd md-slides
# then open index.html in your browser
```

## Writing slides

Write normal Markdown and put `---` on its own line between slides:

```markdown
# Slide 01
## A subtitle
Some content for the first slide.

---

# Slide 02
- A bullet point
- Another bullet point
```

Supported Markdown: headings (`#` to `######`), **bold**, *italic*, `inline code`, fenced code blocks, ordered and unordered lists, blockquotes, links and images.

## Project structure

```
md-slides/
├── index.html   # Page structure: home list, editor and presenter views
├── style.css    # Layout and slide styling
└── script.js    # Markdown parser, storage, slide viewer, keyboard shortcuts
```

## How it works

- **Slide splitting:** `splitSlides()` splits the Markdown text on lines that contain only `---`.
- **Markdown parsing:** `mdToHtml()` is a small hand-written parser that converts each slide's Markdown to HTML.
- **Storage:** presentations are saved as JSON in `localStorage` and loaded when the page opens.
- **Viewer:** `createViewer()` builds the slide area, the Left/Right/Full Screen buttons and the counter. The same viewer is used for the editor preview and for presentation mode.
- **Full screen:** uses the browser Fullscreen API. Pressing Esc also leaves presentation mode.

## Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- Web Storage API (`localStorage`)
- Fullscreen API

## Notes

- Data is stored per browser and per device. Clearing your browser's site data will remove saved presentations.
- Because storage is tied to the page's origin, a presentation saved from `index.html` opened as a local file will not appear when the same files are served from a different address (for example GitHub Pages).

## Author

Arfa

## License

This project was created for educational purposes. Released under the [MIT License](LICENSE).
