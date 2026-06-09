function mockAuthenticatedApp() {
  cy.intercept('GET', '**/api/auth/me', {
    statusCode: 200,
    body: {
      id: 'user-1',
      email: 'vu@example.com',
      username: 'Vu Khang Le',
    },
  }).as('getMe');

  cy.intercept('GET', '**/api/game/today', {
    statusCode: 200,
    body: {
      id: 'daily-game-1',
      word: btoa('CRANE'),
      guesses: [],
      attempts: 0,
      status: 'PLAYING',
    },
  }).as('getToday');

  cy.intercept('GET', '**/api/stats/me', {
    statusCode: 200,
    body: {
      gamesPlayed: 0,
      winPercentage: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: {},
      badges: [],
      completedDailyGames: [],
    },
  }).as('getStats');
}

function getVisibleDirectChildren(container) {
  return Array.from(container.children).filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  });
}

function doRectsOverlap(first, second) {
  const horizontalOverlap = Math.min(first.right, second.right) - Math.max(first.left, second.left);
  const verticalOverlap = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
  return horizontalOverlap > 1 && verticalOverlap > 1;
}

describe('Header layout', () => {
  [
    { label: 'desktop', width: 1280, height: 720 },
    { label: 'mid laptop', width: 1100, height: 720 },
    { label: 'tablet', width: 820, height: 900 },
    { label: 'mobile', width: 390, height: 844 },
  ].forEach(({ label, width, height }) => {
    it(`does not overlap controls at ${label} width`, () => {
      cy.viewport(width, height);
      mockAuthenticatedApp();
      cy.visit('/', {
        onBeforeLoad(win) {
          win.localStorage.setItem('wordle:hasSeenHowToPlay', 'true');
        },
      });
      cy.wait('@getToday');

      cy.get('.header-container').should('be.visible').then(($container) => {
        const container = $container[0];
        const containerRect = container.getBoundingClientRect();
        const children = getVisibleDirectChildren(container);

        children.forEach((child) => {
          const rect = child.getBoundingClientRect();
          expect(rect.left, `${child.className} left edge`).to.be.at.least(containerRect.left - 1);
          expect(rect.right, `${child.className} right edge`).to.be.at.most(containerRect.right + 1);
        });

        for (let i = 0; i < children.length; i += 1) {
          for (let j = i + 1; j < children.length; j += 1) {
            const first = children[i];
            const second = children[j];
            expect(
              doRectsOverlap(first.getBoundingClientRect(), second.getBoundingClientRect()),
              `${first.className} should not overlap ${second.className}`,
            ).to.equal(false);
          }
        }
      });
    });
  });
});
