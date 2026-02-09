import { GoogleGenerativeAI } from '@google/generative-ai';
import { AnalysisResult, PaperSection, AnimationData, AnimationStep, NarrationSegment, SectionScript } from '@/types';
import { ensureThreeVisuals } from '@/lib/three-scene';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

type RetryConfig = {
  maxAttempts: number;
  initialDelayMs: number;
  multiplier: number;
  maxDelayMs: number;
  jitterRatio: number;
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 4,
  initialDelayMs: 1_000,
  multiplier: 2,
  maxDelayMs: 20_000,
  jitterRatio: 0.2,
};

type GeminiErrorPayload = {
  status?: number;
  message?: unknown;
  response?: {
    status?: number;
    statusText?: string;
    data?: {
      error?: {
        message?: string;
      };
    };
  };
};

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as GeminiErrorPayload;
  const response = err.response;
  const status = typeof err.status === 'number' ? err.status : response?.status;

  const messages: string[] = [];
  if (typeof err.message === 'string') messages.push(err.message);
  if (typeof response?.statusText === 'string') messages.push(response.statusText);
  const nestedMessage = response?.data?.error?.message;
  if (typeof nestedMessage === 'string') messages.push(nestedMessage);

  if (status === 429) return true;
  if (messages.some((msg) => /429|resource exhausted|rate limit|quota/i.test(msg))) return true;

  return false;
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGeminiRetry<T>(operation: () => Promise<T>, config: RetryConfig = DEFAULT_RETRY_CONFIG): Promise<T> {
  let attempt = 0;
  let delay = config.initialDelayMs;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;

      if (!isRateLimitError(error) || attempt >= config.maxAttempts) {
        if (isRateLimitError(error)) {
          throw new Error('The AI service is temporarily busy. Please wait a few moments and try again.');
        }
        throw error;
      }

      const jitter = delay * config.jitterRatio * (Math.random() - 0.5) * 2; // ± jitterRatio
      const waitTime = Math.min(config.maxDelayMs, Math.max(config.initialDelayMs, delay + jitter));

      console.warn(
        `Gemini API rate limit hit. Retrying attempt ${attempt + 1} of ${config.maxAttempts} after ${Math.round(
          waitTime
        )}ms.`
      );

      await wait(waitTime);
      delay = Math.min(config.maxDelayMs, delay * config.multiplier);
    }
  }
}

const perspectiveInstructions: Record<string, string> = {
  'first-person': `- Write narration in FIRST PERSON perspective. Use "Let me show you...", "We can see that...", "I want to highlight...", "Let us explore...", "As we move forward...", "Here, we observe...". The narrator is a guide walking alongside the viewer.`,
  'third-person': `- Write narration in THIRD PERSON perspective. Use "The paper demonstrates...", "This section shows...", "The authors propose...", "It can be observed that...", "The data reveals...", "The research indicates...". The narrator is an objective observer describing the paper's contents.`,
  'instructor': `- Write narration in INSTRUCTOR perspective. Use "Notice how...", "Consider the following...", "You can see that...", "Pay attention to...", "Think about why...", "Observe the relationship between...". The narrator is a professor directly teaching the viewer.`,
};

interface AnalysisSettings {
  visualStyle?: string;
  colorScheme?: string;
  animationDuration?: number;
  includeEquations?: boolean;
  includeCode?: boolean;
}

