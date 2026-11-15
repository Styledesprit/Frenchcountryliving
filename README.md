# Itinerary Studio

An editor for French Country Living travel itineraries. It rebuilds *The Luberon – 7-Day Itinerary* page by page, so you can:

- **Change any text** by clicking on the page and typing. Select words to make them bold or italic, or to add a link.
- **Swap or add photos** (upload, re-crop with the sliders, collages, taped polaroids, and a tall side photo).
- **Change fonts**: pick from Google Fonts, or upload your own (for example the original **Hatton** and **Minion Pro** files).
- **Add, remove and reorder** pages and blocks: headings, paragraphs, 9AM-style time slots, tips, taped notes, tables, photos, maps and address lists.
- **Use interactive maps**: every day has a route with numbered pins. Click a pin to open that place in Apple Maps, Google Maps or Waze. Each route can also open as a whole in Google Maps or Apple Maps, or download as a **GPX** file.
- **Save versions** and make copies to start new itineraries.
- **Export a PDF for Flipsnack.** Every page is a fixed A4 page. Place names, address lists, QR codes and the maps themselves stay clickable in the PDF, and Flipsnack keeps them as links.

## Using it

```bash
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

Your work is saved automatically **in your browser on that computer**. To back it up or move it to another computer, use **Export file** (`.itinerary.json`) and **Open a file…**.

### Exporting for Flipsnack

1. Click **Export PDF**.
2. In the print window choose **Save as PDF**. In *More settings*, set **Margins: None** and tick **Background graphics**. Use **Chrome or Edge**: they keep the links in the PDF.
3. Upload the PDF to Flipsnack. Flipsnack detects the links, so the map pages, QR codes and place names stay clickable.

### Places and maps

The **Places & maps** tab lists each day's route. The starting positions of the Luberon places were entered by hand and are marked *approx.* Click **Find all … from their addresses** once to check them against OpenStreetMap, or drag any pin on the map. Road routes are drawn automatically from the OpenStreetMap routing service.

## Putting it online (optional)

Push to `main` and the included GitHub Action publishes the app to GitHub Pages. To turn it on: *Settings → Pages → Source: GitHub Actions*. Each person's itineraries still live in their own browser.
