const ROOT = 'file:///workspace-root';

describe('Search', () => {
	beforeEach(() => {
		cy.openSite();
		cy.get(byTestId('page-title')).should('have.text', 'Atlas Docs');
	});

	it('suggests pages by title while typing and opens one', () => {
		cy.get(byTestId('search-input')).type('arch');
		cy.get(byTestId('search-suggestions'))
			.should('be.visible')
			.within(() => {
				cy.get('.suggestion-title').first().should('have.text', 'Architecture');
			});
		cy.get(byTestId('search-input')).type('{downArrow}{enter}');
		cy.get(byTestId('page-title')).should('have.text', 'Architecture');
		cy.get(byTestId('search-suggestions')).should('not.be.visible');
	});

	it('searches every page on Enter and lists results with the matches marked', () => {
		cy.get(byTestId('search-input')).type('scanner{enter}');
		cy.hostReceived('search').should('deep.equal', [{ type: 'search', query: 'scanner' }]);
		cy.hostReceived('title').should((titles) => {
			expect(titles[titles.length - 1]).to.deep.equal({ type: 'title', title: 'Search: scanner' });
		});
		cy.get(byTestId('search-results')).within(() => {
			cy.get('.page-title').should('have.text', 'Results for “scanner”');
			cy.get(byTestId('search-result')).should('have.length', 1);
			cy.get(byTestId('search-result')).first().find('.result-title').should('have.text', 'Architecture');
			cy.get('mark')
				.first()
				.invoke('text')
				.should('match', /scanner/i);
		});
	});

	it('opens a result', () => {
		cy.get(byTestId('search-input')).type('node.js{enter}');
		cy.get(byTestId('search-result')).first().find('.result-title').click();
		cy.get(byTestId('page-title')).should('have.text', 'Getting Started');
		cy.get(byTestId('history-back')).click();
		cy.get(byTestId('search-results')).should('exist');
	});

	it('says when nothing matches', () => {
		cy.get(byTestId('search-input')).type('zebra{enter}');
		cy.get(byTestId('search-results')).should('contain.text', 'No pages match.');
	});

	it('shows result text as text, never as markup', () => {
		cy.get(byTestId('search-input')).type('anything{enter}');
		cy.hostSends({
			type: 'searchResults',
			query: 'anything',
			results: [
				{
					uri: `${ROOT}/README.md`,
					title: '<img src=x onerror="window.__xss=9">',
					path: 'README.md',
					snippet: 'before <b>anything</b> after',
					ranges: [[10, 18]],
				},
			],
		});
		cy.get('.result-title').should('have.text', '<img src=x onerror="window.__xss=9">');
		cy.get('.result-snippet mark').should('have.text', 'anything');
		cy.get('.result-snippet b').should('not.exist');
		cy.window().should((win) => expect(Reflect.get(win, '__xss')).to.equal(undefined));
	});

	it('focuses search with / and Ctrl+K', () => {
		cy.get('body').type('/');
		cy.focused().should('have.attr', 'data-testid', 'search-input');
		cy.focused().blur();
		cy.get('body').type('{ctrl}k');
		cy.focused().should('have.attr', 'data-testid', 'search-input');
	});
});
