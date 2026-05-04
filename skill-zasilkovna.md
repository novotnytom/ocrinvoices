# Skill: Zasilkovna COD CSV Converter

Use this skill when the user needs to convert Zasilkovna/Zásilkovna cash-on-delivery CSV exports into PayPal-like bank transaction CSV files for accounting import.

## Goal

Convert one or more Zasilkovna CSV files into normalized transaction CSV files. When multiple files are provided, produce one converted CSV per input file and package them into a ZIP.

The output represents individual COD collection rows as `charge` rows and adds a balancing `payout` row when the total net amount is positive.

## Required Input Format

Accept either:

- One or more `.csv` files, or
- A `.zip` containing one or more `.csv` files.

Input CSV requirements:

- Encoding should be read as UTF-8 with BOM tolerance (`utf-8-sig` behavior).
- Delimiter is semicolon `;`.
- The file must be Zasilkovna CSV format V7 or compatible.
- The first row is the header.
- The file must have at least 32 columns.
- At least one data row is required.

If a CSV does not meet these requirements, skip that file and report it as invalid.

## Expected Zasilkovna Header Context

The known V7 header order is:

```text
Váš e-shop;Datum vložení;Datum podání;Vyzvednutí či vrácení;Vaše obj. č.;Jméno;Příjmení;Čárový kód;Účtované služby;DPH %;Služby s DPH;Měna účtovaných služeb;Vybraná dobírka;Měna dobírky;SS;Poznámka;Stav;Hmotnost;Základní cena;Dobírka;Pojištění;Pod.mimo depo;Příplatek za vratku;Ostatní;Dopravné celkem bez DPH;Palivový příplatek;Mýtný příplatek;Platba kartou;Hodnota vybrané dobírky v místní měně;Měna vybrané dobírky;Cílová země;Dopravce;User note;External tracking code
```

The converter uses positional columns, matching the original implementation. Be careful about index positions if the header differs.

## Fields Used by Position

For each data row, use these zero-based positions:

- `row[3]`: date used as `Datum podání` in the original converter logic; parse as `YYYY-MM-DD`.
- `row[4]`: order/reference number, used as `Reference Txn ID`.
- `row[6]`: customer name/surname field, used as output `Name` and `Buyer ID`.
- `row[10]`: service fee, used as fee.
- `row[11]`: fee currency, used as output `Currency`.
- `row[12]`: collected COD amount, used as gross.
- `row[16]`: shipment/status, used as output `Status`.
- `row[30]`: target country, used as output `Country`.

Note: The original code labels some frontend-highlighted fields differently than the positional implementation. Preserve the positional behavior above unless intentionally redesigning the converter.

## Date Handling

For each input file:

- Extract the file date from the first data row at `row[3]`.
- Parse it as `YYYY-MM-DD`.
- Use `unknown` if it cannot be parsed.

For each transaction row:

- Parse `row[3]` as `YYYY-MM-DD`.
- Output date format is `MM/DD/YYYY`.
- Output time is always `00:00`.
- Output timezone is always `GMT+02:00`.

Skip individual rows whose required date or numeric fields cannot be parsed.

## Amount Handling

Parse numeric fields by:

- Replacing comma decimals with dot decimals.
- Removing spaces.
- Converting to number.
- Rounding to two decimals.

Per row:

- `gross` = parsed `row[12]`.
- `fee` = parsed `row[10]`.
- `fee_minus` = negative fee.
- `net` = `gross - fee` when `gross > 0`, otherwise `-fee`.

If `gross <= 0`:

- Set `gross = net`.
- Set `fee_minus = 0.0`.

Accumulate:

- `total_fee += fee`
- `total_net += net`

Format decimal output with exactly two decimals and a decimal comma, for example `123,45`.

## Output CSV Columns

Each converted CSV must use comma delimiters and this exact header order:

```csv
Date,Time,TimeZone,Name,Type,Status,Currency,Gross,Fee,Net,From Email Address,To Email Address,Transaction ID,CounterParty Status,Address Status,Item Title,Item ID,Shipping and Handling Amount,Insurance Amount,Sales Tax,Option 1 Name,Option 1 Value,Option 2 Name,Option 2 Value,Auction Site,Buyer ID,Item URL,Closing Date,Escrow Id,Reference Txn ID,Invoice Number,Custom Number,Receipt ID,Balance,Address Line 1,Address Line 2/District/Neighborhood,Town/City,State/Province/Region/County/Territory/Prefecture/Republic,Zip/Postal Code,Country,Contact Phone Number
```

## Charge Row Mapping

For each valid input data row, emit one `charge` row:

- `Date`: parsed `row[3]` as `MM/DD/YYYY`.
- `Time`: `00:00`.
- `TimeZone`: `GMT+02:00`.
- `Name`: `row[6]`.
- `Type`: `charge`.
- `Status`: `row[16]`.
- `Currency`: `row[11]`.
- `Gross`: formatted `gross`.
- `Fee`: formatted `fee_minus`.
- `Net`: formatted `net`.
- `Transaction ID`: reference ID derived from the input filename without extension.
- `Buyer ID`: `row[6]`.
- `Closing Date`: same as `Date`.
- `Reference Txn ID`: `row[4]`.
- `Country`: `row[30]`.
- All other output columns are empty.

## Payout Row

After processing all rows in one input file, if `total_net > 0`, append one payout row:

- Date is the extracted file date as `MM/DD/YYYY`.
- `Time`: `00:00`.
- `TimeZone`: `GMT+02:00`.
- `Name`: `Zasilkovna.cz`.
- `Type`: `payout`.
- `Status`: `vyplaceno`.
- `Currency`: `CZK`.
- `Gross`: `-total_net`, formatted with decimal comma.
- `Fee`: `0`.
- `Net`: `-total_net`, formatted with decimal comma.
- `Transaction ID`: reference ID derived from the input filename without extension.
- `Buyer ID`: use the last successfully processed row's `row[6]` value, matching the original converter behavior.
- `Closing Date`: same payout date.
- `Reference Txn ID`: reference ID.
- `Country`: `CZ`.
- All other output columns are empty.

If the extracted file date is `unknown`, do not append a payout row unless a valid date is available for it.

## Output Filenames

For each converted input CSV:

```text
YYYY-MM-DD__REFERENCE_ID.dobirky@zasilkovna.cz.csv
```

Where:

- `YYYY-MM-DD` is the extracted file date from the first data row, or `unknown`.
- `REFERENCE_ID` is the original filename without extension.

When returning multiple converted files as a ZIP, name the ZIP from the min and max extracted valid dates:

```text
YYYY-MM-DD_to_YYYY-MM-DD_dobirky@zasilkovna.zip
```

If no valid dates are available, use:

```text
dobirky@zasilkovna.zip
```

## Agent Behavior

When using this skill:

1. Preserve the positional mapping exactly unless the user explicitly asks to adapt to a different Zasilkovna export.
2. Skip malformed rows instead of failing the whole file.
3. Keep the PayPal-like output header order exact.
4. Emit one converted CSV per input CSV.
5. Use ZIP packaging when more than one converted CSV is produced or when the surrounding workflow expects ZIP output.
