#!/usr/bin/env python3
"""Generate CRM ER diagram for draw.io (DBdrawio.drawio)."""
from __future__ import annotations

import html
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "DBdrawio.drawio"

FONT = '&lt;font face=&quot;Times New Roman, serif&quot;&gt;&lt;span style=&quot;font-size: 18.6667px;&quot;&gt;{text}&lt;/span&gt;&lt;/font&gt;'
FONT_TITLE = (
    '&lt;span style=&quot;font-size:14.0pt;font-family:&amp;quot;Times New Roman&amp;quot;,serif;'
    '&lt;br/&gt;mso-fareast-font-family:Calibri;mso-fareast-theme-font:minor-latin;'
    '&lt;br/&gt;mso-ansi-language:RU;mso-fareast-language:EN-US;mso-bidi-language:AR-SA&quot;&gt;{text}&lt;/span&gt;'
)
EDGE_STYLE = (
    "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
    "startArrow=ERoneToMany;startFill=0;endArrow=none;endFill=0;"
)


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def uid() -> str:
    return f"crm-{uuid.uuid4().hex[:12]}"


def table_entity(
    tid: str,
    title: str,
    columns: list[tuple[str, bool, bool]],
    x: int,
    y: int,
) -> tuple[str, str]:
    """columns: (name, is_pk, is_fk). First PK row uses bottom=1 like draw.io ER tables."""
    row_h = 30
    h = 30 + row_h * len(columns)
    rows: list[str] = []
    for i, (col, is_pk, is_fk) in enumerate(columns):
        rid = f"{tid}-row{i}"
        y_off = 30 + i * row_h
        bottom = "bottom=1;" if i == 0 and is_pk else "bottom=0;"
        mark = "PK" if is_pk else ("FC" if is_fk else "")
        col_style = "fontStyle=5;" if is_pk else ""
        rows.append(
            f"""
        <mxCell id="{rid}" parent="{tid}" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;top=0;left=0;right=0;{bottom}" value="" vertex="1">
          <mxGeometry height="{row_h}" width="180" y="{y_off}" as="geometry" />
        </mxCell>
        <mxCell id="{rid}-m" parent="{rid}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;editable=1;overflow=hidden;whiteSpace=wrap;html=1;{'fontStyle=1;' if is_pk else ''}" value="{esc(mark)}" vertex="1">
          <mxGeometry height="{row_h}" width="30" as="geometry" />
        </mxCell>
        <mxCell id="{rid}-c" parent="{rid}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;align=left;spacingLeft=6;overflow=hidden;whiteSpace=wrap;html=1;{col_style}" value="{FONT.format(text=esc(col))}" vertex="1">
          <mxGeometry height="{row_h}" width="150" x="30" as="geometry" />
        </mxCell>"""
        )

    table_xml = f"""
        <mxCell id="{tid}" parent="1" style="shape=table;startSize=30;container=1;collapsible=1;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;html=1;" value="{FONT_TITLE.format(text=esc(title))}" vertex="1">
          <mxGeometry height="{h}" width="180" x="{x}" y="{y}" as="geometry" />
        </mxCell>
        {''.join(rows)}
    """
    return table_xml, tid


def edge(
    eid: str,
    source: str,
    target: str,
    points: list[tuple[int, int]] | None = None,
) -> str:
    pts = ""
    if points:
        pts = "<Array as=\"points\">" + "".join(
            f'<mxPoint x="{x}" y="{y}"/>' for x, y in points
        ) + "</Array>"
    return f"""
        <mxCell id="{eid}" edge="1" parent="1" source="{source}" target="{target}" style="{EDGE_STYLE}" value="">
          <mxGeometry relative="1" as="geometry">{pts}</mxGeometry>
        </mxCell>"""


