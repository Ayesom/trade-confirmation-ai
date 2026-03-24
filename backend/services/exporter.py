import os
import json
from datetime import datetime
from typing import Dict, Any
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


RISK_COLORS_PDF = {
    "HIGH": colors.Color(0.8, 0.1, 0.1),
    "MEDIUM": colors.Color(0.9, 0.5, 0.0),
    "LOW": colors.Color(0.1, 0.6, 0.1),
}


def format_value(val: Any) -> str:
    if val is None:
        return "—"
    if isinstance(val, float):
        if val > 1000:
            return f"{val:,.2f}"
        return f"{val:.4f}".rstrip("0").rstrip(".")
    if isinstance(val, bool):
        return "Yes" if val else "No"
    return str(val)


def get_trade_fields(confirmation: Dict[str, Any]) -> list:
    """Extract display-worthy fields from confirmation."""
    skip = {"clauses", "generated_narrative", "compliance_notes", "id", "trade_type", "description"}
    fields = []
    for k, v in confirmation.items():
        if k in skip or isinstance(v, dict):
            continue
        fields.append((k.replace("_", " ").title(), format_value(v)))
    return fields


def export_to_pdf(confirmation: Dict[str, Any], output_path: str) -> str:
    """Generate a professional PDF trade confirmation."""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    story = []

    # Custom styles
    title_style = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=18, textColor=colors.Color(0.05, 0.15, 0.35), spaceAfter=4, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=12, alignment=TA_CENTER)
    section_style = ParagraphStyle("Section", parent=styles["Heading2"], fontSize=11, textColor=colors.Color(0.05, 0.15, 0.35), spaceBefore=14, spaceAfter=6, borderPad=4)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9, leading=14, spaceAfter=6)
    clause_style = ParagraphStyle("Clause", parent=styles["Normal"], fontSize=8.5, leading=13, leftIndent=12, spaceAfter=8, textColor=colors.Color(0.2, 0.2, 0.2))

    # Header
    story.append(Paragraph("TRADE CONFIRMATION", title_style))
    story.append(Paragraph(f"Document ID: {confirmation.get('id', 'N/A')} &nbsp;&nbsp;|&nbsp;&nbsp; Generated: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.Color(0.05, 0.15, 0.35)))
    story.append(Spacer(1, 12))

    # Trade type badge
    trade_label = confirmation.get("trade_type_label", confirmation.get("trade_type", "").replace("_", " ").title())
    story.append(Paragraph(f"<b>Trade Type:</b> {trade_label}", ParagraphStyle("Badge", parent=styles["Normal"], fontSize=12, textColor=colors.Color(0.05, 0.15, 0.35), spaceAfter=12)))

    # Narrative
    narrative = confirmation.get("generated_narrative", "")
    if narrative:
        story.append(Paragraph("TRANSACTION SUMMARY", section_style))
        story.append(Paragraph(narrative, body_style))
        story.append(Spacer(1, 6))

    # Trade Details Table
    story.append(Paragraph("TRADE DETAILS", section_style))
    fields = get_trade_fields(confirmation)
    if fields:
        table_data = [["Field", "Value"]]
        for label, value in fields:
            table_data.append([label, value])

        col_widths = [2.5 * inch, 4.5 * inch]
        t = Table(table_data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.05, 0.15, 0.35)),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.Color(0.96, 0.97, 0.99), colors.white]),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 1), (0, -1), colors.Color(0.2, 0.2, 0.4)),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.Color(0.85, 0.85, 0.9)),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t)
        story.append(Spacer(1, 14))

    # Clauses
    clauses = confirmation.get("clauses", {})
    if clauses:
        story.append(Paragraph("LEGAL TERMS & CONDITIONS", section_style))
        for clause_key, clause_text in clauses.items():
            if clause_text:
                label = clause_key.replace("_", " ").title()
                story.append(Paragraph(f"<b>{label}</b>", ParagraphStyle("ClauseHead", parent=styles["Normal"], fontSize=9, spaceAfter=2, textColor=colors.Color(0.1, 0.1, 0.35))))
                story.append(Paragraph(str(clause_text), clause_style))

    # Compliance notes
    compliance = confirmation.get("compliance_notes", "")
    if compliance:
        story.append(Spacer(1, 8))
        story.append(Paragraph("COMPLIANCE NOTES", section_style))
        story.append(Paragraph(str(compliance), clause_style))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
    story.append(Spacer(1, 6))
    footer_style = ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7.5, textColor=colors.grey, alignment=TA_CENTER)
    story.append(Paragraph("CONFIDENTIAL — This document is for authorized parties only. Generated by Trade Confirmation AI System.", footer_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M:%S UTC')}", footer_style))

    doc.build(story)
    return output_path


def export_to_docx(confirmation: Dict[str, Any], output_path: str) -> str:
    """Generate a professional DOCX trade confirmation."""
    doc = Document()

    # Page margins
    section = doc.sections[0]
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.9)
    section.right_margin = Inches(0.9)

    NAVY = RGBColor(13, 38, 89)
    DARK_GREY = RGBColor(60, 60, 60)

    def add_heading(text, level=1, color=NAVY):
        p = doc.add_heading(text, level=level)
        for run in p.runs:
            run.font.color.rgb = color
        return p

    def add_kv(label, value):
        p = doc.add_paragraph()
        run_label = p.add_run(f"{label}: ")
        run_label.bold = True
        run_label.font.size = Pt(9.5)
        run_label.font.color.rgb = NAVY
        run_val = p.add_run(str(value))
        run_val.font.size = Pt(9.5)
        p.paragraph_format.space_after = Pt(3)
        return p

    # Title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title.add_run("TRADE CONFIRMATION")
    title_run.bold = True
    title_run.font.size = Pt(18)
    title_run.font.color.rgb = NAVY

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = subtitle.add_run(f"Document ID: {confirmation.get('id', 'N/A')}  |  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    sub_run.font.size = Pt(9)
    sub_run.font.color.rgb = RGBColor(120, 120, 120)

    doc.add_paragraph()

    # Trade type
    trade_label = confirmation.get("trade_type_label", confirmation.get("trade_type", "").replace("_", " ").title())
    p = doc.add_paragraph()
    r = p.add_run(f"Trade Type: {trade_label}")
    r.bold = True
    r.font.size = Pt(12)
    r.font.color.rgb = NAVY

    # Narrative
    narrative = confirmation.get("generated_narrative", "")
    if narrative:
        add_heading("Transaction Summary", level=2)
        narr_p = doc.add_paragraph(narrative)
        for run in narr_p.runs:
            run.font.size = Pt(9.5)
            run.font.color.rgb = DARK_GREY

    # Trade Details
    add_heading("Trade Details", level=2)
    fields = get_trade_fields(confirmation)
    if fields:
        table = doc.add_table(rows=1, cols=2)
        table.style = "Table Grid"
        hdr = table.rows[0].cells
        hdr[0].text = "Field"
        hdr[1].text = "Value"
        for cell in hdr:
            for para in cell.paragraphs:
                for run in para.runs:
                    run.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
                    run.font.size = Pt(9)
            cell._tc.get_or_add_tcPr()

        for label, value in fields:
            row = table.add_row().cells
            row[0].text = label
            row[1].text = value
            for cell in row:
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.size = Pt(9)

    doc.add_paragraph()

    # Clauses
    clauses = confirmation.get("clauses", {})
    if clauses:
        add_heading("Legal Terms & Conditions", level=2)
        for clause_key, clause_text in clauses.items():
            if clause_text:
                p = doc.add_paragraph()
                label_run = p.add_run(f"{clause_key.replace('_', ' ').title()}: ")
                label_run.bold = True
                label_run.font.size = Pt(9)
                label_run.font.color.rgb = NAVY
                text_run = p.add_run(str(clause_text))
                text_run.font.size = Pt(9)
                text_run.font.color.rgb = DARK_GREY
                p.paragraph_format.space_after = Pt(6)

    # Compliance notes
    compliance = confirmation.get("compliance_notes", "")
    if compliance:
        add_heading("Compliance Notes", level=2)
        comp_p = doc.add_paragraph(str(compliance))
        for run in comp_p.runs:
            run.font.size = Pt(9)
            run.font.color.rgb = DARK_GREY

    # Footer note
    doc.add_paragraph()
    footer_p = doc.add_paragraph()
    footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer_run = footer_p.add_run("CONFIDENTIAL — This document is for authorized parties only. Generated by Trade Confirmation AI System.")
    footer_run.font.size = Pt(7.5)
    footer_run.font.color.rgb = RGBColor(150, 150, 150)
    footer_run.italic = True

    doc.save(output_path)
    return output_path