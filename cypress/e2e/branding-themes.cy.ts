describe('Branding and themes', () => {
	it('shows the workspace name and logo in the header', () => {
		cy.openSite();
		cy.get(byTestId('brand-name')).should('have.text', 'Atlas');
		cy.get(byTestId('brand-logo'))
			.should('have.attr', 'src', 'http://localhost:5179/fixtures/logo.svg')
			.and(($img) => expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));
	});

	it('shows only the name when there is no logo', () => {
		cy.openSite({ logo: '0' });
		cy.get(byTestId('brand-logo')).should('not.exist');
		cy.get(byTestId('brand-name')).should('have.text', 'Atlas');
	});

	it('returns home from the name', () => {
		cy.openSite({ page: 'src/doc.go' });
		cy.get(byTestId('page-title')).should('have.text', 'Doc');
		cy.get(byTestId('brand')).click();
		cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
	});

	const themes = [
		{ theme: 'vscode', vscode: 'light', background: 'rgb(255, 255, 255)' },
		{ theme: 'vscode', vscode: 'dark', background: 'rgb(31, 31, 31)' },
		{ theme: 'paper', vscode: 'dark', background: 'rgb(255, 255, 255)' },
		{ theme: 'slate', vscode: 'light', background: 'rgb(15, 20, 26)' },
		{ theme: 'lagoon', vscode: 'light', background: 'rgb(255, 255, 255)' },
	];

	themes.forEach(({ theme, vscode, background }) => {
		it(`applies the ${theme} theme over a ${vscode} VS Code theme`, () => {
			cy.openSite({ theme, vscode });
			cy.get('.wiki')
				.should('have.attr', 'data-wiki-theme', theme)
				.and('have.css', 'background-color', background);
			cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
			cy.screenshot(`theme-${theme}-${vscode}`, { capture: 'viewport' });
		});
	});

	it('paints the lagoon header teal', () => {
		cy.openSite({ theme: 'lagoon' });
		cy.get('.wiki-header').should('have.css', 'background-color', 'rgb(47, 125, 115)');
	});

	it('keeps the VS Code colours under a high-contrast theme', () => {
		cy.openSite({ theme: 'slate', vscode: 'hc' });
		cy.get('.wiki')
			.should('have.attr', 'data-wiki-theme', 'vscode')
			.and('have.css', 'background-color', 'rgb(0, 0, 0)');
	});

	it('loads a custom stylesheet after the theme, so its variables win', () => {
		cy.openSite({ theme: 'paper', customCss: '1' });
		cy.get('link[data-custom-css]').should('have.attr', 'href', 'http://localhost:5179/fixtures/custom.css');
		cy.get(`${byTestId('page-body')} a`)
			.first()
			.should('have.css', 'color', 'rgb(138, 63, 252)');
	});

	it('replaces custom stylesheets when the settings change', () => {
		cy.openSite({ customCss: '1' });
		cy.get('link[data-custom-css]').should('have.length', 1);
		cy.hostSends({ type: 'init', site: { name: 'Atlas', theme: 'slate', customCss: [] }, tree: [] });
		cy.get('link[data-custom-css]').should('not.exist');
		cy.get('.wiki').should('have.attr', 'data-wiki-theme', 'slate');
	});
});
