import { GUESS_REVEAL_DURATION_MS } from '../../src/utils/revealTiming.js';

Cypress.Commands.add('mockAuthGuest', () => {
  cy.intercept('GET', '**/api/auth/me', {
    statusCode: 401,
    body: { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
  }).as('getMe');

  cy.intercept('POST', '**/api/auth/refresh', {
    statusCode: 401,
    body: { error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token cookie is missing' } },
  }).as('refresh');
});

Cypress.Commands.add('mockDailyGame', (targetWord = 'CRANE') => {
  const encodedWord = btoa(targetWord);

  cy.intercept('GET', '**/api/game/today', {
    statusCode: 200,
    body: {
      id: 'daily-game-1',
      word: encodedWord,
      guesses: [],
      attempts: 0,
      status: 'PLAYING',
    },
  }).as('getToday');

  cy.intercept('POST', '**/api/game/sync', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        id: req.body.id,
        word: encodedWord,
        guesses: req.body.guesses,
        attempts: req.body.guesses.length,
        status: req.body.status,
      },
    });
  }).as('syncGame');
});

Cypress.Commands.add('submitWord', (word) => {
  cy.get('button[aria-label="ENTER"]').should('not.be.disabled');
  cy.get('body').type(`${word}{enter}`);
  cy.wait(GUESS_REVEAL_DURATION_MS + 40);
});
