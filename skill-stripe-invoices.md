# Skill: Stripe Paid Invoices to FlexiBee XML Converter

Use this skill when the user needs to convert Stripe paid invoice CSV exports into ABRA FlexiBee-compatible XML containing issued invoices (`faktura-vydana`). This skill is for Stripe invoice exports only. Do not use it for Stripe bank/balance transaction exports.

## Goal

Convert one or more Stripe invoice CSV files into one XML document:

```xml
<winstrom version="1.0">
  <faktura-vydana>...</faktura-vydana>
</winstrom>
```

Each valid Stripe invoice row becomes one `faktura-vydana` element.

## Required Input

Accept one or more `.csv` files exported from Stripe Invoices, typically the paid invoices export.

Read CSV files as UTF-8 with BOM tolerance (`utf-8-sig` behavior).

If no valid `.csv` files are provided, stop and report that no valid CSV files were found.

## Required Stripe CSV Columns

Each row must contain all of these columns:

- `id`
- `Number`
- `Date (UTC)`
- `Amount Due`
- `Currency`
- `Status`
- `Charge`
- `Customer`
- `Customer Email`
- `Customer Address Country`
- `Finalized At (UTC)`

Rows missing any required column are skipped.

The existing converter does not use `Tax Filing Amount`, `Tax Filing Currency`, VAT tagging, exchange rates, or line-item detail. Do not invent those behaviors unless the user explicitly asks for a redesigned converter.

## Date Handling

For each invoice row:

- Read `Date (UTC)`.
- Use the first whitespace-separated part as the date.
- Parse it as `YYYY-MM-DD`.
- Use that same ISO date for both `datVyst` and `datSplat`.

Skip rows with unparseable invoice dates.

Sort valid invoice rows by invoice date ascending before generating XML.

## Invoice Number and Variable Symbol

For each row:

- `cisDosle` = Stripe `Number`.
- `varSym` = Stripe `Number` with all non-digits removed.
- `kod` = `FP-D2C_XXXXXX/23`, where `XXXXXX` is a six-digit sequential counter starting at `000001`.
- `id` = `ext:STRIPE-D2C-InvCreate:N`, where `N` is the same sequential invoice counter starting at `1`.

The `/23` suffix is fixed in the original converter. Preserve it unless the user asks to parameterize the year.

## Payment Method

Determine payment method from the `Charge` column:

- If `Charge` is non-empty:
  - Payment method text: `Platební brána Stripe (karta)`
  - `formaUhradyCis`: `code:KARTA`
- If `Charge` is empty:
  - Payment method text: `PayPal`
  - `formaUhradyCis`: `code:PAYPAL`

## XML Field Mapping

For each valid invoice row, create:

```xml
<faktura-vydana>
  <id>ext:STRIPE-D2C-InvCreate:N</id>
  <cisDosle>...</cisDosle>
  <varSym>...</varSym>
  <kod>FP-D2C_XXXXXX/23</kod>
  <datVyst>YYYY-MM-DD</datVyst>
  <datSplat>YYYY-MM-DD</datSplat>
  <popis>DRIVE2.CITY Route Planner</popis>
  <poznamka>...</poznamka>
  <uvodTxt>...</uvodTxt>
  <zavTxt>...</zavTxt>
  <sumOsvMen>...</sumOsvMen>
  <nazFirmy>...</nazFirmy>
  <postovniShodna>true</postovniShodna>
  <bezPolozek>true</bezPolozek>
  <ucetni>true</ucetni>
  <zuctovano>true</zuctovano>
  <stitky></stitky>
  <typDokl>code:FAKTURA-PB</typDokl>
  <mena>code:EUR</mena>
  <stat>code:COUNTRY</stat>
  <formaUhradyCis>code:KARTA_OR_PAYPAL</formaUhradyCis>
  <typUcOp>code:TRŽBA SLUŽBY</typUcOp>
</faktura-vydana>
```

Use these exact values:

- `popis`: `DRIVE2.CITY Route Planner`
- `sumOsvMen`: Stripe `Amount Due`
- `nazFirmy`: Stripe `Customer Email`
- `postovniShodna`: `true`
- `bezPolozek`: `true`
- `ucetni`: `true`
- `zuctovano`: `true`
- `stitky`: empty string
- `typDokl`: `code:FAKTURA-PB`
- `mena`: `code:EUR`
- `stat`: `code:` + `Customer Address Country`
- `typUcOp`: `code:TRŽBA SLUŽBY`

Important: `mena` is hard-coded to `code:EUR` in the original converter, even though the CSV has a `Currency` column.

## Notes and Text Fields

Set `poznamka` exactly in this structure:

```text
Status Stripe: STATUS
Stripe číslo faktury došlé: NUMBER
```

Set `uvodTxt` exactly in this structure:

```text
Status Stripe: STATUS
Stripe číslo faktury došlé: NUMBER
Platební metoda: PAYMENT_METHOD_TEXT
Identifikace platby (Stripe Charge Id): CHARGE
```

Set `zavTxt`:

```text
FILENAME / CUSTOMER_EMAIL
```

Where `FILENAME` is the source CSV filename for that invoice row.

## Output Filename

If at least one invoice row was converted, name the XML file:

```text
YYYY-MM-DD_to_YYYY-MM-DD_drive2city_invoicesstripe.xml
```

Where the dates are the minimum and maximum parsed `Date (UTC)` dates.

If no valid rows were converted, use:

```text
drive2city_invoicesstripe.xml
```

## Agent Behavior

When using this skill:

1. Preserve the exact FlexiBee element names and fixed codes.
2. Skip invalid rows instead of failing the whole conversion.
3. Do not add bank transaction rows.
4. Do not add itemized invoice lines; the original converter uses `bezPolozek=true`.
5. Do not add VAT tagging, exchange-rate conversion, or tax logic unless explicitly requested as a new enhancement.
