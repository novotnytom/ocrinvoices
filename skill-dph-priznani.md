# Skill: Czech VAT Return Confirmation to FlexiBee Internal Document Converter

Use this skill when the user needs to convert Czech VAT return confirmation/work files (`.xml` or signed `.p7s`) into ABRA FlexiBee-compatible internal document XML files (`interni-doklad`). The original workflow is for DPH IO, meaning VAT return for an identified person.

## Goal

Convert one or more Czech DPH input files into a ZIP containing:

- One combined XML file with all generated internal documents and attachments.
- One separate XML file per generated internal document.

All XML outputs use:

```xml
<winstrom version="1.0">
  <interni-doklad>...</interni-doklad>
</winstrom>
```

## Accepted Inputs

Accept:

- `.xml` files containing an outer XML document with a `<Data>` element.
- `.p7s` signed files containing the same XML payload after signature verification/decoding.

For `.xml` input:

- Decode file bytes as UTF-8.

For `.p7s` input:

- Verify/decode the PKCS#7 signature container using OpenSSL equivalent behavior:
  - `openssl smime -verify -inform DER -noverify`
- If verification/decoding fails, skip the file.

Skip files that cannot be read, decoded, parsed, or converted.

## Input XML Structure

The input is expected to be an outer XML file with:

```xml
<Data>HEX_ENCODED_INNER_XML</Data>
```

Processing steps:

1. Parse the outer XML.
2. Find the first `.//Data` element.
3. Read its text.
4. Treat the text as hexadecimal data.
5. Decode from hex to UTF-8 XML text.
6. Parse the decoded inner XML.

If there is no `<Data>` element or it is empty, skip the file.

## VAT Documents Read

Inside the decoded inner XML, process every:

```xml
<DPHDP3>
```

For each `DPHDP3`, read:

- `VetaD`
- `VetaP`
- `Veta6`

Required attributes and fallback values:

- `VetaD/@rok`, fallback `2024`
- `VetaD/@mesic`, fallback `01`, left-padded to two digits
- `VetaD/@d_poddp`, fallback `1.1.2024`, parse as `D.M.YYYY`
- `VetaP/@dic`, fallback `123456`
- `Veta6/@dan_zocelk`, fallback `0`

The submission date `d_poddp` is converted to ISO `YYYY-MM-DD`.

## Generated Internal Document

For each `DPHDP3`, generate one:

```xml
<interni-doklad>
```

With these fields:

```xml
<firma>code:FÚ KRÁLOVÉHRADECKÝ</firma>
<typDokl>code:INT. DOKLAD</typDokl>
<datVyst>YYYY-MM-DD</datVyst>
<cisDosle>DPHYYYYMM</cisDosle>
<varSym>DIC</varSym>
<typUcOp>code:DPH IO</typUcOp>
<popis>Přiznání k dani z přidané hodnoty (MM/YYYY)</popis>
```

Where:

- `YYYY` = `rok`
- `MM` = two-digit `mesic`
- `DIC` = `dic`
- `YYYY-MM-DD` = parsed submission date

## Internal Document Item

Each internal document contains one accounting item:

```xml
<polozkyIntDokladu>
  <interni-doklad-polozka>
    <typPolozkyK>typPolozky.ucetni</typPolozkyK>
    <nazev>Přiznání k DPH (identifikovaná osoba) (MM/YYYY)</nazev>
    <sumOsv>CASTKA</sumOsv>
    <sumCelkem>CASTKA</sumCelkem>
  </interni-doklad-polozka>
</polozkyIntDokladu>
```

Where `CASTKA` is `Veta6/@dan_zocelk`.

## Attachments

The combined XML and the separate XML files include attachments in each `interni-doklad`.

Create:

```xml
<prilohy>
  <priloha>...</priloha>
</prilohy>
```

### Original P7S Attachment

If the source file was `.p7s`, attach the original raw `.p7s` bytes:

- `nazSoub`: original filename
- `contentType`: `application/pkcs7-signature`
- `content encoding="base64"`: base64 of the original `.p7s` bytes

### Decoded XML Attachment

Attach the decoded inner XML string:

- `nazSoub`: original filename with `.p7s` replaced by `.decoded.xml`
- `contentType`: `application/xml`
- `content encoding="base64"`: base64 of the decoded XML string in UTF-8

For non-`.p7s` filenames, preserve the original converter behavior: replacing `.p7s` has no effect, so the decoded XML attachment name may equal the original filename.

### Embedded General Attachments

For every `.//ObecnaPriloha` in the decoded inner XML:

- Filename comes from `jm_souboru`, fallback `priloha.pdf`.
- Attachment data is the element text.
- Encoding comes from `kodovani`.

Decode attachment binary:

- If `kodovani` lowercased is `base64`, decode as base64.
- Otherwise decode as hex.

Then re-encode the binary as base64 for FlexiBee.

Set:

- `nazSoub`: attachment filename
- `contentType`: `application/EXT`, where `EXT` is the lowercase file extension without dot
- If there is no extension, use `application/octet-stream`.
- `content encoding="base64"`: base64 of decoded binary

Skip malformed attachments that cannot be decoded.

## Sorting

Collect all generated internal documents across all input files and sort them ascending by:

1. Submission date
2. Year
3. Month

## Output ZIP

Always return a ZIP.

If at least one document was generated, calculate:

- `min_date` = earliest submission date
- `max_date` = latest submission date
- `prefix` = `min_date_to_max_date__`

If no documents were generated, `prefix` is empty.

The combined XML filename is:

```text
PREFIXinterni_doklady_with_attachments.xml
```

The ZIP filename is:

```text
PREFIXconverted_dph.zip
```

Examples:

```text
2024-01-25_to_2024-03-25__interni_doklady_with_attachments.xml
2024-01-25_to_2024-03-25__converted_dph.zip
```

## Separate XML Files

For each generated document, also write one separate XML file into the ZIP:

```text
DPH(MM)-YYYY_YYYY-MM-DD__interni-doklad.xml
```

Each separate XML file contains only:

```xml
<winstrom version="1.0">
  <interni-doklad>...</interni-doklad>
</winstrom>
```

## Agent Behavior

When using this skill:

1. Preserve the fixed FlexiBee codes and Czech labels exactly.
2. Skip invalid files and malformed attachments instead of failing the whole batch.
3. Keep attachments in the generated documents.
4. Do not generate invoices; this converter creates `interni-doklad`.
5. Treat this as DPH IO unless the user explicitly asks to adapt it for another VAT workflow.
