describe('Practice play flow', () => {
  beforeEach(() => {
    cy.mockAuthGuest();
    cy.mockDailyGame('CRANE');
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('wordle:hasSeenHowToPlay', 'true');
        cy.stub(win.Math, 'random').returns(0);
      },
    });
    cy.wait('@getToday');
  });

  it('plays, wins, starts again, loses, and preserves daily state when switching back', () => {
    cy.contains('button', 'Practice').click();
    cy.contains('Practice Mode').should('be.visible');

    cy.submitWord('adieu');
    cy.get('.row').first().find('.cell.correct, .cell.present, .cell.absent')
      .should('have.length', 5);

    cy.submitWord('aback');
    cy.contains('You won!').should('be.visible');
    cy.contains('Wordle Bot').should('be.visible');
    cy.contains('button', 'Check Wordle Bot').should('be.visible');
    cy.contains('button', 'Play Again').should('be.visible').click();

    cy.get('.row').first().find('.cell').first().should('have.text', '');
    cy.contains('Practice Mode').should('be.visible');

    ['aback', 'abide', 'about', 'cigar', 'crane', 'speed'].forEach((word) => {
      cy.submitWord(word);
    });

    cy.contains('Game Over').should('be.visible');
    cy.contains('The word was').should('be.visible');
    cy.contains('ABASE').should('be.visible');
    cy.contains('Wordle Bot').should('be.visible');
    cy.contains('button', 'Check Wordle Bot').should('be.visible');

    cy.contains('button', 'Close').click();
    cy.contains('button', 'Daily').click();
    cy.contains('Daily Challenge').should('be.visible');
    cy.get('.row').first().find('.cell').first().should('have.text', '');
  });
});
