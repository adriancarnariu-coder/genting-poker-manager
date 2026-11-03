# Genting Poker Manager

A responsive, browser-local workspace for importing Cardroom Magic Excel reports and preparing an accurate internal Day 2 leaderboard. Black, red and white UI; no external runtime services or API integrations.

## Run

Install Node.js 22 or later. All runtime dependencies are vendored; no `npm install` is required.

```sh
npm start
```

Open http://localhost:3000. `HOST` defaults to `127.0.0.1`; `PORT` defaults to `3000`. Use a current browser with IndexedDB and Web Crypto. Serve over localhost or HTTPS; opening the HTML directly is unsupported.

## Test

```sh
npm test
```

The suite covers real BIFF8 `.xls` and OOXML `.xlsx` parsing, zero-padded IDs, strict chip counts, mapping, qualification separation, duplicate IDs, cross-source conflicts, verified nationality, publication permission, provenance, explicit exclusion, ranking ties, formula-safe CSV and existing tournament model behavior.

```sh
node tests/generate-samples.cjs
```

Regenerates four synthetic sample workbooks in `public/samples/`. Use **Explore sample tournament** to load them into a new tournament without replacing existing records. The sample deliberately includes a duplicate qualifier with conflicting chips/name, a missing name, an invalid stack and unknown permissions. Entry S010 has a large chip value to demonstrate that an entry never becomes a qualifier.

## Workflow

1. Create a tournament; add flights such as 1A, 1B and 1C.
2. Choose a flight and explicitly choose **Entries**, **Re-Entries** or **Qualified Players** before uploading. Sheet names and chip values never determine qualification.
3. A progress dialog opens as soon as you select a file. Excel parsing runs in a dedicated worker so the page stays responsive; unreadable files show a visible error dialog. Select the worksheet and header row. Confirm the suggested column mapping. ID and name columns are required; qualified uploads also require a chip column. A missing value in an individual row is retained and flagged. Ambiguous headers require manual selection.
4. Click **Import mapped rows** to save the selected worksheet. A confirmation reports the imported count, selects the imported category and clears table filters so the new rows are visible. All other sheets and original bytes remain archived; import additional sheets separately with their proper category.
5. Review the table sorted by chips descending. Search by name or ID, filter by flight or show only blocking issues. Use **Review** to edit fields and record a reason. Excluding an erroneous/duplicate record requires a reason and keeps it in **Excluded records**. There is no player deletion or automatic merge.
6. Resolve blocking issues on every active qualified row before exporting the **internal** CSV. Equal chip counts share ranks. Export ignores view filters and includes all active qualified records, permission status and verified nationality only. It is an internal operations file, not permission to publish names.
7. Use **Review source**, **Download original** and **Download backup** for review and retention. Backups include all extracted rows, correction history, mappings and original workbook bytes in Base64. JSON backup restoration is not implemented in this version; originals can be downloaded separately and re-imported.

## Validation rules

- Missing IDs/names, nonpositive or invalid qualified chips, unknown flights and a flight that conflicts with the upload assignment block export.
- Chips accept positive safe whole numbers, with optional consistently grouped comma/space thousands separators. Ambiguous decimal notation, negatives, zero, exponents and unsafe integers require review.
- IDs are compared case-insensitively after trimming; leading zeros are retained as displayed by Excel. Already-rounded numeric IDs cannot be reconstructed. Names and raw data are never guessed.
- Duplicate qualified IDs block export even when their stacks match. Matching IDs in Entries/Re-Entries are visibly flagged as cross-source matches without treating legitimate entry history as additional qualifiers.
- Conflicting nonempty names, explicit publication permissions or verified nationalities for the same ID block the affected qualifier. Conflicting qualified stacks are flagged separately. Review source evidence and correct or explicitly exclude the relevant record.
- Nationality is not inferred from a name, language or ID. It appears in the leaderboard only when the mapped verification field explicitly says yes/true/1/allowed/granted/y, or an operator checks the verification box with a correction reason. Raw unverified nationality remains available in the validation table and original workbook.
- Permission is `yes`, `no` or `unknown`; blank/unrecognized text remains unknown. No missing permission is interpreted as consent.
- Every nonblank row after the chosen header is retained, including totals/footers, which can be explicitly excluded. Physical blank rows, all worksheets and formula expressions remain in the retained source. Formulas are not recalculated: review cached values and recalculate in Excel if necessary.

## Storage and limits

Original files and workspace data are stored together in IndexedDB in this browser and origin. Writes are atomic; revision checks reject stale writes from another tab. There is no server database, sign-in, synchronization or network upload of player records. Browser data clearing removes local records. Keep downloaded originals/backups separately. Earlier manual-entry `localStorage` data is preserved and never silently converted to qualified records; a notice identifies it when present.

Imports accept actual OLE `.xls` (BIFF8) and ZIP `.xlsx` workbooks, up to 15 MB, 50,000 worksheet rows and 256 columns. Renamed CSV/HTML, encrypted workbooks and other formats are unsupported. Column mapping accommodates report variations, but no real Cardroom Magic workbook was supplied for acceptance testing. Verify a representative export before operational use.

The Node server serves an explicit allowlist with a restrictive content security policy. The browser Excel parser is SheetJS CE 0.20.3, vendored from its official distribution; see `public/vendor/LICENSE.sheetjs` and `THIRD_PARTY.md`. No CDN dependency is loaded at runtime.

JPEG generation, seating, payouts, live tracking and external API integrations are intentionally outside this version.

## Static build

```sh
node build.mjs
```

Copies `public/` into `dist/` for static HTTPS hosting. The local server continues to serve `public/`. `.openai/hosting.json` records the private preview Site identity; no tournament data is committed or deployed.
