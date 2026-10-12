# Review: error types and severity

Based on the MQM (Multidimensional Quality Metrics) typology, cut down to what product text needs. Mark each
error on the string it is in.

| Category | Subtypes | Example |
|---|---|---|
| Accuracy | mistranslation, omission, addition, untranslated | "rest timer" as "остаток времени" |
| Fluency | grammar, spelling, unnatural (calque), inconsistency within the string | "Знайте, что поднимать" |
| Terminology | not the glossary term, two terms for one concept | routine as "программа" here and "тренировка" there |
| Style | register or form of address unlike the product, tone unlike the brief, wordy | "вы" in a "ты" product; marketing hype |
| Locale conventions | punctuation, quotes, spacing, numbers, dates, capitalization | "Hello : world" spacing in fr, Title Case in ru |
| Design | does not fit, breaks a line badly, wrong plural form | (stitch2 check finds most) |

Severity:

- **critical**: says something false or harmful (wrong price, wrong action on a button, legal or medical
  mistake), or unreadable.
- **major**: a reader notices: unnatural, wrong term, wrong tone, meaning shifted.
- **minor**: a careful reader notices: punctuation, a slightly better word exists.

Output, one line per error, then a verdict:

```
<key>  <locale>  "<text>"  <category>/<subtype>  <severity>  <why, and the fix>
verdict: <locale> n critical, n major, n minor
```

A language ships when its last pass has no critical or major errors.

