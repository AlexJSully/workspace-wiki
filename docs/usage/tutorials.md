# Tutorials

This section provides step-by-step tutorials for using the Workspace Wiki extension, with practical examples and screenshots.

See the [Usage Guide](./index.md) for more details.

## Tutorial 1: Browsing Documentation

1. Open your project in VS Code.
2. Click the "Workspace Wiki" view in the Explorer sidebar.
3. Expand folders to see all documentation files.
4. Single-click a file to preview it.
5. Double-click to open in the editor.

## Tutorial 2: Customizing Settings

1. Open Command Palette and search for `Workspace Wiki` settings.
2. Change supported file extensions or exclude patterns.
3. Observe the tree updating to reflect your changes.

## Tutorial 3: Reading the Wiki as a Site

1. Click the book icon in the "Workspace Wiki" view's title bar, or run **Workspace Wiki: Open Wiki Site** from the Command Palette. The site opens on your top-level README.
2. Pick a page in the navigation on the left. The outline on the right lists its headings.
3. Type in the search box (press `/` to jump there). Pick a suggested page, or press Enter to search the text of every page.
4. Middle-click a page to open it in a new tab, or right-click it for **Open to the Side**, **Open Original File**, and **Edit Source**.
5. Click **Edit source** under the title, or double-click the page in the navigation, to edit its file.
6. Click a web link to open it in your browser; middle-click it to open it in a new tab of VS Code's integrated browser.

To open a particular file in the site, right-click it in the sidebar, the Explorer, or its editor tab and choose **Open in Wiki Site**.

## Tutorial 4: Styling the Wiki Site

1. Set `workspaceWiki.site.theme` to `paper`, `slate`, or `lagoon`, or leave it at `vscode` to follow your colour theme.
2. To brand the site, point `workspaceWiki.site.logo` at an image in your workspace. Without it, the site uses a `favicon` or `logo` file it finds, and shows it on the tab too when it is an SVG or PNG.
3. For your own look, add a stylesheet to the workspace, for example `docs/wiki.css`:

    ```css
    .wiki {
    	--wiki-accent: #8a3ffc;
    	--wiki-content-width: 52rem;
    }
    ```

4. List it in `workspaceWiki.site.customCss`:

    ```json
    {
    	"workspaceWiki.site.customCss": ["docs/wiki.css"]
    }
    ```

The [Wiki Site architecture page](../architecture/wiki-site.md#branding-and-themes) lists every variable.
