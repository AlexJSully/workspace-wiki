# Publishing Guide

This guide explains how to package and publish the Workspace Wiki extension to the VS Code Marketplace.

## Prerequisites

- [Node.js](https://nodejs.org/) and npm installed
- [VSCE](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) (Visual Studio Code Extension Manager):

    ```sh
    npm install -g @vscode/vsce
    ```

- Microsoft account with publisher access

## Packaging the Extension

1. Build the extension:

    ```sh
    npm run build
    ```

2. Run tests and lint:

    ```sh
    npm run validate
    ```

3. Package the VSIX:

    ```sh
    vsce package
    ```

## Publishing to Marketplace

1. Login to VSCE:

    ```sh
    vsce login <publisher-name>
    ```

2. Publish:

    ```sh
    vsce publish
    ```