def main() -> None:
    tables_spec: dict[str, tuple[int, int, list[tuple[str, bool, bool]]]] = {
        "users": (
            40,
            40,
            [
                ("id", True, False),
                ("full_name", False, False),
                ("email", False, False),
                ("password_hash", False, False),
                ("role", False, False),
                ("phone", False, False),
                ("telegram_link", False, False),
                ("telegram_chat_id", False, False),
                ("created_at", False, False),
                ("updated_at", False, False),
            ],
        ),
        "clients": (
            280,
            120,
            [
                ("id", True, False),
                ("name", False, False),
                ("company", False, False),
                ("phone", False, False),
                ("email", False, False),
                ("address", False, False),
                ("notes", False, False),
                ("manager_id", False, True),
                ("created_at", False, False),
                ("updated_at", False, False),
            ],
        ),
        "deals": (
            520,
            80,
            [
                ("id", True, False),
                ("title", False, False),
                ("description", False, False),
                ("amount", False, False),
                ("stage", False, False),
                ("closing_date", False, False),
                ("client_id", False, True),
                ("manager_id", False, True),
                ("created_at", False, False),
                ("updated_at", False, False),
            ],
        ),
        "tasks": (
            1240,
            120,
            [
                ("id", True, False),
                ("title", False, False),
                ("description", False, False),
                ("status", False, False),
                ("priority", False, False),
                ("due_date", False, False),
                ("author_id", False, True),
                ("client_id", False, True),
                ("deal_id", False, True),
                ("created_at", False, False),
                ("updated_at", False, False),
            ],
        ),
        "calls": (
            760,
            80,
            [
                ("id", True, False),
                ("client_id", False, True),
                ("caller_id", False, True),
                ("direction", False, False),
                ("status", False, False),
                ("duration", False, False),
                ("recording_url", False, False),
                ("started_at", False, False),
                ("ended_at", False, False),
            ],
        ),
        "documents": (
            1000,
            90,
            [
                ("id", True, False),
                ("client_id", False, True),
                ("uploader_id", False, True),
                ("filename", False, False),
                ("file_path", False, False),
                ("file_size", False, False),
                ("mime_type", False, False),
                ("uploaded_at", False, False),
            ],
        ),
        "deal_documents": (
            280,
            520,
            [
                ("deal_id", True, True),
                ("document_id", True, True),
            ],
        ),
        "client_invite_tokens": (
            520,
            520,
            [
                ("id", True, False),
                ("token", False, False),
                ("client_id", False, True),
                ("manager_id", False, True),
                ("expires_at", False, False),
                ("created_at", False, False),
            ],
        ),
        "video_sessions": (
            760,
            520,
            [
                ("id", True, False),
                ("manager_id", False, True),
                ("client_id", False, True),
                ("direction", False, False),
                ("guest_token", False, False),
                ("status", False, False),
                ("recording_started_at", False, False),
                ("recording_url", False, False),
                ("started_at", False, False),
                ("ended_at", False, False),
            ],
        ),
    }

    parts: list[str] = []
    ids: dict[str, str] = {}
    for name, (x, y, cols) in tables_spec.items():
        xml, tid = table_entity(uid(), name, cols, x, y)
        parts.append(xml)
        ids[name] = tid

    # FK row ids for cleaner ER connectors (manager_id / client_id rows)
    def fk_row(table: str, col_index: int) -> str:
        return f"{ids[table]}-row{col_index}"

    edges_spec = [
        ("e-users-clients", fk_row("users", 0), fk_row("clients", 7)),
        ("e-users-deals-m", fk_row("users", 0), fk_row("deals", 7)),
        ("e-clients-deals", fk_row("clients", 0), fk_row("deals", 6)),
        ("e-users-tasks", fk_row("users", 0), fk_row("tasks", 6)),
        ("e-clients-tasks", fk_row("clients", 0), fk_row("tasks", 7)),
        ("e-deals-tasks", fk_row("deals", 0), fk_row("tasks", 8)),
        ("e-clients-calls", fk_row("clients", 0), fk_row("calls", 1)),
        ("e-users-calls", fk_row("users", 0), fk_row("calls", 2)),
        ("e-clients-docs", fk_row("clients", 0), fk_row("documents", 1)),
        ("e-users-docs", fk_row("users", 0), fk_row("documents", 2)),
        ("e-deals-dd", fk_row("deals", 0), fk_row("deal_documents", 0)),
        ("e-docs-dd", fk_row("documents", 0), fk_row("deal_documents", 1)),
        ("e-clients-invite", fk_row("clients", 0), fk_row("client_invite_tokens", 2)),
        ("e-users-invite", fk_row("users", 0), fk_row("client_invite_tokens", 3)),
        ("e-clients-video", fk_row("clients", 0), fk_row("video_sessions", 2)),
        ("e-users-video", fk_row("users", 0), fk_row("video_sessions", 1)),
    ]

    for eid, src, tgt in edges_spec:
        parts.append(edge(eid, src, tgt))

    body = "\n".join(parts)
    xml = f"""<mxfile host="app.diagrams.net" agent="CRM generator" version="29.6.6">
  <diagram name="CRM PostgreSQL" id="crm-er-diagram">
    <mxGraphModel dx="2200" dy="1400" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2000" pageHeight="1200" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
{body}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
"""
    OUT.write_text(xml, encoding="utf-8")
    print(f"Written {OUT}: {len(tables_spec)} tables, {len(edges_spec)} relationships")


if __name__ == "__main__":
    main()
