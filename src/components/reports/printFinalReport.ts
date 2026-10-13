import { printElement } from "@/lib/utils/printElement";
import { REPORT_COMPANY, REPORT_RUNNING_LOGO_URL, REPORT_TITLE, formatReportDate } from "./FinalReportDocument";
import { reportSans } from "./reportFonts";
import type { FinalReportSections, FinalReportSignature } from "@/types/finalReport.types";

/** A CSS string literal: `content` values are built from patient data. */
function cssString(value: string): string {
  const escaped = value.split("\\").join("\\\\").split('"').join('\\"');
  return `"${escaped.replace(/[\r\n]+/g, " ")}"`;
}

/** The printed page of the report template: A4, 18 mm side margins, the
 * letterhead on page 1 (it is part of the document), and from page 2 on a
 * running header — brand bar, logo, patient name and MRN — drawn in the top
 * margin. Every page carries the footer: company, title and date on the
 * left, "Page X of Y" on the right, and under them the report ID
 * (final_reports.report_id) in small type.
 *
 * The header and footer are CSS page-margin boxes, which Chrome and Edge
 * print (version 131+). A browser without them still prints the report,
 * only without the running header and footer.
 *
 * ponytail: browser print, not the server-side WeasyPrint render the
 * template package describes — that needs Pango/GTK on every machine that
 * runs the backend. Move to it when one stored PDF per report is required. */
function reportPageCss(sections: FinalReportSections, signature: FinalReportSignature | null, reportId?: string): string {
  const sep = "  ·  ";
  const header = [sections.patient?.name, sections.patient?.mrn ? `MRN ${sections.patient.mrn}` : null].filter(Boolean).join(sep);
  const footer = [REPORT_COMPANY.shortName, REPORT_TITLE, formatReportDate(signature?.signed_at ?? sections.generated_at)].join(sep);
  const footerId = reportId ? `Report ID ${reportId}` : "Draft — not signed";
  // The report's own sans (Lato, loaded by reportFonts.ts under a generated name).
  const sans = `${reportSans.style.fontFamily}, sans-serif`;
  const logoUrl = new URL(REPORT_RUNNING_LOGO_URL, window.location.origin).href;
  const footerBox =
    `font: 7.3pt ${sans}; color: #6B7780; vertical-align: top; ` +
    "padding-top: 2.6mm; margin-top: 5mm; border-top: 0.6pt solid #B3D2C7; white-space: nowrap;";

  return `
    @page {
      size: A4;
      margin: 31mm 18mm 20mm 18mm;
      @top-center {
        content: ${cssString(header)};
        width: 100%; text-align: right; vertical-align: bottom;
        font: 7.5pt ${sans}; letter-spacing: 0.02em; color: #6B7780;
        padding: 0 0 2.4mm; margin-bottom: 9mm; border-bottom: 0.6pt solid #C9DAD3;
        background:
          url(${cssString(logoUrl)}) left bottom 2.4mm / auto 6.8mm no-repeat,
          linear-gradient(to right, #B3D2C7 0 40%, #84B0A3 40% 70%, #4A8774 70% 95%, #C08090 95% 100%) left top 8mm / 100% 2.6pt no-repeat;
      }
      @bottom-left { content: ${cssString(footer)}; ${footerBox} width: 50%; text-align: left; }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); ${footerBox} width: 50%; text-align: right; }
      /* The report ID sits on its own line under the footer text, in small
         type. Chrome always centres this box on the page, so it is given the
         full width and pushed down a line instead of sharing the first one. */
      @bottom-center {
        content: ${cssString(footerId)};
        width: 100%; text-align: left; vertical-align: top; white-space: nowrap;
        font: 5.6pt ${sans}; letter-spacing: 0.02em; color: #97A1A8;
        padding-top: 7.2mm; margin-top: 5mm;
      }
    }
    /* Page 1 carries the full letterhead in the flow instead of the running header. */
    @page :first {
      margin-top: 10mm;
      @top-center { content: none; background: none; border: 0; }
    }`;
}

/** Opens the print dialog for a rendered FinalReportDocument. Returns false
 * when the browser blocked the popup. */
export function printFinalReport(
  element: HTMLElement,
  report: { sections: FinalReportSections; signature: FinalReportSignature | null; reportId?: string },
): boolean {
  const title = [REPORT_TITLE, report.sections.patient?.name, report.reportId].filter(Boolean).join(" · ");
  return printElement(element, title, reportPageCss(report.sections, report.signature, report.reportId));
}
