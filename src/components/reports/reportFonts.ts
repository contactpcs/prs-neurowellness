import localFont from "next/font/local";

// The Final Report's own type: Gelasio (serif — company name, title, section
// headings, scores) and Lato (sans — everything else). Bundled with the
// report template (src/assets/report/fonts, SIL OFL 1.1) so every machine
// renders and prints the same file. Not preloaded: only the report uses them.
export const reportSans = localFont({
  src: [
    { path: "../../assets/report/fonts/Lato-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../assets/report/fonts/Lato-Italic.ttf", weight: "400", style: "italic" },
    { path: "../../assets/report/fonts/Lato-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-report-sans",
  display: "swap",
  preload: false,
});

export const reportSerif = localFont({
  src: [
    { path: "../../assets/report/fonts/Gelasio-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../assets/report/fonts/Gelasio-Italic.ttf", weight: "400", style: "italic" },
    { path: "../../assets/report/fonts/Gelasio-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../assets/report/fonts/Gelasio-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-report-serif",
  display: "swap",
  preload: false,
});
