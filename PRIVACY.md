# Privacy Policy — Prompt Injection Shield

**Last updated:** 2026-04-08

## Summary

Prompt Injection Shield is a local-first tool. Your browsing data never leaves your machine except for the optional AI analysis feature described below.

---

## What data is processed

When you visit a web page, the extension extracts the visible text content of that page (text nodes, meta tags, alt/title attributes) and sends it to a local analysis server running on your own computer (`http://127.0.0.1:7777`).

**No data is sent to any remote server operated by this extension.**

---

## What is stored

Scan results — including the page URL, risk score, matched text snippets, and finding descriptions — are saved to a SQLite database file stored on your computer at:

```
prompt-injection-shield/api/knowledge_base.db
```

This file never leaves your machine unless you copy or share it yourself.

---

## Optional AI analysis (Claude API)

If you configure an Anthropic API key, text snippets from flagged findings are sent to Anthropic's Claude API to generate a plain-language explanation of the detected patterns.

- Only flagged pages trigger this request (safe pages are never sent).
- Only the finding metadata (type, severity, a short matched snippet) is sent — not the full page text.
- Anthropic's own privacy policy applies to data processed by their API: https://www.anthropic.com/privacy
- You can disable AI analysis at any time by removing the `ANTHROPIC_API_KEY` from the Launch Agent configuration.

---

## What is NOT collected

- No account, login, or identity information.
- No browsing history beyond what is stored locally in the knowledge base.
- No analytics, telemetry, or crash reporting.
- No data is shared with advertisers or any third party (other than Anthropic's API if you opt in).

---

## Data retention

All locally stored data remains on your machine. You can delete the knowledge base at any time:

```bash
rm prompt-injection-shield/api/knowledge_base.db
```

---

## Contact

This is an open-source personal security tool. For questions or concerns, open an issue in the project repository.
