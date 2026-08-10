'use strict';

const { test, expect } = require('@playwright/test');
const disruptionsFixture = require('./fixtures/disruptions.json');

test.beforeEach(async ({ page }) => {
  // Serve a known set of disruption events with RFC-1123 pubDates,
  // matching what the live Google News RSS pipeline produces.
  await page.route('**/data/energy/disruptions.json', route =>
    route.fulfill({ json: disruptionsFixture })
  );
});

test.describe('energy filter bar', () => {
  test('survives an Energy → Food → Energy mode round-trip', async ({ page }) => {
    await page.goto('/#energy/overview');
    await expect(page.locator('#table-body tr[data-id]')).toHaveCount(3);

    await page.click('button[data-mode="food"]');
    await page.click('button[data-mode="energy"]');

    const airlineOptions = page.locator('#filter-airline option');
    await expect(airlineOptions).toHaveText(['All Airlines', 'Lufthansa', 'Ryanair', 'SAS']);

    await page.selectOption('#filter-severity', 'critical');
    await expect(page.locator('#table-body tr[data-id]')).toHaveCount(1);
    await expect(page.locator('#table-count')).toHaveText('1 event');

    await page.click('#filter-clear');
    await expect(page.locator('#table-body tr[data-id]')).toHaveCount(3);
  });

  test('summer toggle still works after a mode round-trip', async ({ page }) => {
    await page.goto('/#energy/overview');
    await page.click('button[data-mode="food"]');
    await page.click('button[data-mode="energy"]');

    const toggle = page.locator('#summer-toggle');
    const before = await toggle.getAttribute('aria-pressed');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  });
});

test.describe('disruption timestamps', () => {
  test('table sorts newest-first despite RFC-1123 source dates', async ({ page }) => {
    await page.goto('/#energy/overview');
    await expect(page.locator('#table-body tr[data-id] .ts-cell')).toHaveText([
      '09 Aug 2026 12:00',
      '07 Aug 2026 07:00',
      '01 Aug 2026 09:00',
    ]);
  });

  test('timeline chart labels are chronological ISO dates', async ({ page }) => {
    await page.goto('/#energy/overview');
    await expect(page.locator('#table-body tr[data-id]')).toHaveCount(3);
    const labels = await page.evaluate(() =>
      Chart.getChart(document.getElementById('timeline-chart')).data.labels
    );
    expect(labels).toEqual(['2026-08-01', '2026-08-07', '2026-08-09']);
  });
});

test.describe('detail drawer', () => {
  test('clicking a source link does not open the drawer', async ({ page }) => {
    await page.goto('/#energy/overview');
    const link = page.locator('#table-body a.source-link').first();
    await link.evaluate(a => {
      a.addEventListener('click', e => e.preventDefault(), { once: true });
      a.click();
    });
    await expect(page.locator('#detail-drawer')).not.toHaveClass(/open/);
  });

  test('opens above the map when a marker is clicked', async ({ page }) => {
    await page.goto('/#energy/map');
    await page.locator('.leaflet-interactive').first().click();

    const drawer = page.locator('#detail-drawer');
    await expect(drawer).toHaveClass(/open/);
    // Poll: the drawer slides in with a CSS transition, so hit-testing is
    // only meaningful once it has settled in place.
    await expect.poll(() => drawer.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return el.contains(topEl);
    })).toBe(true);
  });
});

test.describe('food mode', () => {
  test('clear button resets all filters exactly once', async ({ page }) => {
    await page.goto('/#food/events');
    await page.fill('#food-filter-search', 'wheat');
    await page.selectOption('#food-filter-severity', 'high');
    await page.click('#food-filter-clear');
    await expect(page.locator('#food-filter-search')).toHaveValue('');
    await expect(page.locator('#food-filter-severity')).toHaveValue('');
  });

  test('header timestamp updates when landing directly in food mode', async ({ page }) => {
    await page.goto('/#food/overview');
    await expect(page.locator('#header-ts-short')).toHaveText(/^Updated \d{2}:\d{2}$/);
  });

  test('wheat chart follows the theme toggle', async ({ page }) => {
    await page.goto('/#food/overview');
    const tickColor = () => page.evaluate(() =>
      Chart.getChart(document.getElementById('wheat-chart')).options.scales.x.ticks.color
    );
    const before = await tickColor();
    await page.click('#theme-toggle');
    expect(await tickColor()).not.toEqual(before);
  });
});

test.describe('mode tabs accessibility', () => {
  test('tabs expose role and aria-selected, updated on switch', async ({ page }) => {
    await page.goto('/#energy/overview');
    const energyTab = page.locator('button[data-mode="energy"]');
    const foodTab = page.locator('button[data-mode="food"]');
    await expect(energyTab).toHaveAttribute('role', 'tab');
    await expect(energyTab).toHaveAttribute('aria-selected', 'true');
    await expect(foodTab).toHaveAttribute('aria-selected', 'false');

    await foodTab.click();
    await expect(foodTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('button[data-mode="energy"]')).toHaveAttribute('aria-selected', 'false');
  });
});
