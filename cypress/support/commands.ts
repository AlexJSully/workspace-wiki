/// <reference types="cypress" />
import type { HostToView, ViewToHost } from '@site/protocol';
import 'cypress-axe';

declare global {
	// eslint-disable-next-line no-unused-vars
	namespace Cypress {
		interface Chainable {
			/**
			 * Opens the harness with query parameters (`fixture`, `theme`, `vscode`, `customCss`, `logo`, `page`).
			 *
			 * @param _params Query parameters
			 * @returns The chain
			 */
			openSite(_params?: Record<string, string>): Chainable<void>;
			/**
			 * Delivers a message to the webview as the extension host would.
			 *
			 * @param _message The host message
			 * @returns The chain
			 */
			hostSends(_message: HostToView): Chainable<void>;
			/**
			 * Reads the webview's posts of one type; the read retries with the assertions chained after it.
			 *
			 * @param _type The message type
			 * @returns The matching messages, oldest first
			 */
			hostReceived<T extends ViewToHost['type']>(_type: T): Chainable<Extract<ViewToHost, { type: T }>[]>;
			/**
			 * Forgets the messages posted so far.
			 *
			 * @returns The chain
			 */
			clearPosted(): Chainable<void>;
			/**
			 * Injects axe and checks the page, logging each violation to the terminal.
			 *
			 * @returns The chain
			 */
			a11yCheck(): Chainable<void>;
		}
	}

	/** Builds a `[data-testid="…"]` selector. */
	// eslint-disable-next-line no-unused-vars
	var byTestId: (_id: string) => string;
}

globalThis.byTestId = (id: string): string => `[data-testid="${id}"]`;

Cypress.Commands.add('openSite', (params: Record<string, string> = {}) => {
	const query = new URLSearchParams(params).toString();
	cy.visit(query ? `/?${query}` : '/');
	cy.get('.wiki[data-state="ready"]');
});

Cypress.Commands.add('hostSends', (message: HostToView) => {
	cy.window().its('__harness').invoke('deliver', message);
});

Cypress.Commands.add('hostReceived', (type: ViewToHost['type']) =>
	cy
		.window()
		.its('__harness')
		.invoke('getPosted')
		.invoke('filter', (message: ViewToHost) => message.type === type),
);

Cypress.Commands.add('clearPosted', () => {
	cy.window().its('__harness').invoke('clearPosted');
});

/**
 * Logs each accessibility violation in the terminal so a failure names the offending rule and elements.
 *
 * @param violations Violations reported by axe; `any` because `cypress-axe` does not export the type
 */
function logViolations(violations: any): void {
	const lines = violations.map(
		(violation: any) =>
			`${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes
				.map((node: any) => `  ${node.target.join(' ')} ${node.failureSummary ?? ''}`)
				.join('\n')}`,
	);
	cy.task('log', `Accessibility violations:\n${lines.join('\n')}`);
}

// `cy.injectAxe()` evaluates axe's source, which the harness's Content Security Policy forbids, as the
// real webview's does. Loading the copy the harness build serves as a script keeps that policy on.
Cypress.Commands.add('a11yCheck', () => {
	cy.document().then((doc) => {
		if (!doc.querySelector('script[data-axe]')) {
			const script = doc.createElement('script');
			script.src = '/axe.min.js';
			script.dataset.axe = '';
			doc.head.appendChild(script);
		}
	});
	cy.window().its('axe').should('exist');
	cy.checkA11y(undefined, undefined, logViolations);
});

export {};
