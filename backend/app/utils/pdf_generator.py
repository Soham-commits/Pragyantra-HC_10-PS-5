from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from reportlab.pdfgen import canvas as rl_canvas
from datetime import datetime
from io import BytesIO


def generate_patient_data_export_pdf(export_data: dict) -> BytesIO:
    """
    Generate a PDF that contains all data MediQ holds about a patient.
    Returns a BytesIO buffer suitable for StreamingResponse.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.9 * inch,  # extra room for page numbers
    )

    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        "ExportTitle",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=colors.HexColor("#111827"),
        spaceAfter=6,
        alignment=TA_CENTER,
    )
    heading_style = ParagraphStyle(
        "ExportHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=colors.HexColor("#111827"),
        spaceBefore=20,
        spaceAfter=10,
    )
    small_style = ParagraphStyle(
        "ExportSmall",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#4b5563"),
    )
    wrap_style = ParagraphStyle(
        "WrapCell",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
    )
    header_cell_style = ParagraphStyle(
        "HeaderCell",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
    )

    def format_date(value: object) -> str:
        if isinstance(value, datetime):
            return value.strftime("%B %d, %Y")
        if value is None:
            return "N/A"
        return str(value)

    def para(text: object) -> Paragraph:
        """Wrap a value in a Paragraph so long text word-wraps inside table cells."""
        return Paragraph(str(text) if text is not None else "N/A", wrap_style)

    def hpara(text: object) -> Paragraph:
        """Bold header cell paragraph."""
        return Paragraph(str(text), header_cell_style)

    def make_table(rows: list[list[object]], col_widths: list[float]) -> Table:
        table = Table(rows, colWidths=col_widths, repeatRows=1, splitByRow=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f4f6")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 10),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 1), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        return table

    def add_section(heading_text: str) -> None:
        """Add a thin divider line then a bold section heading."""
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d1d5db"), spaceAfter=2))
        story.append(Paragraph(heading_text, heading_style))

    # ---- Page X of Y canvas ----
    class _NumberedCanvas(rl_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            rl_canvas.Canvas.__init__(self, *args, **kwargs)
            self._saved_page_states: list[dict] = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self._draw_page_number(num_pages)
                rl_canvas.Canvas.showPage(self)
            rl_canvas.Canvas.save(self)

        def _draw_page_number(self, page_count: int) -> None:
            self.setFont("Helvetica", 9)
            self.setFillColor(colors.HexColor("#6b7280"))
            page_width, _ = letter
            self.drawCentredString(page_width / 2, 0.4 * inch, f"Page {self._pageNumber} of {page_count}")

    # ---- Title + metadata ----
    story.append(Paragraph("MediQ Patient Data Export", title_style))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", small_style))
    story.append(Spacer(1, 0.25 * inch))

    # ---- Profile ----
    profile = export_data.get("profile") or {}
    add_section("Profile")
    profile_rows = [
        [hpara("Field"), hpara("Value")],
        [para("Name"), para(profile.get("full_name") or "N/A")],
        [para("Health ID"), para(profile.get("health_id") or "N/A")],
        [para("Blood Group"), para(profile.get("blood_group") or "N/A")],
        [para("Age"), para(str(profile.get("age")) if profile.get("age") is not None else "N/A")],
    ]
    story.append(make_table(profile_rows, [2.0 * inch, 4.75 * inch]))
    story.append(Spacer(1, 0.2 * inch))

    # ---- Scans ----
    scans = export_data.get("scans") or []
    add_section(f"Scans ({len(scans)})")
    scan_rows: list[list[object]] = [[hpara("Type"), hpara("Date"), hpara("Prediction"), hpara("Confidence")]]
    for s in scans:
        confidence = s.get("confidence")
        confidence_str = "N/A" if confidence is None else f"{float(confidence):.2f}"
        scan_rows.append(
            [
                para(s.get("scan_type") or "N/A"),
                para(format_date(s.get("upload_date"))),
                para(s.get("prediction") or "N/A"),
                para(confidence_str),
            ]
        )
    if len(scan_rows) == 1:
        scan_rows.append([para("N/A"), para("N/A"), para("N/A"), para("N/A")])
    story.append(make_table(scan_rows, [1.1 * inch, 1.4 * inch, 3.55 * inch, 0.7 * inch]))
    story.append(Spacer(1, 0.2 * inch))

    # ---- Reports ----
    reports = export_data.get("reports") or []
    add_section(f"Reports ({len(reports)})")
    report_rows: list[list[object]] = [[hpara("Date"), hpara("Symptoms"), hpara("Assessment")]]
    for r in reports:
        symptoms = r.get("detected_symptoms") or r.get("reported_symptoms") or []
        symptoms_str = ", ".join([str(x) for x in symptoms]) if symptoms else "N/A"
        assessment = (
            (r.get("severity_assessment") or {}).get("level")
            or r.get("report_type")
            or "N/A"
        )
        report_rows.append([para(format_date(r.get("generated_date"))), para(symptoms_str), para(assessment)])
    if len(report_rows) == 1:
        report_rows.append([para("N/A"), para("N/A"), para("N/A")])
    story.append(make_table(report_rows, [1.2 * inch, 3.55 * inch, 2.0 * inch]))
    story.append(Spacer(1, 0.2 * inch))

    # ---- Referrals ----
    referrals = export_data.get("referrals") or []
    add_section(f"Referrals ({len(referrals)})")
    referral_rows: list[list[object]] = [[hpara("Date"), hpara("Specialist"), hpara("Status"), hpara("Priority")]]
    for ref in referrals:
        specialist = ref.get("specialist_name")
        if not specialist and isinstance(ref.get("external_specialist"), dict):
            specialist = ref["external_specialist"].get("name")
        referral_rows.append(
            [
                para(format_date(ref.get("created_at"))),
                para(specialist or "N/A"),
                para(ref.get("status") or "N/A"),
                para(ref.get("priority") or "N/A"),
            ]
        )
    if len(referral_rows) == 1:
        referral_rows.append([para("N/A"), para("N/A"), para("N/A"), para("N/A")])
    story.append(make_table(referral_rows, [1.2 * inch, 2.6 * inch, 1.2 * inch, 1.75 * inch]))
    story.append(Spacer(1, 0.2 * inch))

    # ---- Consents (all types: registration, scan_upload, referral_notification) ----
    consents = export_data.get("consents") or []
    add_section(f"Consents ({len(consents)})")
    consent_rows: list[list[object]] = [[hpara("Date"), hpara("Type"), hpara("Version")]]
    for c in consents:
        consent_rows.append(
            [
                para(format_date(c.get("timestamp"))),
                para(c.get("consent_type") or "N/A"),
                para(c.get("consent_version") or "N/A"),
            ]
        )
    if len(consent_rows) == 1:
        consent_rows.append([para("N/A"), para("N/A"), para("N/A")])
    story.append(make_table(consent_rows, [1.5 * inch, 3.25 * inch, 2.0 * inch]))

    doc.build(story, canvasmaker=_NumberedCanvas)
    buffer.seek(0)
    return buffer


def generate_medical_report_pdf(report_data: dict) -> BytesIO:
    """
    Generate a PDF medical report from report data.
    Returns BytesIO object that can be saved or streamed.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch
    )
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=12,
        spaceBefore=12
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        leftIndent=12,
        spaceBefore=2,
        spaceAfter=2
    )

    small_style = ParagraphStyle(
        'Small',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#4b5563')
    )

    def format_date(value: object) -> str:
        if isinstance(value, datetime):
            return value.strftime("%B %d, %Y")
        if value is None:
            return "N/A"
        return str(value)

    def format_confidence(value: object, label: object = None) -> str:
        if isinstance(value, (int, float)):
            confidence_value = float(value)
        elif isinstance(value, str):
            cleaned = value.strip().rstrip("%")
            try:
                confidence_value = float(cleaned)
            except ValueError:
                confidence_value = None
        else:
            confidence_value = None

        if confidence_value is None:
            if label is None:
                return "N/A"
            if isinstance(label, str):
                cleaned_label = label.strip().rstrip("%")
                try:
                    confidence_value = float(cleaned_label)
                except ValueError:
                    return "N/A"
            elif isinstance(label, (int, float)):
                confidence_value = float(label)
            else:
                return "N/A"

        if confidence_value <= 1:
            confidence_value *= 100

        return f"{confidence_value:.1f}%"

    def add_bullets(items: list) -> None:
        if not items:
            story.append(Paragraph("N/A", styles['Normal']))
            return
        for item in items:
            story.append(Paragraph(f"- {item}", bullet_style))
    
    # Title
    story.append(Paragraph("MEDIQ HEALTH COMPANION", title_style))
    story.append(Paragraph("Medical Report", styles['Heading2']))
    story.append(Spacer(1, 0.3 * inch))
    
    # Patient Information
    story.append(Paragraph("Patient Information", heading_style))
    
    patient_data = [
        ["Health ID:", report_data.get('health_id', 'N/A')],
        ["Patient Name:", report_data.get('patient_name', 'N/A')],
        ["Report Type:", report_data.get('report_type', 'N/A')],
        ["Date Generated:", datetime.now().strftime("%B %d, %Y")],
    ]
    
    patient_table = Table(patient_data, colWidths=[2*inch, 4*inch])
    patient_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    story.append(patient_table)
    story.append(Spacer(1, 0.3 * inch))
    
    # Chief Complaint
    if report_data.get('chief_complaint'):
        story.append(Paragraph("Chief Complaint", heading_style))
        story.append(Paragraph(report_data['chief_complaint'], styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))

    # Consultation Summary
    consultation_summary = (
        report_data.get('consultation_summary')
        or report_data.get('chief_complaint')
        or "N/A"
    )
    story.append(Paragraph("Consultation Summary", heading_style))
    story.append(Paragraph(consultation_summary, styles['Normal']))
    story.append(Spacer(1, 0.2 * inch))

    # Reported Symptoms
    reported_symptoms = (
        report_data.get('reported_symptoms')
        or report_data.get('detected_symptoms')
        or []
    )
    story.append(Paragraph("Reported Symptoms", heading_style))
    add_bullets([str(symptom) for symptom in reported_symptoms])
    story.append(Spacer(1, 0.2 * inch))

    # Symptom Duration
    symptom_duration = report_data.get('symptom_duration') or []
    story.append(Paragraph("Symptom Duration", heading_style))
    add_bullets([str(duration) for duration in symptom_duration])
    story.append(Spacer(1, 0.2 * inch))

    # AI Risk Assessment
    severity = (
        report_data.get('severity_assessment', {}).get('level')
        or report_data.get('risk_assessment')
        or report_data.get('ai_risk_assessment')
    )
    severity_display = severity.title() if isinstance(severity, str) else "N/A"
    story.append(Paragraph("AI Risk Assessment", heading_style))
    story.append(Paragraph(severity_display, styles['Normal']))
    story.append(Spacer(1, 0.2 * inch))

    # Confidence Score
    confidence_score = report_data.get('confidence_score')
    probability_label = report_data.get('probability_label')
    story.append(Paragraph("Confidence Score", heading_style))
    story.append(Paragraph(format_confidence(confidence_score, probability_label), styles['Normal']))
    story.append(Spacer(1, 0.2 * inch))

    # Clinical Recommendations
    recommendations = report_data.get('recommendations') or report_data.get('care_plan_next_steps') or []
    story.append(Paragraph("Clinical Recommendations", heading_style))
    add_bullets([str(rec) for rec in recommendations])
    story.append(Spacer(1, 0.2 * inch))

    # Doctor Review Section
    doctor_notes = report_data.get('doctor_notes')
    reviewer_name = (
        report_data.get('reviewed_by_doctor')
        or report_data.get('doctor_name')
        or report_data.get('generated_by')
    )
    review_date = report_data.get('reviewed_at') or report_data.get('updated_at')
    story.append(Paragraph("Doctor Review Section", heading_style))
    review_rows = [
        ["Remarks:", doctor_notes or "Pending review"],
        ["Reviewer Name:", reviewer_name or "N/A"],
        ["Review Date:", format_date(review_date)]
    ]
    review_table = Table(review_rows, colWidths=[2 * inch, 4 * inch])
    review_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(review_table)
    story.append(Spacer(1, 0.2 * inch))
    
    # Vital Signs
    if report_data.get('vital_signs'):
        story.append(Paragraph("Vital Signs", heading_style))
        vital_data = []
        vs = report_data['vital_signs']
        if vs.get('temperature'):
            vital_data.append(['Temperature:', f"{vs['temperature']}°F"])
        if vs.get('blood_pressure'):
            vital_data.append(['Blood Pressure:', vs['blood_pressure']])
        if vs.get('heart_rate'):
            vital_data.append(['Heart Rate:', f"{vs['heart_rate']} bpm"])
        if vs.get('respiratory_rate'):
            vital_data.append(['Respiratory Rate:', f"{vs['respiratory_rate']} /min"])
        if vs.get('oxygen_saturation'):
            vital_data.append(['Oxygen Saturation:', f"{vs['oxygen_saturation']}%"])
        
        if vital_data:
            vital_table = Table(vital_data, colWidths=[2*inch, 2*inch])
            vital_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(vital_table)
            story.append(Spacer(1, 0.2 * inch))
    
    # Diagnosis
    if report_data.get('diagnosis'):
        story.append(Paragraph("Diagnosis", heading_style))
        for idx, diag in enumerate(report_data['diagnosis'], 1):
            diag_text = f"{idx}. {diag.get('condition', 'N/A')}"
            if diag.get('severity'):
                diag_text += f" (Severity: {diag['severity']})"
            story.append(Paragraph(diag_text, styles['Normal']))
            if diag.get('notes'):
                story.append(Paragraph(f"   Notes: {diag['notes']}", styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))
    
    # Medications
    if report_data.get('medications'):
        story.append(Paragraph("Prescribed Medications", heading_style))
        med_data = [['Medication', 'Dosage', 'Frequency', 'Duration']]
        for med in report_data['medications']:
            med_data.append([
                med.get('name', 'N/A'),
                med.get('dosage', 'N/A'),
                med.get('frequency', 'N/A'),
                med.get('duration', 'N/A')
            ])
        
        med_table = Table(med_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        med_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e5e7eb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1f2937')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(med_table)
        story.append(Spacer(1, 0.2 * inch))
    
    # Doctor's Notes
    if report_data.get('doctor_notes'):
        story.append(Paragraph("Doctor's Notes", heading_style))
        story.append(Paragraph(report_data['doctor_notes'], styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))
    
    # Lab Results
    if report_data.get('lab_results'):
        story.append(Paragraph("Laboratory Results", heading_style))
        for test_name, result in report_data['lab_results'].items():
            story.append(Paragraph(f"<b>{test_name}:</b> {result}", styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))
    
    # Footer
    story.append(Spacer(1, 0.4 * inch))
    story.append(Paragraph("Medical Disclaimer", heading_style))
    disclaimers = report_data.get('disclaimers') or [
        "This report is an AI-assisted screening summary and is not a medical diagnosis.",
        "Consult a qualified healthcare professional for definitive evaluation and care.",
        "If symptoms worsen or you experience an emergency, seek immediate medical attention."
    ]
    add_bullets([str(item) for item in disclaimers])
    story.append(Spacer(1, 0.3 * inch))
    footer_text = f"Generated by MediQ Health Companion on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
    story.append(Paragraph(footer_text, small_style))
    
    # Build PDF
    def add_page_number(canvas, doc_instance):
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor(colors.HexColor('#6b7280'))
        width, _ = letter
        canvas.drawRightString(width - doc_instance.rightMargin, 0.5 * inch, f"Page {doc_instance.page}")

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    return buffer
