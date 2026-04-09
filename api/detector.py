"""
Prompt injection detection logic.
Scans text and returns a risk score + list of findings.
"""

import re
from dataclasses import dataclass, field


@dataclass
class Finding:
    type: str          # e.g. "hidden_instruction", "role_override"
    severity: str      # "low", "medium", "high"
    description: str
    matched_text: str


@dataclass
class ScanResult:
    score: int                      # 0 (safe) to 100 (critical)
    level: str                      # "safe", "suspicious", "dangerous"
    findings: list[Finding] = field(default_factory=list)


# ── Pattern library ──────────────────────────────────────────────────────────
# Design principle: prefer precision over recall.
# A missed attack is better than a false positive that trains users to ignore alerts.

PATTERNS = [
    # ── HIGH severity ────────────────────────────────────────────────────────

    {
        "type": "instruction_override",
        "severity": "high",
        "description": "Attempts to cancel or override prior AI instructions",
        # Requires the word 'instructions', 'rules', 'guidelines', etc. to reduce FP
        "regex": r"\b(ignore|disregard|forget|override|bypass|cancel|void)\s+(all\s+)?(previous|prior|above|your|the\s+previous|earlier)\s+(instructions?|rules?|guidelines?|constraints?|system\s+prompt|directives?)\b",
    },
    {
        "type": "role_override",
        "severity": "high",
        "description": "Attempts to redefine the AI's identity or remove its constraints",
        "regex": r"\b(you\s+are\s+now\s+(?!a\s+(?:customer|member|user))|pretend\s+you\s+(have\s+no|are\s+(?:an?\s+)?(?:evil|unrestricted|unfiltered))|you\s+have\s+no\s+restrictions|act\s+as\s+(an?\s+)?(?:evil|unrestricted|jailbroken|unfiltered|dan\b)|forget\s+(that\s+)?you\s+are\s+(an?\s+)?ai)\b",
    },
    {
        "type": "jailbreak",
        "severity": "high",
        "description": "Known jailbreak technique detected",
        "regex": r"\b(jailbreak|do\s+anything\s+now|\bDAN\b|developer\s+mode\s+(enabled|on|activated)|god\s+mode|unrestricted\s+mode|sudo\s+mode|no[\s-]?filter\s+mode|enable\s+(all\s+)?capabilities|remove\s+(all\s+)?(restriction|filter|limit|safeguard)s?)\b",
    },
    {
        "type": "system_prompt_exfiltration",
        "severity": "high",
        "description": "Attempts to extract hidden system instructions",
        "regex": r"\b(repeat|output|print|display|reveal|show|tell\s+me|what\s+is|quote)\s+(your\s+|the\s+)?(system\s+prompt|initial\s+instructions?|hidden\s+instructions?|base\s+prompt|original\s+prompt|confidential\s+instructions?|secret\s+instructions?)\b",
    },

    # ── MEDIUM severity ───────────────────────────────────────────────────────

    {
        "type": "delimiter_injection",
        "severity": "medium",
        "description": "Injection of AI prompt structure delimiters",
        # Only match patterns that look like deliberate prompt structure, not random text
        "regex": r"(###\s*(?:system|user|assistant|instruction)\b|<\|(?:im_start|im_end|endoftext)\|>|\[INST\]|\[\/INST\]|<<SYS>>|<</SYS>>|<\|system\|>|<\|user\|>|<\|assistant\|>)",
    },
    {
        "type": "hidden_text_css",
        "severity": "medium",
        "description": "CSS used to hide text from users but not from AI",
        # Require the style to be on an element that likely contains text
        "regex": r"(?:color\s*:\s*(?:#fff(?:fff)?|white|rgba?\([^)]*,\s*0\))|font-size\s*:\s*0(?:px|pt|em|rem)?|opacity\s*:\s*0(?:\.0+)?|visibility\s*:\s*hidden|display\s*:\s*none)\s*;?\s*(?:[^}]{0,100})?(?:ignore|instruction|system|prompt|assistant|you\s+are|act\s+as)",
    },
    {
        "type": "indirect_injection",
        "severity": "medium",
        "description": "Content instructs AI using imperative commands embedded as data",
        # Must have both an AI target AND an imperative — reduces FP significantly
        "regex": r"\b(?:the\s+)?(?:ai|assistant|model|llm|gpt|claude|chatgpt|copilot|bard)\b.{0,40}\b(must|shall\s+not|is\s+(?:required|instructed|forbidden)\s+to|should\s+always|should\s+never)\b",
    },
    {
        "type": "context_hijack",
        "severity": "medium",
        "description": "Attempts to reframe or hijack the conversation context",
        "regex": r"\b(new\s+conversation\s+starts?\s+(?:here|now)|end\s+of\s+(previous\s+)?context|beginning\s+of\s+(new\s+)?instructions?|system\s*:\s*you\s+are|assistant\s*:\s*i\s+will|human\s*:\s*ignore)\b",
    },

    # ── LOW severity ─────────────────────────────────────────────────────────

    {
        "type": "persona_manipulation",
        "severity": "low",
        "description": "Asks AI to take on a specific unconstrained persona",
        # Focused: must reference removal of limits/ethics, not just "act as a doctor"
        "regex": r"\b(act\s+as\s+(if\s+you\s+have\s+no|an?\s+ai\s+without)|play\s+(the\s+)?role\s+of\s+(an?\s+)?(?:evil|malicious|unrestricted)|pretend\s+(there\s+are\s+no\s+rules|you\s+have\s+no\s+ethics|ethics\s+don.t\s+apply))\b",
    },
    {
        "type": "instruction_smuggling",
        "severity": "low",
        "description": "Instructions disguised as data or user content",
        # Requires explicit framing like [hidden] or similar markers
        "regex": r"(\[hidden\s+(?:instruction|prompt|command)\]|\[system\]|\[admin\]|\[override\]|<!--\s*(?:instruction|prompt|inject)|\{\{\s*(?:system|prompt)\s*\}\})",
    },
]

SEVERITY_WEIGHT = {"low": 10, "medium": 25, "high": 45}

# Minimum match length — ignore very short matches that are likely false positives
MIN_MATCH_CHARS = 10


def scan(text: str) -> ScanResult:
    """Scan text and return a ScanResult."""
    findings: list[Finding] = []
    text_lower = text.lower()

    for pattern in PATTERNS:
        matches = list(re.finditer(pattern["regex"], text_lower, re.IGNORECASE | re.DOTALL))
        for m in matches:
            # Skip very short matches
            if len(m.group(0)) < MIN_MATCH_CHARS:
                continue

            # Grab original-case context snippet (up to 120 chars)
            start = max(0, m.start() - 15)
            end   = min(len(text), m.end() + 15)
            snippet = text[start:end].strip()

            findings.append(Finding(
                type=pattern["type"],
                severity=pattern["severity"],
                description=pattern["description"],
                matched_text=snippet,
            ))

    # Deduplicate: keep one finding per type (highest severity)
    seen: dict[str, Finding] = {}
    for f in findings:
        if f.type not in seen or \
           SEVERITY_WEIGHT[f.severity] > SEVERITY_WEIGHT[seen[f.type].severity]:
            seen[f.type] = f
    findings = list(seen.values())

    # Score: sum of weights, capped at 100
    score = min(100, sum(SEVERITY_WEIGHT[f.severity] for f in findings))

    if score == 0:
        level = "safe"
    elif score < 35:
        level = "suspicious"
    else:
        level = "dangerous"

    return ScanResult(score=score, level=level, findings=findings)
