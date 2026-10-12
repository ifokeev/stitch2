---
name: stitch2-copy
description: Write the words on screens and landing pages so they say what the product does for the reader, in plain language a translator can carry into any language. Use when writing or rewriting a screen's text, a landing page, onboarding, empty states or buttons, when the user says the copy is weak, generic, too technical or "not selling", and before translating (stitch2-translate starts from this source).
---

# Copy with stitch2

The words are part of the design. A screen can pass every layout check and still fail because its text is vague,
written for the wrong reader, or impossible to translate well. This skill writes the **source** text; translating
it is stitch2-translate.

## 1. The brief: design/COPY.md

Write it once per product, before the text, and keep it next to DESIGN.md. It is short:

- **Reader.** Who opens this page and what they want done today, in their words ("know what to lift and log it
  without fuss"), not in the product's ("a training management platform"). A page has one main reader; others
  (developers, self-hosters, partners) get their own section further down, written for them.
- **Promise.** One sentence: what the product does for that reader. Every headline on the page serves it.
- **Proof.** Real, specific facts that back the promise: numbers, names, what happens on screen. No round fake
  numbers.
- **Voice.** Three words for how it sounds, and what it is not ("calm, direct, practical; never hype, never
  slang").
- **Words.** The product's terms, one per concept, as the UI uses them (*set*, *routine*, *program*), and the words
  it never uses. stitch2-translate turns this into a glossary per language.
- **Section intents.** For a landing page, one line per section: what the reader should understand or do after
  it. The intent travels with the strings to the translators.

## 2. Writing rules

Sources: Google developer style guide (*Write for a global audience*), Nielsen Norman Group (people scan: 79% of
users scan, 16% read word by word), Mozilla's marketing style guides, Material and Apple writing guidance.

- **Lead with the reader's outcome**, then how the product gets there. "Know what to lift today" before "a
  progression engine".
- **Concrete beats clever.** Name the thing on the screen ("last time's weight sits next to every set") instead of
  an abstraction ("data-driven insights"). A headline should still make sense with the page's design removed.
- **One idea per sentence; short sentences.** They scan better and translate better.
- **Plain words.** *use*, not *leverage*; *start*, not *commence*. No idioms, puns, phrasal verbs or cultural
  references in the source: the translator has to rebuild them, and usually cannot.
- **Second person, active voice, present tense.** "You log a set", "gymgym fills in the weight".
- **Sentence case** for headings and buttons. A button is a verb and its object ("Start training", "Send
  answers").
- **No hype.** Not *seamless, powerful, ultimate, revolutionary, effortless, journey, unlock, supercharge*; no
  exclamation marks. Proof replaces adjectives.
- **Technical words only for the reader who uses them.** Licences, hosting, protocols and stack belong in the
  section for developers, and even there say what they mean for the reader ("your data stays in your database")
  before naming the technology.
- **Write for translation.** Keep each sentence whole in one string (never split a sentence across keys or build
  it by concatenation); use placeholders for numbers and names, with plural forms; avoid words with two meanings
  in context (*set* the noun vs the verb). See stitch2-i18n for keys and placeholders.

### A landing page

- **Hero**: an eyebrow (what it is, or its strongest fact), a title of up to about eight words with the outcome,
  a lead of one or two sentences with how and why to trust it, one primary action and at most one secondary.
- **Sections**: eyebrow = the topic (one or two words); title = the benefit; lead = how it works, in product
  terms. Feature cards: title = what the reader gets, text = what happens on screen.
- **Lists** (checklists, "also included"): parallel grammar, each item a short claim the reader can check.
- **Calls to action** repeat the same verb for the same action across the page.

### In the product

Labels are nouns, buttons are verbs, hints say what happens next, empty states say what this place is for and
offer the first action, errors say what happened and what to do. Reuse the app's existing words before inventing
new ones.

## 3. Process

1. Write or update the brief.
2. **Read the strings in order.** `stitch2 i18n <screen> --json` lists a screen's keys; read the source text top
   to bottom as one story, without the design. Mark every sentence that is vague, technical for the reader,
   repeats another, or would not survive translation.
3. Rewrite in the source messages (the app's files: one copy of every string). Keep keys whose meaning stays;
   a string whose meaning changes gets its new text under the same key only if every place that uses it wants
   the new meaning.
4. Self-review with the checklist below, then `stitch2 check <screen> --shots` for fit.
5. **Cold read.** Give a fresh agent only the page's strings (no brief, no design) and ask: what is this product,
   who is it for, what would you do next? If the answer misses the promise, the page does not say it yet. A
   `stitch2 sandbox` folder keeps the fresh agent from seeing your reasoning.
6. Then translate with stitch2-translate: the brief's section intents are its context.

## Checklist

- [ ] The hero says what the product does for the main reader, in their words.
- [ ] Every section title is a benefit; every lead says how, concretely.
- [ ] No hype words, no exclamation marks, no idioms or puns.
- [ ] Technical terms only in the section for the readers who use them.
- [ ] One term per concept, the same as the UI.
- [ ] Sentences short, whole in one string, with placeholders for numbers.
- [ ] Buttons are verb + object, the same verb for the same action.
- [ ] The cold read names the promise.

