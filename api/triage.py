"""
Claude API triage — generates plain-language explanations for flagged findings.
Set ANTHROPIC_API_KEY in environment or in a .env file next to this script.
"""

import os
import anthropic

_client = None

def _get_client():
    global _client
    if _client is None:
        key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _client = anthropic.Anthropic(api_key=key)
    return _client


def analyse(url: str, score: int, level: str, findings: list[dict]) -> str:
    """
    Ask Claude Haiku to explain what the detected findings mean in plain English.
    Returns a 2-3 sentence explanation, or an error string if unavailable.
    """
    if not findings:
        return ""

    findings_text = "\n".join(
        f"- [{f.get('severity','?').upper()}] {f.get('type','?').replace('_',' ')}: "
        f"{f.get('description','')}"
        for f in findings
    )

    prompt = (
        f"A web page at {url} was scanned for prompt injection attacks.\n"
        f"Risk score: {score}/100 ({level})\n\n"
        f"Findings:\n{findings_text}\n\n"
        "In 2-3 plain sentences (no bullet points, no markdown), explain:\n"
        "1. What these findings suggest the page is trying to do to an AI assistant\n"
        "2. How serious this is and whether the user should be concerned\n"
        "Be direct and concrete. Avoid jargon."
    )

    try:
        client = _get_client()
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except RuntimeError:
        return ""   # API key not configured — silently skip
    except Exception as e:
        err = str(e)
        if "credit balance" in err or "insufficient_quota" in err:
            return "AI analysis unavailable — Anthropic API credit balance is too low. Top up at console.anthropic.com/settings/billing."
        if "invalid_request_error" in err:
            return "AI analysis unavailable — API request error. Check your API key and model access."
        if "authentication" in err.lower() or "api_key" in err.lower():
            return "AI analysis unavailable — invalid or missing Anthropic API key."
        return f"AI analysis unavailable — {err[:120]}"
