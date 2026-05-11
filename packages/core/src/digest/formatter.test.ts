import { describe, expect, it } from 'vitest';
import { formatDigest } from './formatter';
import type { DigestPayload, DigestRow } from './types';

const row = (overrides: Partial<DigestRow> = {}): DigestRow => ({
    productId: 1,
    name: 'Test Product',
    currentLowest: 100,
    currentLowestRetailer: 'Amazon',
    initialPrice: 100,
    percentageDecrease: 0,
    anyInStock: true,
    urlCount: 1,
    ...overrides,
});

const payload = (rows: DigestRow[]): DigestPayload => ({
    generatedAt: '2026-05-11T08:00:00Z',
    rows,
});

describe('formatDigest', () => {
    it('renders the empty-list header without a product block', () => {
        const text = formatDigest(payload([]));
        expect(text).toContain('Spawncamper digest');
        expect(text).toContain('No active products.');
        expect(text).not.toContain('•');
    });

    it('singularises the count header for one product', () => {
        const text = formatDigest(payload([row({ name: 'Solo' })]));
        expect(text).toContain('1 active product:');
        expect(text).not.toContain('1 active products');
    });

    it('renders a price drop with downward arrow and initial anchor', () => {
        const text = formatDigest(
            payload([row({ name: 'PS5', currentLowest: 600, initialPrice: 800, percentageDecrease: 25 })]),
        );
        expect(text).toContain('*PS5* — A$600.00 at Amazon (↓25.0% from A$800.00)');
    });

    it('renders an increase with upward arrow', () => {
        const text = formatDigest(
            payload([row({ name: 'Gas', currentLowest: 110, initialPrice: 100, percentageDecrease: -10 })]),
        );
        expect(text).toContain('*Gas* — A$110.00 at Amazon (↑10.0% from A$100.00)');
    });

    it('renders no-change explicitly', () => {
        const text = formatDigest(
            payload([row({ name: 'Stable', currentLowest: 50, initialPrice: 50, percentageDecrease: 0 })]),
        );
        expect(text).toContain('*Stable* — A$50.00 at Amazon (no change)');
    });

    it('omits the comparison when initial price is missing', () => {
        const text = formatDigest(
            payload([row({ name: 'New', currentLowest: 75, initialPrice: null, percentageDecrease: null })]),
        );
        expect(text).toContain('*New* — A$75.00 at Amazon');
        expect(text).not.toContain('from A$');
        expect(text).not.toContain('(no change)');
    });

    it('marks rows with no current price', () => {
        const text = formatDigest(
            payload([row({ name: 'Broken', currentLowest: null, currentLowestRetailer: null, initialPrice: null, percentageDecrease: null, urlCount: 2 })]),
        );
        expect(text).toContain('*Broken* — no price data');
    });

    it('marks rows with no URLs distinctly from missing price data', () => {
        const text = formatDigest(
            payload([row({ name: 'Naked', currentLowest: null, currentLowestRetailer: null, initialPrice: null, percentageDecrease: null, urlCount: 0 })]),
        );
        expect(text).toContain('*Naked* — no URLs yet');
    });

    it('flags out-of-stock at the end of the line, after the movement', () => {
        const text = formatDigest(
            payload([
                row({ name: 'Gone', currentLowest: 200, initialPrice: 250, percentageDecrease: 20, anyInStock: false }),
            ]),
        );
        // Movement should appear before the OOS tail.
        const line = text.split('\n').find((l) => l.includes('Gone'))!;
        expect(line.indexOf('(↓20.0% from A$250.00)')).toBeLessThan(line.indexOf('out of stock'));
    });

    it('sorts biggest discount first, no-data rows last, alphabetical within no-data', () => {
        const rows = [
            row({ productId: 1, name: 'B-small-drop', percentageDecrease: 5 }),
            row({ productId: 2, name: 'A-big-drop', percentageDecrease: 50 }),
            row({ productId: 3, name: 'D-no-data', currentLowest: null, percentageDecrease: null }),
            row({ productId: 4, name: 'C-no-data', currentLowest: null, percentageDecrease: null }),
            row({ productId: 5, name: 'E-up', percentageDecrease: -10 }),
        ];

        const text = formatDigest(payload(rows));
        const lines = text.split('\n').filter((l) => l.startsWith('•'));
        expect(lines[0]).toContain('A-big-drop');
        expect(lines[1]).toContain('B-small-drop');
        expect(lines[2]).toContain('E-up');
        expect(lines[3]).toContain('C-no-data');
        expect(lines[4]).toContain('D-no-data');
    });
});
