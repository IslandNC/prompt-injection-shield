"""
SQLite knowledge base.
Stores every scan result so the database grows automatically over time.
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "knowledge_base.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't exist yet."""
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                scanned_at  TEXT    NOT NULL,
                source_url  TEXT,
                score       INTEGER NOT NULL,
                level       TEXT    NOT NULL,
                findings    TEXT    NOT NULL,   -- JSON array
                text_length INTEGER NOT NULL,
                analysis    TEXT    DEFAULT ''  -- Claude AI explanation
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_scanned_at ON scans(scanned_at)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_level ON scans(level)
        """)


def save_scan(source_url: str | None, score: int, level: str,
              findings: list[dict], text_length: int, analysis: str = "") -> int:
    """Insert a scan record, return the new row id."""
    # Add analysis column if it doesn't exist (for existing databases)
    with _connect() as conn:
        try:
            conn.execute("ALTER TABLE scans ADD COLUMN analysis TEXT DEFAULT ''")
        except Exception:
            pass  # column already exists

        cur = conn.execute(
            """INSERT INTO scans (scanned_at, source_url, score, level, findings, text_length, analysis)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                datetime.utcnow().isoformat(),
                source_url,
                score,
                level,
                json.dumps(findings),
                text_length,
                analysis,
            ),
        )
        return cur.lastrowid


def get_recent_scans(limit: int = 50) -> list[dict]:
    """Return the most recent scans."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM scans ORDER BY scanned_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_stats() -> dict:
    """Aggregate statistics for the dashboard."""
    with _connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM scans").fetchone()[0]
        by_level = {
            row["level"]: row["cnt"]
            for row in conn.execute(
                "SELECT level, COUNT(*) as cnt FROM scans GROUP BY level"
            ).fetchall()
        }
        avg_score = conn.execute("SELECT AVG(score) FROM scans").fetchone()[0] or 0

        # Top finding types across all scans
        all_findings_rows = conn.execute(
            "SELECT findings FROM scans WHERE findings != '[]'"
        ).fetchall()
        finding_meta: dict[str, dict] = {}
        for row in all_findings_rows:
            for f in json.loads(row[0]):
                t = f.get("type", "unknown")
                s = f.get("severity", "low")
                if t not in finding_meta:
                    finding_meta[t] = {"count": 0, "severity": s}
                finding_meta[t]["count"] += 1
        top_findings = sorted(finding_meta.items(), key=lambda x: x[1]["count"], reverse=True)[:10]

        # Most flagged domains
        domain_rows = conn.execute(
            "SELECT source_url, level, score FROM scans WHERE source_url IS NOT NULL"
        ).fetchall()
        domain_risk: dict[str, dict] = {}
        for row in domain_rows:
            try:
                from urllib.parse import urlparse
                domain = urlparse(row["source_url"]).netloc or row["source_url"]
            except Exception:
                domain = row["source_url"]
            if domain not in domain_risk:
                domain_risk[domain] = {"scans": 0, "max_score": 0, "dangerous": 0}
            domain_risk[domain]["scans"] += 1
            domain_risk[domain]["max_score"] = max(domain_risk[domain]["max_score"], row["score"])
            if row["level"] == "dangerous":
                domain_risk[domain]["dangerous"] += 1
        top_domains = sorted(
            [{"domain": k, **v} for k, v in domain_risk.items()],
            key=lambda x: x["max_score"],
            reverse=True
        )[:8]

    return {
        "total_scans": total,
        "by_level": by_level,
        "average_score": round(avg_score, 1),
        "top_findings": [{"type": t, "count": m["count"], "severity": m["severity"]} for t, m in top_findings],
        "top_domains": top_domains,
    }


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["findings"] = json.loads(d["findings"])
    return d
