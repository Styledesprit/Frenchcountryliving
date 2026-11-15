# The French Country Club

*A journal of French country living.*

A small magazine website made of plain HTML, CSS and JavaScript: no framework, no build step,
no server and no database. All the words live in one file, `content/site.json`, and all the
photos live in `content/photos/`. A password-free admin page (`admin.html`) lets you write
stories, add photos and change settings in the browser, then publishes them to GitHub, where
GitHub Pages serves the site.

```
french-home/
├── index.html          the public site (one page; the view changes with the address after #)
├── admin.html          the admin
├── css/site.css        public site styles
├── css/admin.css       admin styles
├── js/markdown.js      small, safe Markdown renderer shared by both pages
├── js/site.js          public site
├── js/admin.js         admin
└── content/
    ├── site.json       every story, photo record, category and setting
    └── photos/         the photo files
```

## 1. Put the site online

The repository also contains Itinerary Studio (a separate app at the repository root). Two
GitHub Actions workflows in `.github/workflows/` publish the magazine whenever `main` changes —
including every time you press **Publish** in the admin:

- `deploy.yml` builds Itinerary Studio and publishes it to **GitHub Pages** together with this
  folder, so the magazine is at `/french-home/` there.
- `hostinger-site.yml` copies this folder on its own to the **`hostinger-site`** branch, with the
  magazine at the top level. That branch is what Hostinger serves. It is generated: never edit it
  by hand.

### On thefrenchcountryclub.com (Hostinger)

1. In **hPanel**, open **Websites → Manage** for thefrenchcountryclub.com, then
   **Advanced → GIT**.
2. Repository: `https://github.com/Styledesprit/Frenchcountryliving.git`, branch
   **`hostinger-site`**, and leave the install directory empty (the files go into `public_html`,
   which must be empty the first time). If the repository is private, first add the SSH key
   shown on that page on GitHub under the repository's **Settings → Deploy keys**, and use the
   address `git@github.com:Styledesprit/Frenchcountryliving.git` instead.
3. Press **Create**, then **Deploy** once.
4. Turn on **Auto deployment** and copy the webhook address it shows. On GitHub, open the
   repository's **Settings → Webhooks → Add webhook**, paste it as the *Payload URL* and save
   (the "just the push event" default is right).

The `hostinger-site` branch appears the first time the workflow runs: after this folder reaches
`main`, or straight away from **Actions → Update hostinger-site branch → Run workflow**.

- Site: `https://thefrenchcountryclub.com/`
- Admin: `https://thefrenchcountryclub.com/admin.html`

The admin already knows which repository and folder to publish to (the `fcc-repo` and
`fcc-folder` lines near the top of `admin.html`). After you publish, the site updates in a minute
or two: the workflow copies the change to `hostinger-site`, then Hostinger pulls it. If a change
doesn't appear, clear the cache in hPanel (**Performance → Cache Manager**, if it is switched on).

### On GitHub Pages (optional)

1. On GitHub, open the repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run **Actions → Deploy to GitHub Pages → Run workflow**). The **Actions**
   tab shows the progress.

- Site: `https://<owner>.github.io/<repository>/french-home/`
- Admin: `https://<owner>.github.io/<repository>/french-home/admin.html`

## 2. Create a GitHub token for the admin

The admin has no password. Instead you give it a *fine-grained personal access token* that is
allowed to change this one repository and nothing else. The sign-in screen repeats these steps.