export async function analyzePaper(
  pdfText: string,
  narratorPerspective: string = 'first-person',
  analysisSettings: AnalysisSettings = {}
): Promise<AnalysisResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const perspectiveText = perspectiveInstructions[narratorPerspective] || perspectiveInstructions['first-person'];

  const settingsInstructions = [
    analysisSettings.visualStyle === 'detailed'
      ? '- Use DETAILED visual style: more elements per step (4-5), richer descriptions, detailed annotations'
      : '- Use MINIMAL visual style: clean and focused, 3-4 elements per step, emphasis on clarity',
    analysisSettings.includeEquations === false
      ? '- Do NOT include equation sections. Skip any mathematical formulas.'
      : '',
    analysisSettings.includeCode === false
      ? '- Do NOT include manimCode in the output.'
      : '',
    analysisSettings.animationDuration
      ? `- Target approximately ${analysisSettings.animationDuration} seconds per concept section`
      : '',
    analysisSettings.colorScheme === 'light'
      ? '- Use LIGHT color scheme: prefer blues, grays, and white backgrounds'
      : analysisSettings.colorScheme === 'field-specific'
      ? '- Use FIELD-SPECIFIC color scheme: choose colors that are conventional for this research field'
      : '- Use DARK color scheme: vibrant colors on dark backgrounds',
  ].filter(Boolean).join('\n');

  const prompt = `You are an expert at analyzing research papers and creating structured educational video scripts with synchronized animations.

Analyze this research paper and extract the key concepts. For each concept, create:
1. A detailed narration SCRIPT broken into segments, where EACH segment maps to exactly ONE animation step
2. Animation steps with RICH visual elements that illustrate each narration segment

For each concept, determine:
1. The content type (equation, algorithm, biological_process, graph, diagram, or concept)
2. The best visualization method:
   - "katex" for mathematical equations and formulas
   - "threejs" for 3D structures (molecules, geometric shapes, spatial concepts)
   - "d3" for graphs, charts, data visualizations, trees, networks
   - "css" for simple concept illustrations, flowcharts, step-by-step processes
3. A structured narration script with 3-6 segments per section
4. Any equations in LaTeX format
5. Manim Python code that would render this concept as a clean animation

CRITICAL: The "script.segments" array MUST have EXACTLY the same number of entries as "animationData.steps". Each segment narrates what happens in its corresponding step.

Return a JSON object with this exact structure:
{
  "field": "mathematics" | "computer_science" | "biology" | "physics" | "chemistry" | "general",
  "title": "Paper title",
  "abstract": "One sentence summary",
  "suggestedStyle": "minimal",
  "totalDuration": 120,
  "sections": [
    {
      "id": "section-1",
      "title": "Section title",
      "contentType": "equation" | "algorithm" | "biological_process" | "graph" | "diagram" | "concept",
      "visualization": "katex" | "threejs" | "d3" | "css",
      "concept": "One line description of the concept",
      "narration": "Full narration text (all segments concatenated with spaces).",
      "equations": ["\\\\LaTeX equation here"],
      "manimCode": "from manim import *\\n\\nclass ConceptScene(Scene):\\n    def construct(self):\\n        ...",
      "script": {
        "sectionId": "section-1",
        "fullText": "Full narration text (all segments concatenated with spaces).",
        "segments": [
          {
            "id": "seg-1-1",
            "text": "First narration sentence describing what appears on screen.",
            "stepId": "step-1",
            "estimatedDuration": 4,
            "startTime": 0,
            "endTime": 0,
            "emphasis": ["key term"],
            "pacing": "normal"
          },
          {
            "id": "seg-1-2",
            "text": "Second sentence explaining the next visual change.",
            "stepId": "step-2",
            "estimatedDuration": 5,
            "startTime": 0,
            "endTime": 0,
            "emphasis": ["another term"],
            "pacing": "normal"
          }
        ],
        "totalDuration": 0
      },
      "animationData": {
        "type": "d3" | "threejs" | "css" | "katex",
        "config": {},
        "steps": [
          {
            "id": "step-1",
            "description": "Introduce the core concept with a labeled diagram",
            "duration": 4,
            "elements": [
              {
                "type": "shape",
                "props": { "content": "Core Concept", "x": 300, "y": 60, "width": 160, "height": 50, "color": "#818CF8", "shape": "rect" },
                "animation": { "enter": "scale", "continuous": "pulse", "exit": "fadeOut", "duration": 0.8, "delay": 0 }
              },
              {
                "type": "arrow",
                "props": { "content": "leads to", "x1": 300, "y1": 110, "x2": 300, "y2": 170, "color": "#60A5FA" },
                "animation": { "enter": "draw", "continuous": "none", "exit": "fadeOut", "duration": 0.6, "delay": 0.3 }
              },
              {
                "type": "highlight",
                "props": { "content": "Key finding", "x": 300, "y": 200, "color": "#FBBF24" },
                "animation": { "enter": "fadeIn", "continuous": "float", "exit": "scaleDown", "duration": 0.6, "delay": 0.6 }
              },
              {
                "type": "text",
                "props": { "content": "Supporting explanation", "x": 300, "y": 260, "color": "#94A3B8", "size": 14 },
                "animation": { "enter": "slideUp", "continuous": "sway", "exit": "slideDown", "duration": 0.6, "delay": 0.9 }
              }
            ]
          },
          {
            "id": "step-2",
            "description": "Show the relationship between two entities",
            "duration": 5,
            "elements": [
              {
                "type": "node",
                "props": { "content": "A", "x": 150, "y": 130, "color": "#818CF8", "size": 22 },
                "animation": { "enter": "scale", "continuous": "float", "exit": "scaleDown", "duration": 0.6, "delay": 0 }
              },
              {
                "type": "node",
                "props": { "content": "B", "x": 450, "y": 130, "color": "#34D399", "size": 22 },
                "animation": { "enter": "scale", "continuous": "float", "exit": "scaleDown", "duration": 0.6, "delay": 0.2 }
              },
              {
                "type": "arrow",
                "props": { "content": "transforms", "x1": 180, "y1": 130, "x2": 420, "y2": 130, "color": "#F39C12" },
                "animation": { "enter": "draw", "continuous": "none", "exit": "fadeOut", "duration": 0.8, "delay": 0.5 }
              },
              {
                "type": "text",
                "props": { "content": "Relationship description", "x": 300, "y": 210, "color": "#E2E8F0", "size": 16 },
                "animation": { "enter": "fadeIn", "continuous": "sway", "exit": "slideDown", "duration": 0.6, "delay": 0.8 }
              }
            ]
          }
        ]
      }
    }
  ]
}

IMPORTANT RULES:
- Extract 3-6 key concepts maximum (enough for a ~2 minute video)
- CRITICAL: Each section's script.segments array MUST have the SAME length as animationData.steps
- Each segment's stepId MUST match the corresponding step's id (seg-X-1 → step-1, seg-X-2 → step-2, etc.)
- Each step's duration should match its corresponding segment's estimatedDuration
- For estimatedDuration: assume ~150 words per minute. A 10-word sentence ≈ 4 seconds
- The narration field should be the concatenation of all segment texts
- script.fullText should equal narration
- Set startTime and endTime to 0 (they will be computed client-side)
- Set script.totalDuration to 0 (it will be computed client-side)
- pacing options: "normal", "pause-before" (adds 0.5s pause before), "pause-after" (adds 0.5s pause after)
- emphasis: list 1-2 key terms from each segment for caption highlighting
- Write narration segments in a clear, educational, conversational tone
${perspectiveText}
${settingsInstructions}
- Each segment should describe what the viewer is seeing on screen
- Use clean color schemes: blues (#4A90E2, #818CF8, #60A5FA), greens (#27AE60, #34D399), purples (#8E44AD, #A78BFA), ambers (#F39C12, #FBBF24), pinks (#F472B6)
- For equations, always provide valid LaTeX
- For Manim code, generate complete, runnable Manim Community Edition code
- Make sure the JSON is valid and parseable

VISUAL RICHNESS RULES:
- Each animation step MUST contain 3-5 elements. A step with only 1 element is NOT acceptable.
- Use a MIX of element types per step: combine shapes + text + arrows, or nodes + edges + highlights, or shapes + highlights + text.
- For concepts: Use "shape" elements as labeled boxes for key ideas, "arrow" elements to show cause-effect or flow, "highlight" elements for key terms, and "text" for explanations.
- For graphs/data: Use "node" and "edge" elements for network relationships, "shape" with "bar" for data comparisons, "arrow" for trends and directions.
- For processes/algorithms: Use "node" elements for states/steps, "arrow" elements for transitions between them, "text" for labels, "highlight" for the current active step.
- ALWAYS include coordinates (x, y) for positioning elements. Use a canvas of roughly 600x300. Space elements apart to avoid overlap.
- ALWAYS include arrows or lines to show relationships and flow between elements. Do not leave elements isolated.
- Use diverse enter animations: alternate between "fadeIn", "slideUp", "slideRight", "scale", and "draw" within the same step for visual interest.
- Stagger delays: use increasing delay values (0, 0.2, 0.4, 0.6...) so elements appear sequentially, not all at once.

ANIMATION LIFECYCLE RULES:
- Each element MUST specify a "continuous" animation: "float", "pulse", "rotate", "sway", or "none"
- Each element SHOULD specify an "exit" animation: "fadeOut", "slideDown", "scaleDown", "slideLeft", or "none"
- Use "float" for nodes and shapes to give them a gentle hovering effect
- Use "pulse" for highlights and important elements to draw attention
- Use "sway" for text elements to add subtle life
- Use "rotate" sparingly, mainly for loading indicators or circular concepts
- Use "none" for arrows and connectors that should remain static
- For exit: "fadeOut" is the default, use "slideDown" for bottom elements, "scaleDown" for nodes
- IMPORTANT: Only ONE step is visible at a time. Each step fully replaces the previous one with enter/exit transitions.

KEYFRAME ANIMATION RULES (OPTIONAL — for advanced motion):
- Each element's "animation" object can optionally include a "keyframes" array for smooth intra-step motion
- Keyframes are time-based within a step: time 0 = step start, time 1 = step end
- Each keyframe can specify: time, x, y, opacity, scale, rotateZ, color, easing
- Available easing values: "linear", "easeIn", "easeOut", "easeInOut", "backOut", "cubicOut", "spring", "bounceOut", "elasticOut", or GSAP names like "power2.inOut", "back.out(1.7)", "elastic.out(1, 0.3)"
- Common patterns:
  - Slide in: [{ "time": 0, "y": 340, "opacity": 0, "easing": "backOut" }, { "time": 0.3, "y": 150, "opacity": 1 }, { "time": 1, "y": 150, "opacity": 1 }]
  - Move across: [{ "time": 0, "x": 100, "y": 150, "easing": "easeInOut" }, { "time": 0.5, "x": 300, "y": 100 }, { "time": 1, "x": 500, "y": 150 }]
- If no keyframes provided, the system auto-generates them from enter/exit (full backward compat)
- Use keyframes when elements should MOVE within their step, not just enter and hold

3D SCENE RULES (for "threejs" visualization):
- For threejs, include "threeElements" array and "cameraTrack" in animationData.config
- threeElement: { geometry, position: [x,y,z], color, label?, material?, keyframes? }
- Geometries: "sphere", "box", "cylinder", "torus", "cone", "plane", "ring", "dodecahedron", "octahedron"
- Materials: "standard", "physical", "wireframe", "glass", "toon"
- Position range: [-3, 3] per axis. Include 3-6 threeElements per scene
- cameraTrack: array of { time, position: [x,y,z], lookAt?: [x,y,z], fov?, easing? }
- Example threejs config:
  "config": { "threeElements": [{ "geometry": "sphere", "position": [0,0,0], "color": "#818CF8", "label": "Core", "material": "physical" }, { "geometry": "box", "position": [2,0,0], "color": "#34D399" }], "cameraTrack": [{ "time": 0, "position": [0,0,8], "lookAt": [0,0,0], "fov": 50 }, { "time": 1, "position": [2,1,6], "lookAt": [0,0,0], "fov": 45 }] }

VISUALIZATION-SPECIFIC GUIDANCE:
- For "css" visualization: Focus on shapes (boxes, badges), arrows (flow connections), highlights (key terms), and text (labels). Create flowchart-like layouts with clear visual hierarchy. Include x/y coordinates for precise element positioning on a 600x300 canvas.
- For "d3" visualization: Use nodes + edges for network graphs. Use shapes with "bar" for charts. Include text labels for axes. Use arrows for directed relationships.
- For "katex" visualization: The equations array handles rendering. But also include shape/highlight/text elements in animationData steps to accompany each equation reveal with visual context.
- For "threejs" visualization: Include threeElements and cameraTrack in config for data-driven 3D scenes. Also include text/shape elements in steps for pacing.

Research Paper Text:
${pdfText.substring(0, 30000)}

Return ONLY the JSON object, no markdown formatting or code blocks.`;

  const result = await withGeminiRetry(() => model.generateContent(prompt));
  const text = result.response.text();

  // Clean up the response - remove markdown code blocks if present
  let cleanJson = text.trim();
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const analysis: AnalysisResult = JSON.parse(cleanJson);

    // Ensure all sections have IDs and validate/fix scripts
    analysis.sections = analysis.sections.map((section, index) => {
      const id = section.id || `section-${index + 1}`;
      const fixedSection = { ...section, id };

      // Ensure narration is populated from script if available
      if (fixedSection.script && !fixedSection.narration) {
        fixedSection.narration = fixedSection.script.fullText;
      }

      // Validate segment-step alignment and regenerate narration when needed
      if (fixedSection.script && fixedSection.animationData) {
        const segCount = fixedSection.script.segments.length;
        const stepCount = fixedSection.animationData.steps.length;
        const uniqueTexts = new Set(
          fixedSection.script.segments
            .map((seg) => (seg.text || '').trim().toLowerCase())
            .filter(Boolean)
        );
        const shouldRegenerate = segCount !== stepCount || segCount === 0 || uniqueTexts.size <= 1;

        if (shouldRegenerate) {
          fixedSection.script = alignSegmentsToSteps(
            fixedSection.script,
            fixedSection.animationData,
            fixedSection.narration,
            id,
            fixedSection.title,
            fixedSection.concept
          );
        } else {
          // Even when counts match, sync durations & pacing with animation steps
          fixedSection.script.segments = fixedSection.script.segments.map((segment, segmentIndex) => {
            const step = fixedSection.animationData!.steps[segmentIndex];
            const textWordCount = segment.text
              ? segment.text.split(/\s+/).filter(Boolean).length
              : 0;
            const estimatedFromText = textWordCount > 0
              ? Math.max(2.5, (textWordCount / 150) * 60)
              : 4;
            return {
              ...segment,
              stepId: step.id,
              estimatedDuration: step.duration || segment.estimatedDuration || estimatedFromText,
            };
          });
          fixedSection.script.fullText = fixedSection.script.segments.map((seg) => seg.text).join(' ');
          fixedSection.script.totalDuration = 0;
        }
      }

      // Ensure script metadata stays in sync
      if (fixedSection.script) {
        fixedSection.script.sectionId = id;
        fixedSection.narration = fixedSection.script.fullText || fixedSection.narration;
      }

      return fixedSection;
    });

    ensureThreeVisuals(analysis.sections);

    return analysis;
  } catch (e) {
    console.error('Failed to parse Gemini response:', e);
    console.error('Raw response:', text.substring(0, 500));
    throw new Error('Failed to parse paper analysis. Please try again.');
  }
}

