# ST/SPD personnel update — 9 November 2026

Production Apps Script deployment: version 46. Release workflow: https://github.com/fathonydnm-byte/sistem-penomoran-otomatis/actions/runs/42534242361 (successful).

## Behavior
- Personnel NIP/NIPPPK is optional text: blank, dash, short identifiers and leading zeroes are preserved. Signatory validation for Surat Dinas is unchanged.
- Search reads Master_Pegawai from the owner-specified master workbook on every search. No persistent cache; minimum two characters, 500 ms debounce, maximum 20 results with a refinement prompt.
- Reads only columns A:B and D:E (identifier, name, rank, title); NPWP and other personnel columns are not returned. Header schema changes fail visibly with manual entry still available.
- Selection fills four editable fields. Late search results cannot overwrite a newer query or removed row. Changing a selected name clears unchanged autofilled details to prevent stale identity association.
- Personnel text limit increased to 300 characters to accept official titles (observed maximum title length 183).
- One or multiple personnel now use the same five-column table. Widths in points: 32.25, 118.5, 128.25, 59.25, 126.75. Arial 11, bold centered header, left/top body, 5 pt cell padding.
- Generator source template 1M98l4arqCH0shNL_DEyrASMIGYkrRBvKAJWR7qk563s updated to the same table structure. Surrounding paragraph formatting preserved. Existing generated documents are not migrated.

## Verification
- All nine regression suites passed, both local checks and production CI.
- New assertions cover blank/dash/short identifiers, leading zeroes, multiword case-insensitive search, fresh master changes, missing matches, result cap, allowed returned fields, and long titles.
- Staging browser: partial-name search selected an actual master employee and populated all fields; a second manual employee with dash NIP generated successfully. Table inspected visually in Google Docs.
- Staging browser: replacing a selected employee name cleared the old autofilled identifier.
- Production browser: one-person draft with dash NIP generated successfully on v46; native Docs readback verified two rows, five columns and exact widths. No live number was requested or consumed.
- Source-template PDF exported and visually inspected after final formatting; Google Docs output inspected after the template update.
- Final production smoke document: https://docs.google.com/document/d/1LySxDFw1CcLJ0Qp2CUySsMb7RImJF9bs4iZWhXsLGGc/edit
- Screenshot personnel-live-proof.png records the first production smoke result; the final source-template adjustment restored spacing around the table.

This focused update did not rerun the prior 5/10-user numbering load test; allocation/locking logic was not changed. Previous concurrency evidence remains documented in AUDIT-GENERATOR-2026-11-08.md.
