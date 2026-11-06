# Punch Missing Report

A simple website for making the **Security Punch Missing Report**.
Add each missed punch on the phone. At month end, download the report as **PDF, Word or Excel**, or send the PDF on WhatsApp.

It is a plain website (HTML + CSS + JavaScript). It has no build step and no server, and it works without internet once opened.

## Files

| File | What it does |
|---|---|
| `index.html` | The screens (Add, Report, Settings) |
| `style.css` | Colours, sizes, big buttons |
| `app.js` | All the logic: saving entries, making PDF/Word/Excel |
| `lib/` | Libraries for making PDF (pdf-lib) and Word/Excel (JSZip) |
| `manifest.json`, `icon.svg` | Let the site be added to the phone's home screen like an app |

To change the default project name, guard list or locations, edit the top of **`app.js`**.

## 1. Run it in VS Code

1. Open VS Code → **File → Open Folder** → choose this `punch-missing-report` folder.
2. Install the extension **Live Server** (by Ritwick Dey).
3. Right-click `index.html` → **Open with Live Server**. The site opens in your browser.

Or, in the VS Code terminal: `npx serve .` and open the link it shows.

## 2. Put it on GitHub

Create an empty repository on github.com (for example `punch-missing-report`), then in the VS Code terminal:

```bash
git init
git add .
git commit -m "Punch missing report website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/punch-missing-report.git
git push -u origin main
```

## 3. Put it online with Vercel

1. Go to vercel.com and log in with GitHub.
2. Click **Add New → Project** and **Import** your `punch-missing-report` repository.
3. Framework Preset: **Other**. Leave Build Command and Output Directory empty.
4. Click **Deploy**. You get a link like `https://punch-missing-report.vercel.app`.

Every time you `git push`, Vercel updates the site automatically.

## 4. Set it up on your father's phone

1. Open the Vercel link in **Chrome** on his phone.
2. Tap **⋮ (three dots) → Add to Home screen**. The app icon now appears like any app.

## Important: where the data is saved

- Entries are saved **in the phone's browser** (localStorage). Each phone has its own data, and nothing is sent to any server.
- Your father should always use **the same phone and the same browser**.
- Clearing Chrome's data/history for this site deletes the entries. Use **Settings → Save backup file** once a month. **Restore from backup file** brings everything back, even on a new phone.

## How your father uses it

1. **➕ Add** tab → choose date → type the guard's **E-bill No.** (name, shift and place fill in by themselves).
2. Tap what is missing: **Out punch / In punch / Came late** → enter the time → **✓ Save Entry**.
3. At month end: **📄 Report** tab → choose month → **Download PDF** or **Send PDF on WhatsApp**.