function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function ensureSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (/[.!?]$/.test(capitalized)) {
    return capitalized;
  }
  return `${capitalized}.`;
}

function extractStepHighlights(step: AnimationStep): string[] {
  if (!step.elements || step.elements.length === 0) return [];
  const focusTypes = new Set(['highlight', 'shape', 'node', 'text']);
  const phrases: string[] = [];

  for (const element of step.elements) {
    if (!focusTypes.has(element.type)) continue;
    const props = element.props as Record<string, unknown>;
    const rawContent = (props?.content ?? props?.label) as unknown;
    if (typeof rawContent === 'string') {
      const cleaned = rawContent.replace(/\s+/g, ' ').trim();
      if (cleaned.length > 0) {
        phrases.push(cleaned);
      }
    }
  }

  return Array.from(new Set(phrases)).slice(0, 3);
}

function buildSegmentNarration(
  step: AnimationStep,
  fallbackSentence: string | undefined,
  sectionConcept: string,
  sectionTitle: string,
  stepIndex: number
): string {
  if (fallbackSentence && fallbackSentence.length > 0) {
    return ensureSentence(fallbackSentence);
  }

  const highlights = extractStepHighlights(step);
  const focusSubject = sectionConcept || sectionTitle || 'this concept';

  if (highlights.length > 0) {
    const joined = highlights.length === 1
      ? highlights[0]
      : `${highlights[0]} and ${highlights[1]}`;
    return ensureSentence(`We spotlight ${joined} to show how it connects to ${focusSubject}.`);
  }

  if (step.description && step.description.trim().length > 0) {
    return ensureSentence(step.description);
  }

  return ensureSentence(`Step ${stepIndex + 1} deepens the understanding of ${focusSubject}.`);
}

