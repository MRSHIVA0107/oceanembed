# OceanEmbed Website

A clean-room, static recreation of the OceanEmbed presentation website.

## Run

No framework or build step is required.

1. Extract the ZIP.
2. Open `index.html` in a browser.

For the best result, run a small local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Files

- `index.html` — complete page structure and content
- `styles.css` — responsive design, animations and visual system
- `script.js` — depth explorer, layer switching and scroll animations

## Notes

This is an original recreation based on the visible OceanEmbed website structure and the project's documented concepts. It is not the private/original source code of the deployed website.

The website presents:
- Bay of Bengal ocean-data context
- Core surface inputs
- GLORYS training target
- ARGO independent validation
- ResNet-18 encoder-decoder
- six depth levels
- uncertainty via MC Dropout
- D26 and TCHP diagnostics
- application and research sections

The visual explorer is a front-end demonstration; it does not connect to a live ocean-data API.
