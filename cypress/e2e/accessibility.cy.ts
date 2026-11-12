describe('Accessibility', () => {
	const themes = ['vscode', 'paper', 'slate', 'lagoon'];

	themes.forEach((theme) => {
		it(`has no axe violations on a page in the ${theme} theme`, () => {
			cy.openSite({ theme, page: 'docs/architecture.md' });
			cy.get('pre.mermaid.mermaid-rendered', { timeout: 15000 }).should('exist');
			cy.a11yCheck();
		});
	});

	it('has no axe violations on the search results', () => {
		cy.openSite();
		cy.get(byTestId('search-input')).type('scanner{enter}');
		cy.get(byTestId('search-result')).should('exist');
		cy.a11yCheck();
	});

	it('has no axe violations on the landing page', () => {
		cy.openSite({ fixture: 'noReadme' });
		cy.get(byTestId('landing')).should('exist');
		cy.a11yCheck();
	});
});
