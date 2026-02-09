import { NextRequest, NextResponse } from 'next/server';
import { generateAnimationCode, regenerateNarration } from '@/lib/gemini';
import { PaperSection } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { section, engine, action, style, perspective } = body as {
      section: PaperSection;
      engine?: 'threejs' | 'd3' | 'css' | 'manim';
      action: 'generate-code' | 'regenerate-narration';
      style?: 'professional' | 'conversational' | 'academic';
      perspective?: string;
    };

    if (action === 'generate-code' && engine) {
      const code = await generateAnimationCode(section, engine);
      return NextResponse.json({ code });
    }

    if (action === 'regenerate-narration') {
      const narration = await regenerateNarration(
        section,
        style || 'professional',
        perspective || 'first-person'
      );
      return NextResponse.json({ narration });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
