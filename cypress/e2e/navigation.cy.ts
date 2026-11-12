const ROOT = 'file:///workspace-root';

describe('Navigation', () => {
	it('lists the tree in the order the sidebar uses, with folders collapsed', () => {
		cy.openSite();
		cy.get(`${byTestId('nav')} > .nav-list > .nav-item`).should('have.length', 4);
		cy.get(`${byTestId('nav')} > .nav-list > .nav-item`)
			.then((items) => [...items].map((item) => item.querySelector('.nav-label')?.textContent))
			.should('deep.equal', ['README', 'Getting Started', 'Docs', 'Src']);
		cy.get(byTestId('nav-folder')).first().should('have.attr', 'aria-expanded', 'false');
	});

	it('opens on the root README as the home page', () => {
		cy.openSite();
		cy.hostReceived('navigate').should('deep.equal', [{ type: 'navigate', uri: `${ROOT}/README.md` }]);
		cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
		cy.get(`${byTestId('nav-link')}[aria-current="page"]`).should('have.text', 'README');
		cy.hostReceived('title').its(0).should('deep.equal', { type: 'title', title: 'README' });
	});

	it('expands a folder and opens a page from it, with breadcrumbs', () => {
		cy.openSite();
		cy.contains(byTestId('nav-folder'), 'Docs').click().should('have.attr', 'aria-expanded', 'true');
		cy.contains(byTestId('nav-link'), 'Architecture').click();
		cy.hostReceived('navigate')
			.its(1)
			.should('deep.equal', { type: 'navigate', uri: `${ROOT}/docs/architecture.md` });
		cy.get(byTestId('page-title')).should('have.text', 'Architecture');
		cy.get(`${byTestId('breadcrumbs')} li`)
			.then((items) => [...items].map((item) => item.textContent))
			.should('deep.equal', ['Home', 'Docs', 'Architecture']);
		cy.get(byTestId('page-path')).should('have.text', 'docs/architecture.md');
	});

	it('collapses an open folder again', () => {
		cy.openSite();
		cy.contains(byTestId('nav-folder'), 'Src').click().click().should('have.attr', 'aria-expanded', 'false');
		cy.contains(byTestId('nav-link'), 'Doc').should('not.be.visible');
	});

	it('goes back and forward through visited pages', () => {
		cy.openSite();
		cy.get(byTestId('history-back')).should('be.disabled');
		cy.contains(byTestId('nav-link'), 'Getting Started').click();
		cy.get(byTestId('page-title')).should('have.text', 'Getting Started');
		cy.get(byTestId('history-back')).should('be.enabled').click();
		cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
		cy.get(byTestId('history-forward')).click();
		cy.get(byTestId('page-title')).should('have.text', 'Getting Started');
		cy.get('body').type('{alt}{leftArrow}');
		cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
	});

	it('opens on the page "Open in Wiki Site" names and expands its folder', () => {
		cy.openSite({ page: 'src/doc.go' });
		cy.get(byTestId('page-title')).should('have.text', 'Doc');
		cy.contains(byTestId('nav-folder'), 'Src').should('have.attr', 'aria-expanded', 'true');
		cy.get(`${byTestId('nav-link')}[aria-current="page"]`).should('have.text', 'Doc');
	});

	it('moves to a page the host sends it to', () => {
		cy.openSite();
		cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
		cy.hostSends({ type: 'goto', uri: `${ROOT}/getting-started.md` });
		cy.get(byTestId('page-title')).should('have.text', 'Getting Started');
	});

	it('lists the top-level sections when there is no README', () => {
		cy.openSite({ fixture: 'noReadme' });
		cy.get(byTestId('landing')).within(() => {
			cy.get('.page-title').should('have.text', 'Atlas');
			cy.get('.landing-link').should('have.length', 3);
			cy.contains('.landing-link', 'Docs').click();
		});
		cy.get(byTestId('page-title')).should('have.text', 'Index');
	});

	it('explains what to do when no documents are found', () => {
		cy.openSite({ fixture: 'empty' });
		cy.get(byTestId('landing')).should('contain.text', 'No documents match your Workspace Wiki settings yet');
		cy.get(byTestId('nav')).should('contain.text', 'No documents found.');
	});

	it('shows the host error for a page that cannot be read', () => {
		cy.openSite();
		cy.hostSends({ type: 'goto', uri: `${ROOT}/missing.md` });
		cy.get(byTestId('page-error')).should('contain.text', 'This page is not part of the wiki.');
	});

	[
		{ width: 1280, page: 'docs/architecture.md' },
		{ width: 900, page: 'docs/architecture.md' },
		{ width: 400, page: 'docs/architecture.md' },
	].forEach(({ width, page }) => {
		it(`fits a ${width}px window without scrolling sideways`, () => {
			cy.viewport(width, 800);
			cy.openSite({ page });
			cy.get('pre.mermaid.mermaid-rendered', { timeout: 15000 }).should('exist');
			cy.document().should((doc) => {
				expect(doc.documentElement.scrollWidth).to.be.at.most(width);
				expect(doc.body.scrollWidth).to.be.at.most(width);
			});
		});
	});

	it('collapses the navigation into a toggle on a narrow window', () => {
		cy.viewport(600, 800);
		cy.openSite();
		cy.get(byTestId('nav')).should('not.be.visible');
		cy.get(byTestId('nav-toggle')).click().should('have.attr', 'aria-expanded', 'true');
		cy.get(byTestId('nav')).should('be.visible');
		cy.contains(byTestId('nav-link'), 'Getting Started').click();
		cy.get(byTestId('nav')).should('not.be.visible');
	});
});
