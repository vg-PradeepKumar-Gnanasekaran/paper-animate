import { NextRequest, NextResponse } from 'next/server';
import { analyzePaper } from '@/lib/gemini';
import { buildPresentationScript } from '@/lib/script-builder';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfText = formData.get('text') as string;
    const narratorPerspective = (formData.get('narratorPerspective') as string) || 'first-person';
    const visualStyle = (formData.get('visualStyle') as string) || 'minimal';
    const colorScheme = (formData.get('colorScheme') as string) || 'dark';
    const animationDuration = parseInt(formData.get('animationDuration') as string || '5');
    const includeEquations = formData.get('includeEquations') !== 'false';
    const includeCode = formData.get('includeCode') !== 'false';

    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text content provided' },
        { status: 400 }
      );
    }

    const analysis = await analyzePaper(pdfText, narratorPerspective, {
      visualStyle,
      colorScheme,
      animationDuration,
      includeEquations,
      includeCode,
    });

    // Build the presentation script with computed timestamps and transitions
    analysis.presentationScript = buildPresentationScript(analysis);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
