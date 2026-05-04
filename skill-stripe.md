# Skill: Stripe Bank Export Converter

Use this skill when the user needs to convert Stripe bank/payment exports into a PayPal-like bank transaction CSV for accounting import. This skill covers only Stripe bank statements and payment/balance movement exports. Do not use it for Stripe invoice exports, ISDOC, FlexiBee invoice XML, or issued invoice conversion.

## Goal

Convert two Stripe CSV exports:

- `unified_payments.csv`: successful payments export from Stripe Payments.
- `balance_history.csv`: balance activity/history export from Stripe Balance.

The output is a single CSV file with comma delimiters, PayPal-like transaction columns, decimal commas, and rows ordered from oldest to newest by Stripe balance `Created (UTC)`.

## Required Inputs

Accept either:

- Two separate `.csv` files, or
- A `.zip` containing the two CSV files.

Identify files by filename, case-insensitive:

- Filename containing `payments` is the payments file.
- Filename containing `balance` is the balance/history file.

Both files are required. If either is missing, stop and report that both `payments` and `balance` files are required.

Read CSV as UTF-8 with BOM tolerance (`utf-8-sig` behavior).

## Stripe Payments Fields Used

From `unified_payments.csv`, use these columns:

- `ID`: Stripe payment/charge identifier.
- `Status`: payment status.
- `Customer ID`: buyer/customer identifier.
- `Customer Email`: customer email.
- `Card Issue Country`: card country, if present.

Build a lookup map by `ID`.

## Stripe Balance Fields Used

From `balance_history.csv`, use these columns:

- `ID`
- `Type`
- `Source`
- `Amount`
- `Fee`
- `Net`
- `Currency`
- `Created (UTC)`

For each balance row:

- `Type` becomes output `Type`, lowercased and trimmed.
- Transaction ID is `Source` when present, otherwise `ID`.
- `Created (UTC)` must contain a date and time in the form `YYYY-MM-DD HH:MM...` or `YYYY-MM-DDTHH:MM...`.
- Output date format is `MM/DD/YYYY`.
- Output time format is `HH:MM`.
- TimeZone is always `GMT+02:00`.

Skip rows that do not have a parseable `Created (UTC)`.

## Enrichment Rule

Only enrich rows where:

- balance `Type` is `charge`, and
- the balance transaction ID exists in the payments lookup.

For enriched `charge` rows:

- Output `Name` = payment `Customer Email`.
- Output `Status` = payment `Status`.
- Output `Buyer ID` = payment `Customer ID`.
- Output `Country` = payment `Card Issue Country`.

For all other rows, leave these enriched fields empty unless the balance row itself supplies the standard fields below.

## Amount Formatting

Parse numeric values from Stripe by accepting either dot or comma decimal separators. Convert:

- `Amount` to output `Gross`.
- `Fee` to output `Fee`; if missing, use `0.0`.
- `Net` to output `Net`.

Format all three output values with exactly two decimals and a decimal comma, for example:

- `1234.5` -> `1234,50`
- `0` -> `0,00`
- `-12.34` -> `-12,34`

## Output CSV Columns

Write a comma-delimited CSV with this exact header order:

```csv
Date,Time,TimeZone,Name,Type,Status,Currency,Gross,Fee,Net,From Email Address,To Email Address,Transaction ID,CounterParty Status,Address Status,Item Title,Item ID,Shipping and Handling Amount,Insurance Amount,Sales Tax,Option 1 Name,Option 1 Value,Option 2 Name,Option 2 Value,Auction Site,Buyer ID,Item URL,Closing Date,Escrow Id,Reference Txn ID,Invoice Number,Custom Number,Receipt ID,Balance,Address Line 1,Address Line 2/District/Neighborhood,Town/City,State/Province/Region/County/Territory/Prefecture/Republic,Zip/Postal Code,Country,Contact Phone Number
```

## Output Row Mapping

For each sorted balance row, emit one row:

- `Date`: parsed `Created (UTC)` date as `MM/DD/YYYY`.
- `Time`: parsed `Created (UTC)` time as `HH:MM`.
- `TimeZone`: `GMT+02:00`.
- `Name`: customer email for enriched charge rows, otherwise empty.
- `Type`: lowercased balance `Type`.
- `Status`: payment status for enriched charge rows, otherwise empty.
- `Currency`: balance `Currency`.
- `Gross`: formatted balance `Amount`.
- `Fee`: formatted balance `Fee`.
- `Net`: formatted balance `Net`.
- `Transaction ID`: balance `Source` when present, otherwise balance `ID`.
- `Buyer ID`: payment `Customer ID` for enriched charge rows, otherwise empty.
- `Closing Date`: same as `Date`.
- `Country`: payment `Card Issue Country` for enriched charge rows, otherwise empty.
- All other output columns are empty.

## Sorting and Filename

Sort balance rows by `Created (UTC)` ascending before conversion.

Track the earliest and latest parsed dates. If at least one valid row was converted, name the output:

```text
YYYY-MM-DD_to_YYYY-MM-DD_drive2city.transactions@stripe.com.csv
```

If no valid dates were parsed, use:

```text
converted_stripe.csv
```

## Agent Behavior

When using this skill:

1. Validate that both Stripe exports are present.
2. Explain missing or malformed required files clearly.
3. Preserve the exact output column order.
4. Do not include Stripe invoice logic.
5. Do not invent invoice metadata, tax lines, or FlexiBee XML.
