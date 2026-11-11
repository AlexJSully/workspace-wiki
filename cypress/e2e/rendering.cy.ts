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

	it('strips script, event handlers, and styles from Markdown', () => {
		cy.openSite({ page: 'docs/architecture.md' });
		cy.get(byTestId('inline-html')).should('contain.html', '<strong>HTML</strong>');
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

	it('renders HTML files sanitized', () => {
		cy.openSite({ page: 'docs/api.html' });
		cy.get(byTestId('page')).should('have.attr', 'data-kind', 'html').and('be.visible');
		cy.get(byTestId('page-title')).should('have.text', 'API reference');
		cy.get(byTestId('api-paragraph')).click();
		cy.get(byTestId('api-paragraph')).should('not.have.attr', 'onclick');
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

	it('draws every page of a PDF', () => {
		cy.openSite({ page: 'src/manual.pdf' });
		cy.get(byTestId('page')).should('have.attr', 'data-kind', 'pdf');
		cy.get(byTestId('pdf-document'), { timeout: 15000 }).should('have.attr', 'data-state', 'ready');
		cy.get('.pdf-status')
			.invoke('text')
			.should('match', /^\d+ pages?$/);
		cy.get('.pdf-page').should('have.length.at.least', 1);
		cy.get('.pdf-page').first().should('have.attr', 'data-rendered');
		cy.get('.pdf-page')
			.first()
			.should('have.attr', 'aria-label')
			.and('match', /^Page 1 of \d+$/);
		cy.get('.pdf-page')
			.first()
			.should(($canvas) => expect(($canvas[0] as HTMLCanvasElement).width).to.be.greaterThan(0));
		cy.screenshot('pdf-page', { capture: 'viewport' });
	});

	it('says when a PDF cannot be read', () => {
		cy.openSite({ page: 'src/manual.pdf' });
		cy.get(byTestId('pdf-document'), { timeout: 15000 }).should('have.attr', 'data-state', 'ready');
		cy.hostSends({
			type: 'page',
			page: {
				uri: 'file:///workspace-root/src/manual.pdf',
				title: 'Manual',
				path: 'src/manual.pdf',
				kind: 'pdf',
				fileSrc: 'http://localhost:5179/fixtures/src/missing.pdf',
				resourceBase: 'http://localhost:5179/fixtures/src',
				rootBase: 'http://localhost:5179/fixtures',
			},
		});
		cy.get(byTestId('pdf-document'), { timeout: 15000 }).should('have.attr', 'data-state', 'failed');
		cy.get('.pdf-status').should('contain.text', 'This PDF could not be shown');
		cy.get(byTestId('open-preview')).should('be.visible');
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
});
