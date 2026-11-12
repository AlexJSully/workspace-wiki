describe('Rendering', () => {
	it('renders Markdown with its own H1 as the title, tables, and inline code', () => {
		cy.openSite();
		cy.get(byTestId('page')).should('have.attr', 'data-kind', 'markdown');
		cy.get('.page-title').should('have.length', 1).and('have.text', 'Atlas Docs');
		cy.get(`${byTestId('page-body')} .table-scroll table th`)
			.first()
			.should('have.text', 'Setting');
		cy.get(`${byTestId('page-body')} code`)
			.first()
			.should('have.text', 'npm install');
		cy.get(`${byTestId('page-body')} h2`)
			.first()
			.should('have.id', 'install');
	});

	it('shows the front matter description under the title', () => {
		cy.openSite({ page: 'getting-started.md' });
		cy.get('.page-lede').should('have.text', 'Install and first run');
	});

	it('builds "On this page" from the headings and follows its links', () => {
		cy.openSite({ page: 'docs/architecture.md' });
		cy.get(byTestId('toc'))
			.should('be.visible')
			.within(() => {
				cy.get('.toc-heading').should('have.text', 'On this page');
				cy.get('.toc-item').should('have.length', 6);
				cy.get('.toc-sub').should('have.length', 2);
				cy.contains('.toc-link', 'Code').click();
			});
		cy.get(byTestId('main')).invoke('scrollTop').should('be.greaterThan', 0);
		cy.get('#code').should('be.visible');
	});

	it('highlights fenced code by its language', () => {
		cy.openSite({ page: 'docs/architecture.md' });
		cy.get(`${byTestId('page-body')} pre.code-block code.language-ts .hljs-keyword`)
			.first()
			.should('have.text', 'export');
	});

	it('draws Mermaid diagrams', () => {
		cy.openSite({ page: 'docs/architecture.md' });
		cy.get('pre.mermaid.mermaid-rendered svg', { timeout: 15000 }).should('exist');
		cy.get('pre.mermaid svg').should('contain.text', 'Scanner');
		cy.get('#data-flow').scrollIntoView();
		cy.screenshot('architecture-page', { capture: 'viewport' });
	});

	it('loads relative and root-relative images from the workspace', () => {
		cy.openSite({ page: 'docs/architecture.md' });
		cy.get('img[alt="Data flow"]')
			.should('have.attr', 'src', 'http://localhost:5179/fixtures/docs/images/diagram.svg')
			.and(($img) => expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));
		cy.get('img[alt="Root-relative diagram"]').should(
			'have.attr',
			'src',
			'http://localhost:5179/fixtures/docs/images/diagram.svg',
		);
	});

	it('loads every srcset candidate of a responsive image from the workspace', () => {
		cy.openSite({ page: 'docs/architecture.md' });
		const candidates =
			'http://localhost:5179/fixtures/docs/images/diagram.svg 1x, http://localhost:5179/fixtures/docs/images/diagram.svg 2x';
		cy.get('picture source').should('have.attr', 'srcset', candidates);
		cy.get('img[alt="Responsive diagram"]')
			.should('have.attr', 'srcset', candidates)
			.and(($img) => expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));
	});

	it('strips script, event handlers, and styles from Markdown', () => {
		cy.openSite({ page: 'docs/architecture.md' });
		cy.get('#inline-html').should('contain.html', '<strong>HTML</strong>');
		cy.get(`${byTestId('page-body')} script`).should('not.exist');
		// Mermaid's own diagrams carry a <style> inside their SVG; none may come from the document.
		cy.get(byTestId('page-body'))
			.find('style')
			.filter((_, element) => !element.closest('svg'))
			.should('have.length', 0);
		cy.get('img[alt="broken"]').should('not.have.attr', 'onerror');
		cy.get('body').should('be.visible');
		cy.window().should((win) => expect(Reflect.get(win, '__xss')).to.equal(undefined));
	});

	it('keeps no data attribute a document writes, so it cannot set what a right-click acts on', () => {
		cy.openSite({ page: 'docs/architecture.md' });
		cy.get('#inline-html').should('not.have.attr', 'data-testid');
		cy.get('#spoofed-context').should('have.text', 'Spoofed context');
		cy.get('#spoofed-context').should('not.have.attr', 'data-vscode-context');
		cy.get('#spoofed-context').should('not.have.attr', 'data-uri');
	});

	it('renders HTML files sanitized', () => {
		cy.openSite({ page: 'docs/api.html' });
		cy.get(byTestId('page')).should('have.attr', 'data-kind', 'html').and('be.visible');
		cy.get(byTestId('page-title')).should('have.text', 'API reference');
		cy.get('#api-paragraph').click();
		cy.get('#api-paragraph').should('not.have.attr', 'onclick');
		cy.window().should((win) => expect(Reflect.get(win, '__xss')).to.equal(undefined));
		cy.get(`${byTestId('toc')} .toc-item`).should('have.length', 2);
	});

	it('highlights source files', () => {
		cy.openSite({ page: 'src/doc.go' });
		cy.get(byTestId('page')).should('have.attr', 'data-kind', 'code');
		cy.get('pre.code-file code.language-go .hljs-keyword').first().should('have.text', 'package');
	});

	it('shows images inline', () => {
		cy.openSite({ page: 'src/diagram.svg' });
		cy.get('.image-page img')
			.should('have.attr', 'src', 'http://localhost:5179/fixtures/src/diagram.svg')
			.and('have.attr', 'alt', 'Diagram');
	});

	it('offers to open a PDF in its own editor', () => {
		cy.openSite({ page: 'src/manual.pdf' });
		cy.get(byTestId('page')).should('have.attr', 'data-kind', 'binary');
		cy.get(byTestId('binary-note')).should('contain.text', 'can’t be shown here');
		cy.get(byTestId('open-preview')).should('be.visible');
		cy.get(`${byTestId('page')} canvas`).should('not.exist');
	});

	it('offers to open files it cannot show', () => {
		cy.openSite({ page: 'src/data.xlsx' });
		cy.get(byTestId('binary-note')).should('contain.text', 'can’t be shown here');
		cy.get(byTestId('open-preview')).should('be.visible');
	});

	it('says when a long file was cut short', () => {
		cy.openSite({ page: 'src/notes.txt' });
		cy.get('.page-notice').should('contain.text', 'only its beginning is shown');
	});

	it('re-renders when the host sends a newer copy of the page', () => {
		cy.openSite({ page: 'getting-started.md' });
		cy.get(byTestId('page-title')).should('have.text', 'Getting Started');
		cy.hostSends({
			type: 'page',
			page: {
				uri: 'file:///workspace-root/getting-started.md',
				title: 'Getting Started',
				path: 'getting-started.md',
				kind: 'markdown',
				content: '# Getting Started\n\nSaved just now.\n',
				resourceBase: 'http://localhost:5179/fixtures',
				rootBase: 'http://localhost:5179/fixtures',
			},
		});
		cy.get(byTestId('page-body')).should('contain.text', 'Saved just now.');
	});

	it('keeps the reading position when the host re-sends the page shown', () => {
		const longPage = (note: string) => ({
			type: 'page' as const,
			page: {
				uri: 'file:///workspace-root/getting-started.md',
				title: 'Getting Started',
				path: 'getting-started.md',
				kind: 'markdown' as const,
				content: `# Getting Started\n\n${'A paragraph of filler text.\n\n'.repeat(120)}${note}\n`,
				resourceBase: 'http://localhost:5179/fixtures',
				rootBase: 'http://localhost:5179/fixtures',
			},
		});
		cy.openSite({ page: 'getting-started.md' });
		cy.get(byTestId('page-title')).should('have.text', 'Getting Started');
		cy.hostSends(longPage('First copy.'));
		cy.get(byTestId('page-body')).should('contain.text', 'First copy.');
		cy.get(byTestId('main')).scrollTo(0, 600);
		cy.get(byTestId('main')).invoke('scrollTop').should('be.closeTo', 600, 2);

		cy.hostSends(longPage('Saved copy.'));
		cy.get(byTestId('page-body')).should('contain.text', 'Saved copy.');
		cy.get(byTestId('main')).invoke('scrollTop').should('be.closeTo', 600, 2);

		cy.hostSends({ type: 'goto', uri: 'file:///workspace-root/docs/architecture.md' });
		cy.get(byTestId('page-title')).should('have.text', 'Architecture');
		cy.get(byTestId('main')).invoke('scrollTop').should('equal', 0);
	});
});