function buildEmphasis(step: AnimationStep, segmentText: string): string[] {
  const emphasis: string[] = [];
  const highlightWords = extractStepHighlights(step)
    .flatMap((phrase) =>
      phrase
        .split(/\s+/)
        .map((word) => word.replace(/[^a-zA-Z0-9-]/g, ''))
        .filter((word) => word.length > 3)
    );

  for (const word of highlightWords) {
    const normalized = word.toLowerCase();
    if (normalized && !emphasis.some((w) => w.toLowerCase() === normalized)) {
      emphasis.push(word);
    }
    if (emphasis.length >= 2) {
      return emphasis.slice(0, 2);
    }
  }

  const fallbackWords = segmentText
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9-]/g, ''))
    .filter((word) => word.length > 4);

  for (const word of fallbackWords) {
    const normalized = word.toLowerCase();
    if (normalized && !emphasis.some((w) => w.toLowerCase() === normalized)) {
      emphasis.push(word);
    }
    if (emphasis.length >= 2) break;
  }

  return emphasis.slice(0, 2);
}

function alignSegmentsToSteps(
  script: SectionScript,
  animationData: AnimationData,
  narration: string,
  sectionId: string,
  sectionTitle: string,
  sectionConcept: string
): SectionScript {
  const steps = animationData.steps;
  if (!steps || steps.length === 0) {
    return {
      sectionId,
      fullText: narration,
      segments: script.segments,
      totalDuration: 0,
    };
  }

  const sentences = splitIntoSentences(narration);

  const segments: NarrationSegment[] = steps.map((step, index) => {
    const fallbackSentence = sentences[index];
    const text = buildSegmentNarration(step, fallbackSentence, sectionConcept, sectionTitle, index);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const estimatedFromWords = Math.max(2.5, (wordCount / 150) * 60);
    const emphasis = buildEmphasis(step, text);

    return {
      id: `seg-${sectionId}-${index + 1}`,
      text,
      stepId: step.id || `${sectionId}-step-${index + 1}`,
      estimatedDuration: step.duration || Number(estimatedFromWords.toFixed(2)),
      startTime: 0,
      endTime: 0,
      emphasis: emphasis.length > 0 ? emphasis : undefined,
      pacing: 'normal' as const,
    };
  });

  const fullText = segments.map((segment) => segment.text).join(' ');

  return {
    sectionId,
    fullText,
    segments,
    totalDuration: 0,
  };
}

