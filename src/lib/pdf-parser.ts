import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source - use local copy to avoid CDN issues
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        if ('str' in item) {
          return item.str;
        }
        return '';
      })
      .join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText.trim();
}

export async function extractTextFromText(file: File): Promise<string> {
  return await file.text();
}

export async function extractText(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return extractTextFromPDF(file);
    case 'txt':
    case 'md':
    case 'tex':
      return extractTextFromText(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}
