---
name: stitch2-translate
description: Translate a product's screens and landing pages by meaning, as a native writer of each language would put it, not word for word — with a glossary taken from the product, the language's own conventions, a review pass that marks errors by type and severity, and a check in context. Use when adding or updating translations, when a language reads like a translation (calques, wrong terms, odd tone), when the user complains about a language, or after stitch2-copy changes the source.
---

# Translating with stitch2

A good translation says what the source *means* and has the effect it is meant to have, in words a native
speaker would choose. "Avoid literal translation at all costs" (Mozilla's localization style guide). For product
UI that means the product's own terms, every time; for marketing it means transcreation: the headline may change
its words entirely to keep its point.

Machine and model translation in one pass is fluent but literal. It does better when it prepares like a human
translator does and then revises against named errors: preparing keywords, topic and examples first (MAPS, He et
al. 2023, arXiv:2305.04118), translating, then estimating errors and refining (TEaR, Feng et al. 2024,
arXiv:2402.16379), with errors marked by MQM type and severity (GEMBA-MQM, Kocmi & Federmann 2023,
arXiv:2310.13988), and with separate roles for translator, localizer and reviewer (TransAgents, Wu et al. 2024,
arXiv:2405.11804). This skill is that process.

## 0. Before translating

- **The source is good.** If the source is vague or full of idioms, fix it first (stitch2-copy): a translation
  cannot be better than what it says.
- **The brief** (design/COPY.md): reader, promise, voice, section intents. Every string is translated knowing
  what it is for.

## 1. Prepare, per language

1. **Glossary from the product.** Before writing a word, read how the app already says the core concepts in this
   language (the locale's messages: set, rep, rest, workout, routine, program, history…; search the message files
   for the source terms). Write them into design/COPY.md under the language. The landing page uses the app's
   words; when the app's own terms collide (one word for two concepts), fix the collision in the app first and
   note the decision.
2. **Language conventions** (references/locales.md): form of address used by the app (detect it from existing
   strings: *du*/*Sie*, *tu*/*vous*, *ты*/*вы*), quotation marks, spaces before punctuation, dashes, number
   formatting, capitalization.
3. **Context per string.** Where it appears (hero title, button, chip, checklist item), how much room it has
   (`stitch2 i18n <screen> --json` lists keys per screen; the renders show the space), and the intent from the
   brief.

## 2. Draft as a native writer

- Read the whole section in the source first; translate the section, not string by string.
- Ask, as Mozilla's guide does: what does this mean, what is the author trying to say, how would I say that in my
  language? Then write it the way a good local fitness, finance or tech site (whatever the product is) would.
- Headlines and slogans: transcreate. Keep the point and the length class (short stays short), drop the source's
  wording when it does not work. Write two or three options and keep the best.
- UI strings: the glossary term, the language's usual verb for the action ("Войти", "Anmelden"), the same form of
  address everywhere.
- Keep placeholders, plural categories (CLDR) and markup slots; never concatenate.
- Units, numbers and dates come from the locale; product names, brands and code stay as written.

## 3. Review: mark errors, then fix

Review as a **separate pass**, ideally a separate agent that sees the source, the draft, the glossary and the
conventions, but not the drafter's reasoning. Mark every problem with an MQM category and severity
(references/review.md), for example:

```
site.hero.title  ru  "Знайте, что поднимать."  fluency/unnatural (calque of "Know what to lift")  major
```

The questions that catch most errors:

- Would a native copywriter ever write this sentence? If it only makes sense to someone who knows the English, it
  is a calque.
- Does it say exactly what the source means, nothing added, nothing lost?
- Is every product concept the glossary term? Is the form of address the app's?
- Punctuation, quotes, spaces and numbers as the language writes them?

Fix every critical and major error and review again, until a pass finds none. A back-translation can confirm the
meaning; it is never a target for style.

## 4. In context

1. `stitch2 check <screen> --locales <l> --shots`: nothing cut, wrapped badly or overlapping (stitch2-i18n has the
   fixes, in order).
2. Read the render top to bottom in the language. Headlines that broke onto an orphan word, a term that changed
   between two sections, a tone that changed: fix in the messages.

## 5. Hand over

Say which languages you reviewed in context, the terminology decisions (with the collisions you fixed), and which
strings deserve a native speaker's read before a launch: headlines and anything legal. Be honest about the
languages you are less sure of.

## References

- references/locales.md: conventions per language.
- references/review.md: the error types and severities, and the review output.