export async function generateAnimationCode(
  section: PaperSection,
  engine: 'threejs' | 'd3' | 'css' | 'manim'
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Generate ${engine} code for this educational concept visualization.

Concept: ${section.concept}
Content Type: ${section.contentType}
Narration: ${section.narration}
${section.equations ? `Equations: ${section.equations.join(', ')}` : ''}

Style Requirements:
- Clean, minimal, educational (white/light background)
- No flashy effects - smooth, slow transitions
- Clear labels and annotations
- Educational pacing
- Colors: Blues (#4A90E2), Greens (#27AE60), clean palette

${engine === 'threejs' ? `
Generate a React Three Fiber component (JSX). Use @react-three/drei helpers.
The component should accept an "animationProgress" prop (0-1) to control the animation state.
Export default the component.
` : engine === 'd3' ? `
Generate a React component that uses D3.js for visualization.
Use useRef for SVG element and useEffect for D3 rendering.
The component should accept an "animationProgress" prop (0-1) to control the animation.
SVG dimensions: 800x500.
Export default the component.
` : engine === 'manim' ? `
Generate complete Manim Community Edition Python code.
Use clean Scene with white background.
Include smooth animations (Write, FadeIn, Transform).
` : `
Generate a React component using CSS animations and Framer Motion.
Use clean, educational styling with Tailwind classes.
The component should accept an "animationProgress" prop (0-1).
Export default the component.
`}

Return ONLY the code, no explanations or markdown formatting.`;

  const result = await withGeminiRetry(() => model.generateContent(prompt));
  return result.response.text().trim();
}

export async function regenerateNarration(
  section: PaperSection,
  style: 'professional' | 'conversational' | 'academic',
  perspective: string = 'first-person'
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const perspectiveMap: Record<string, string> = {
    'first-person': 'Use first person perspective: "Let me explain...", "We can see that...", "Let us explore..."',
    'third-person': 'Use third person perspective: "The paper shows...", "This demonstrates...", "The authors propose..."',
    'instructor': 'Use instructor perspective: "Notice how...", "Consider the...", "You can see that..."',
  };

  const perspectiveHint = perspectiveMap[perspective] || perspectiveMap['first-person'];

  const prompt = `Rewrite this educational narration in a ${style} tone.
${perspectiveHint}

Original concept: ${section.concept}
Original narration: ${section.narration}
${section.equations ? `Related equations: ${section.equations.join(', ')}` : ''}

Write 2-3 sentences that clearly explain this concept. Keep it educational and clear.
Return ONLY the narration text, nothing else.`;

  const result = await withGeminiRetry(() => model.generateContent(prompt));
  return result.response.text().trim();
}
