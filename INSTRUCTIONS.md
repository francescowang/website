# How To Open This Project In Your Browser

This project is a static website built with HTML, CSS, and JavaScript.

That means:
- you do not need to install npm packages
- you do not need a build step
- you do not need a framework dev server

You can run it in the browser in two simple ways.

## Option 1: Open The Site Directly

Use this if you just want to preview the site quickly.

### Step 1: Open the project folder

Make sure you are inside this project folder:

```bash
cd /Users/frankie/Documents/vcard-personal-portfolio
```

### Step 2: Find the main file

The main page for the site is:

```text
index.html
```

### Step 3: Open the file in your browser

On macOS, run:

```bash
open index.html
```

This will open the website in your default browser.

### Step 4: Refresh after changes

If you edit the HTML, CSS, or JavaScript files, save your changes and refresh the browser tab.

## Option 2: Run A Local Server

Use this if you want a more realistic browser setup.

This is better than opening the file directly because some browser features work more reliably over http than file paths.

### Step 1: Open Terminal in the project folder

Run:

```bash
cd /Users/frankie/Documents/vcard-personal-portfolio
```

### Step 2: Start a local server

If Python 3 is installed, run:

```bash
python3 -m http.server 8000
```

### Step 3: Open the site in your browser

Open this address:

```text
http://localhost:8000
```

### Step 4: Stop the server when you are done

In Terminal, press:

```text
Control + C
```

## Option 3: Open It With VS Code Live Server

Use this if you want automatic browser refresh while editing.

### Step 1: Open the project in VS Code

Open the folder:

```text
/Users/frankie/Documents/vcard-personal-portfolio
```

### Step 2: Install the Live Server extension

In VS Code, search for:

```text
Live Server
```

### Step 3: Open the main page

Open:

```text
index.html
```

### Step 4: Start Live Server

Right-click inside index.html and choose:

```text
Open with Live Server
```

### Step 5: View the site in your browser

VS Code will open the site automatically in your browser.

## Files That Control The Site

If you want to edit the site, these are the main files:

- index.html: page structure and content
- assets/css/style.css: site styling and responsive layout
- assets/js/script.js: interactive behavior

## Quick Troubleshooting

### The page opens but styles look broken

Make sure you opened the project from the correct folder and did not move index.html away from the assets folder.

### The browser says the page cannot be found

Make sure you are in the correct directory before running the server command.

### Port 8000 is already in use

Start the server on another port:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### Changes are not showing up

Save your files and refresh the browser. If needed, do a hard refresh.

## Fastest Method

If you only need to get the site on screen quickly, use:

```bash
cd /Users/frankie/Documents/vcard-personal-portfolio
open index.html
```

If you want the cleaner development setup, use:

```bash
cd /Users/frankie/Documents/vcard-personal-portfolio
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```