1. On github.com, click your profile picture → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
   (or open <https://github.com/settings/personal-access-tokens/new>).
2. Name it (for example *French Country Club admin*) and choose an expiry date.
3. **Repository access**: choose **Only select repositories** and pick this repository.
4. **Permissions → Repository permissions → Contents**: choose **Read and write**.
   Leave everything else alone (GitHub adds *Metadata: Read-only* automatically).
5. Press **Generate token** and copy it — it starts with `github_pat_` and is shown only once.

Keep the token private, like a password. If it leaks, delete it on the same page and make a new one.

## 3. Use the admin

Open `admin.html` on your GitHub Pages site, paste the token and press **Sign in**. On GitHub
Pages the repository is detected from the address; elsewhere, type it as `owner/repository`
(and, under *Advanced*, the folder — `french-home/` — and the branch if it isn't the default).

- **Keep me signed in** stores the token in this browser (`localStorage`). Leave it unticked on a
  shared computer: the token is then forgotten when the tab closes (`sessionStorage`).
- **Try it without publishing** opens the admin on the current content with nothing sent anywhere,
  so you can explore safely.

Tabs:

- **Articles** — search the list, open a story or start a new one. Set the title, subtitle,
  category, date, author and cover photo; write in the story box using the formatting buttons and
  watch the live preview. Tick **Published on the site** (untick to keep it as a draft) and
  **Feature on the home page** (one story at a time fills the big picture at the top). The
  **Web address** is the part after `#/article/`.
- **Photos** — drag photos in or click to choose. They are resized to 2000 px and converted to
  JPEG in the browser before upload. Edit captions and credits, choose which appear in the
  gallery, delete those you no longer need (you are warned if a photo is in use).
- **Site settings** — the magazine name, tagline, description, contact details, home page quote,
  gallery introduction, the About page and its photo, and the categories (add, rename, reorder,
  remove; a category still used by stories can't be removed).
  At the top is **Maintenance mode**: tick it, write a message and publish, and visitors see only
  a "back soon" notice instead of the site. Untick and publish to reopen. Add `?preview` to the
  site's address (`…/french-home/?preview`) to see the site yourself meanwhile. This hides the
  site from visitors but is not a password: `content/site.json` and the photos stay publicly
  readable on GitHub Pages (and in the repository, if it is public).
- **Help** — the workflow and the formatting rules.

Nothing goes live until you press **Publish**. The number on the button counts unpublished
changes. Publishing sends all new photos, deleted photos and `site.json` to GitHub as a single
commit. Before it does, it checks whether `site.json` was changed elsewhere since you opened the
admin and asks before overwriting. The browser warns you if you try to leave with unpublished
changes. The public site updates a minute or two later, once GitHub Pages has rebuilt.

### Story formatting

| Type this | To get |
| --- | --- |
| `## Heading` | a large heading |
| `### Subheading` | a smaller, italic heading |
| `**bold**`, `*italic*` | **bold**, *italic* |
| `> quotation` | a large indented quotation |
| `- item` | a bulleted list |
| `[words](https://example.com)` | a link |
| `![Caption](photo-id)` on its own line | a full-width photo |

Leave a blank line between paragraphs. Everything is escaped, so HTML typed into a story shows as
text, and links may only point to `http(s)`, `mailto`, `#…` or relative addresses.

## 4. Run it on your own computer

Because the site loads `content/site.json` with `fetch`, open it through a small local web server
rather than by double-clicking the file. From the repository folder, either of these works:

```bash
python3 -m http.server 8000 --directory french-home
```

```bash
npx http-server french-home -p 8000
```

Then visit <http://localhost:8000/> for the site and <http://localhost:8000/admin.html> for the
admin. Locally the admin can't guess the repository, so type `owner/repository` when signing in
(or use **Try it without publishing**). You can also edit `content/site.json` by hand; check it is
still valid JSON before committing.

## Content model (`content/site.json`)

- `site` — `name`, `tagline`, `description`, `author`, `email`, `instagram`, `quote`, `quoteBy`,
  `galleryIntro`, `aboutTitle`, `aboutPhoto` (a photo id), `about` (Markdown), and
  `maintenance` (true hides the site) with `maintenanceMessage`
- `categories[]` — `id` (used in the web address), `name`, `blurb`, `photo` (photo id)
- `articles[]` — `id`, `slug`, `title`, `dek` (subtitle), `category` (category id), `date`
  (YYYY-MM-DD), `author`, `cover` (photo id), `body` (Markdown), `featured`, `status`
  (`"published"` or `"draft"`)
- `photos[]` — `id`, `src` (path inside `french-home/`), `caption`, `credit`, `license`,
  `sourceUrl`, `gallery` (true/false)

## Starter photos

The starter photos come from [Wikimedia Commons](https://commons.wikimedia.org/) under CC0,
CC BY or CC BY-SA licences, resized to about 1800 px. Each photographer, licence and source page
is listed on the site's **Photo credits** page (`#/credits`). If you reuse or adapt a CC BY-SA
photo, share your version under the same licence. Before launch, replace the placeholder contact
email (`bonjour@example.com`) in **Site settings** and add your Instagram handle if you have one.
