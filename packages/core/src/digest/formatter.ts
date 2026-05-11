import type { DigestPayload, DigestRow } from './types';

const fmtAud = (price: number): string => `A$${price.toFixed(2)}`;

const fmtDate = (iso: string): string => {
    // Render in en-AU because the user is AU-based and the rest of the codebase
    // formats dates this way (see formatter.ts in notifications/).
    return new Date(iso).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

/**
 * Order rows by largest current discount first so the most actionable items
 * are at the top of the digest. Rows with no comparison data fall to the
 * bottom in their own group.
 */
const sortRows = (rows: DigestRow[]): DigestRow[] => {
    const ranked = [...rows];
    ranked.sort((a, b) => {
        const aPct = a.percentageDecrease;
        const bPct = b.percentageDecrease;
        if (aPct === null && bPct === null) return a.name.localeCompare(b.name);
        if (aPct === null) return 1;
        if (bPct === null) return -1;
        return bPct - aPct;
    });
    return ranked;
};

const renderRow = (r: DigestRow): string => {
    // No price data at all — typically a brand-new product that hasn't been
    // checked yet, or every URL has failed since adding.
    if (r.currentLowest === null) {
        const tail = r.urlCount === 0 ? 'no URLs yet' : 'no price data';
        return `• *${r.name}* — ${tail}`;
    }

    const retailerTail = r.currentLowestRetailer ? ` at ${r.currentLowestRetailer}` : '';
    const stockTail = r.anyInStock === false ? ' — out of stock' : '';

    if (r.initialPrice === null || r.percentageDecrease === null) {
        return `• *${r.name}* — ${fmtAud(r.currentLowest)}${retailerTail}${stockTail}`;
    }

    // Positive percentageDecrease = current is below initial; negative = above.
    let movement: string;
    if (r.percentageDecrease > 0) {
        movement = ` (↓${r.percentageDecrease.toFixed(1)}% from ${fmtAud(r.initialPrice)})`;
    } else if (r.percentageDecrease < 0) {
        movement = ` (↑${Math.abs(r.percentageDecrease).toFixed(1)}% from ${fmtAud(r.initialPrice)})`;
    } else {
        movement = ' (no change)';
    }

    return `• *${r.name}* — ${fmtAud(r.currentLowest)}${retailerTail}${movement}${stockTail}`;
};

export const formatDigest = (payload: DigestPayload): string => {
    const { generatedAt, rows } = payload;
    const lines: string[] = [];
    lines.push(`*Spawncamper digest — ${fmtDate(generatedAt)}*`);
    lines.push('');

    if (rows.length === 0) {
        lines.push('No active products.');
        return lines.join('\n');
    }

    const count = rows.length;
    lines.push(`${count} active product${count === 1 ? '' : 's'}:`);
    lines.push('');

    for (const row of sortRows(rows)) {
        lines.push(renderRow(row));
    }

    return lines.join('\n');
};
