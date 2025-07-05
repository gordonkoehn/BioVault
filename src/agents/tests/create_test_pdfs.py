"""
Create test PDF files for Bio Vault testing
Creates a sample insurance policy and medical invoice
"""
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from datetime import datetime

def create_policy_pdf(filename):
    """Create a sample insurance policy PDF"""
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1*inch, height - 1*inch, "HEALTH INSURANCE POLICY")
    
    # Policy details
    c.setFont("Helvetica", 12)
    y_position = height - 1.5*inch
    
    policy_text = [
        "Policy Number: POL-2024-12345",
        "Policy Holder: John Doe",
        "Effective Date: January 1, 2024",
        "Expiration Date: December 31, 2024",
        "",
        "COVERAGE DETAILS:",
        "",
        "Annual Coverage Limit: $50,000",
        "Deductible: $1,000",
        "Co-payment: 20% after deductible",
        "",
        "COVERED SERVICES:",
        "- Routine checkups and preventive care",
        "- Emergency medical services",
        "- Hospitalization and surgery",
        "- Prescription medications",
        "- Laboratory tests and X-rays",
        "- Mental health services",
        "- Dental cleanings (2 per year)",
        "",
        "EXCLUSIONS:",
        "- Cosmetic procedures",
        "- Experimental treatments",
        "- Pre-existing conditions (first 6 months)",
        "- Elective surgeries without pre-approval",
        "",
        "IMPORTANT NOTES:",
        "- Pre-authorization required for non-emergency procedures over $5,000",
        "- Network providers offer reduced rates",
        "- Claims must be submitted within 90 days of service"
    ]
    
    c.setFont("Helvetica", 10)
    for line in policy_text:
        c.drawString(1*inch, y_position, line)
        y_position -= 0.3*inch
    
    c.save()
    print(f"Created policy PDF: {filename}")

def create_invoice_pdf(filename):
    """Create a sample medical invoice PDF"""
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1*inch, height - 1*inch, "MEDICAL INVOICE")
    
    # Clinic info
    c.setFont("Helvetica", 10)
    c.drawString(1*inch, height - 1.3*inch, "City Health Clinic")
    c.drawString(1*inch, height - 1.5*inch, "123 Medical Plaza, Suite 100")
    c.drawString(1*inch, height - 1.7*inch, "Provider ID: PROV-56789")
    
    # Invoice details
    c.setFont("Helvetica", 12)
    y_position = height - 2.5*inch
    
    invoice_text = [
        f"Invoice Number: INV-2024-0315-001",
        f"Invoice Date: {datetime.now().strftime('%B %d, %Y')}",
        f"Patient: John Doe",
        f"Policy Number: POL-2024-12345",
        "",
        "SERVICE DETAILS:",
        "",
        "Date of Service: March 15, 2024",
        "Service Type: Annual Routine Checkup",
        "",
        "ITEMIZED CHARGES:",
    ]
    
    c.setFont("Helvetica", 10)
    for line in invoice_text:
        c.drawString(1*inch, y_position, line)
        y_position -= 0.3*inch
    
    # Create table for charges
    charges = [
        ["Description", "Code", "Amount"],
        ["-" * 40, "-" * 10, "-" * 10],
        ["Office Visit - Comprehensive", "99214", "$200.00"],
        ["Basic Metabolic Panel", "80048", "$75.00"],
        ["Complete Blood Count", "85025", "$50.00"],
        ["Urinalysis", "81003", "$25.00"],
        ["-" * 40, "-" * 10, "-" * 10],
        ["", "TOTAL:", "$350.00"]
    ]
    
    for row in charges:
        c.drawString(1*inch, y_position, row[0])
        c.drawString(4.5*inch, y_position, row[1])
        c.drawString(6*inch, y_position, row[2])
        y_position -= 0.25*inch
    
    # Footer
    y_position -= 0.5*inch
    c.setFont("Helvetica", 9)
    c.drawString(1*inch, y_position, "Diagnosis Code: Z00.00 - Encounter for general examination")
    
    c.save()
    print(f"Created invoice PDF: {filename}")

def main():
    """Create test PDFs"""
    test_dir = "src/agents/tests/test_pdfs"
    
    # Create PDFs
    policy_path = os.path.join(test_dir, "test_policy.pdf")
    invoice_path = os.path.join(test_dir, "test_invoice.pdf")
    
    create_policy_pdf(policy_path)
    create_invoice_pdf(invoice_path)
    
    print(f"\nTest PDFs created in: {test_dir}")
    print(f"Policy: {policy_path}")
    print(f"Invoice: {invoice_path}")

if __name__ == "__main__":
    main()