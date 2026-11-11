const ROOT = 'file:///workspace-root';

describe('Links', () => {
	beforeEach(() => {
		cy.openSite();
		cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
		cy.clearPosted();
	});

	it('opens an external link in the default browser on a left click', () => {
		cy.contains('a', 'Example site').click();
		cy.hostReceived('openExternal').should('deep.equal', [
			{ type: 'openExternal', url: 'https://example.com/docs', integrated: false },
		]);
	});

	it('opens an external link in the integrated browser on a middle click', () => {
		cy.contains('a', 'Example site').trigger('auxclick', { button: 1 });
		cy.hostReceived('openExternal').should('deep.equal', [
			{ type: 'openExternal', url: 'https://example.com/docs', integrated: true },
		]);
	});

	it('follows a link to another page in the same tab', () => {
		cy.contains('a', 'getting started guide').click();
		cy.hostReceived('openLink').should('deep.equal', [
			{ type: 'openLink', href: 'getting-started.md', fromUri: `${ROOT}/README.md`, newTab: false },
		]);
		cy.get(byTestId('page-title')).should('have.text', 'Getting Started');
	});

	it('lands on the heading a link names', () => {
		cy.contains('a', 'Architecture overview').click();
		cy.get(byTestId('page-title')).should('have.text', 'Architecture');
		cy.get('#overview').should(($heading) => {
			expect($heading[0].getBoundingClientRect().top).to.be.lessThan(200);
		});
	});

	it('opens a folder link on its index page', () => {
		cy.contains('a', 'The docs folder').click();
		cy.get(byTestId('page-title')).should('have.text', 'Index');
	});

	it('opens a page link in a new tab on a middle click or Ctrl+click', () => {
		cy.contains('a', 'getting started guide').trigger('auxclick', { button: 1 });
		cy.contains('a', 'getting started guide').click({ ctrlKey: true });
		cy.hostReceived('openLink').should('deep.equal', [
			{ type: 'openLink', href: 'getting-started.md', fromUri: `${ROOT}/README.md`, newTab: true },
			{ type: 'openLink', href: 'getting-started.md', fromUri: `${ROOT}/README.md`, newTab: true },
		]);
		cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
	});

	it('scrolls to an anchor on the same page without asking the host', () => {
		cy.contains('a', 'Jump to install').click();
		cy.hostReceived('openLink').should('have.length', 0);
		cy.hostReceived('navigate').should('have.length', 0);
	});

	it('does not turn a script URL into a link', () => {
		cy.get(byTestId('page-body')).should('contain.text', 'A script link');
		cy.contains('a', 'A script link').should('not.exist');
		cy.get(`${byTestId('page-body')} a[href^="javascript:" i]`).should('not.exist');
	});

	it('opens a nav page in a new tab on a middle click', () => {
		cy.contains(byTestId('nav-link'), 'Getting Started').trigger('auxclick', { button: 1 });
		cy.hostReceived('openInNewTab').should('deep.equal', [
			{ type: 'openInNewTab', uri: `${ROOT}/getting-started.md` },
		]);
	});

	it('opens the original file in the editor on a double click in the nav', () => {
		cy.contains(byTestId('nav-link'), 'Getting Started').dblclick();
		cy.hostReceived('openOriginal').should('deep.equal', [
			{ type: 'openOriginal', uri: `${ROOT}/getting-started.md`, mode: 'editor' },
		]);
	});

	it('opens the original file from the page buttons', () => {
		cy.get(byTestId('open-preview')).click();
		cy.get(byTestId('edit-source')).click();
		cy.hostReceived('openOriginal').should('deep.equal', [
			{ type: 'openOriginal', uri: `${ROOT}/README.md`, mode: 'preview' },
			{ type: 'openOriginal', uri: `${ROOT}/README.md`, mode: 'editor' },
		]);
	});

	it('gives every page and link the context its right-click menu needs', () => {
		cy.contains(byTestId('nav-link'), 'Getting Started')
			.invoke('attr', 'data-vscode-context')
			.then((json) => JSON.parse(json as string))
			.should('deep.equal', {
				webviewSection: 'doc',
				uri: `${ROOT}/getting-started.md`,
				preventDefaultContextMenuItems: true,
			});
		cy.contains('a', 'getting started guide')
			.invoke('attr', 'data-vscode-context')
			.then((json) => JSON.parse(json as string))
			.should('deep.equal', {
				webviewSection: 'doc',
				href: 'getting-started.md',
				fromUri: `${ROOT}/README.md`,
				preventDefaultContextMenuItems: true,
			});
		cy.contains('a', 'Example site')
			.invoke('attr', 'data-vscode-context')
			.then((json) => JSON.parse(json as string))
			.should('deep.equal', {
				webviewSection: 'external',
				href: 'https://example.com/docs',
				preventDefaultContextMenuItems: true,
			});
		cy.contains('a', 'Jump to install').should('not.have.attr', 'data-vscode-context');
	});
});
