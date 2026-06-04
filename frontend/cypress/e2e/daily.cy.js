describe('Guest daily play flow', () => {
  beforeEach(() => {
    cy.mockAuthGuest();
    cy.mockDailyGame('CRANE');
    cy.visit('/');
    cy.wait('@getToday');
  });

  it('loads the daily board, plays guesses, wins, auto-opens results, shares, and hides keyboard', () => {
    cy.contains('Daily Challenge').should('be.visible');
    cy.get('.row').should('have.length', 6);
    cy.get('.row').first().find('.cell').should('have.length', 5);

    cy.get('body').type('adieu');
    cy.get('.row').first().find('.cell').eq(0).should('have.text', 'A');
    cy.get('.row').first().find('.cell').eq(4).should('have.text', 'U');

    cy.get('body').type('{enter}');
    cy.get('.row').first().find('.cell.correct, .cell.present, .cell.absent')
      .should('have.length', 5);
    cy.get('button[aria-label="A"]').should('have.class', 'present');

    cy.window().then((win) => {
      Object.defineProperty(win.navigator, 'clipboard', {
        value: { writeText: cy.stub().as('writeText').resolves() },
        configurable: true,
      });
    });

    cy.submitWord('crane');
    cy.contains('You won!').should('not.exist');
    cy.get('.keyboard').should('not.exist');
    cy.contains('button', 'See results').should('be.visible');

    cy.contains('Thanks for playing today!', { timeout: 3500 }).should('be.visible');
    cy.contains('Login to see your stats').should('be.visible');
    cy.contains('Guess Distribution').should('be.visible');
    cy.get('.results-bar-row--highlight .results-bar-label').should('have.text', '2');

    cy.contains('button', 'Share').click();
    cy.get('@writeText').should('have.been.calledOnce');
    cy.contains('Next word').should('be.visible');

    cy.contains('button', 'Back to puzzle').click();
    cy.contains('Thanks for playing today!').should('not.exist');
    cy.contains('button', 'See results').should('be.visible');
  });
});
