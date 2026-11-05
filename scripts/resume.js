// Resume page: draws the PDF as "paper" with pdf.js, sized to the column and
// sharp on high-DPI screens; redrawn when the width changes.

const RESUME_PDF = '/assets/documents/Elias Wennerberg_Resume_2026_Q4.pdf';

document.getElementById('resume-download').href = RESUME_PDF;
document.getElementById('resume-open').href = RESUME_PDF;

const viewer = document.getElementById('pdf-viewer');
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDoc = null;
let drawnWidth = 0;

async function drawResume() {
  const width = viewer.clientWidth;
  if (!pdfDoc || !width || Math.abs(width - drawnWidth) < 2) return;
  drawnWidth = width;

  const dpr = window.devicePixelRatio || 1;
  const canvases = [];
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    // Render at the displayed size times the pixel ratio, so text stays crisp
    const viewport = page.getViewport({ scale: (width / base.width) * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Resume page ${pageNum} of ${pdfDoc.numPages}`);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    canvases.push(canvas);
  }
  viewer.replaceChildren(...canvases);
  viewer.classList.remove('is-loading');
}

pdfjsLib.getDocument(RESUME_PDF).promise
  .then(doc => {
    pdfDoc = doc;
    return drawResume();
  })
  .catch(err => {
    console.error('Failed to load resume PDF:', err);
    viewer.classList.remove('is-loading');
    viewer.classList.add('has-error');
    viewer.innerHTML = `<p>The resume preview couldn't load here. <a href="${RESUME_PDF}" download>Download the PDF</a> instead.</p>`;
  });

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawResume, 200);
});
