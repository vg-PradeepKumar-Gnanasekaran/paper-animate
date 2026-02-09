'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AnalysisResult, PlayerState, UserSettings, TimelineState, NarrationSegment } from '@/types';
import { TimelineController } from '@/lib/timeline';
import { buildPresentationScript } from '@/lib/script-builder';
import PDFUploader from '@/components/PDFUploader';
import AnimationPlayer from '@/components/AnimationPlayer';
import PlayerControls from '@/components/PlayerControls';
import SectionList from '@/components/SectionList';
import NarrationPanel from '@/components/NarrationPanel';
import CodePanel from '@/components/CodePanel';
import SettingsPanel from '@/components/SettingsPanel';
import Captions from '@/components/Captions';
import SectionTransitioner from '@/components/SectionTransitioner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Sparkles,
  Github,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';

const defaultSettings: UserSettings = {
  narrationSpeed: 'normal',
  visualStyle: 'minimal',
  colorScheme: 'light',
  animationDuration: 5,
  includeEquations: true,
  includeCode: true,
  showNarration: true,
  narratorPerspective: 'first-person',
  enableDoodles: true,
  enableCharacter: true,
};

const defaultPlayerState: PlayerState = {
  isPlaying: false,
  currentSection: 0,
  currentStep: 0,
  currentSegment: 0,
  progress: 0,
  globalTime: 0,
  speed: 1,
  isTransitioning: false,
};

export default function Home() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>(defaultPlayerState);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activePanel, setActivePanel] = useState<'sections' | 'code' | 'settings'>('sections');
  const [enableVoice, setEnableVoice] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);
  const [timelineState, setTimelineState] = useState<TimelineState | null>(null);
  const [currentSegment, setCurrentSegment] = useState<NarrationSegment | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [settingsChanged, setSettingsChanged] = useState(false);

  const timelineRef = useRef<TimelineController | null>(null);
  const lastAnalysisSettingsRef = useRef<UserSettings>(defaultSettings);

  // Subscribe to timeline updates
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline || !analysis) return;

    const unsubscribe = timeline.subscribe((state: TimelineState) => {
      setTimelineState(state);

      // Derive PlayerState from TimelineState
      setPlayerState((prev) => ({
        ...prev,
        isPlaying: timeline.isPlaying(),
        currentSection: state.sectionIndex,
        currentSegment: state.segmentIndex,
        progress: state.sectionProgress,
        globalTime: state.globalTime,
        speed: timeline.getSpeed(),
        isTransitioning: state.phase === 'transition',
      }));

      // Update current segment for captions
      if (state.phase === 'section' && analysis.presentationScript) {
        const script = analysis.presentationScript.sections[state.sectionIndex];
        if (script && script.segments[state.segmentIndex]) {
          setCurrentSegment(script.segments[state.segmentIndex]);
        } else {
          setCurrentSegment(null);
        }
      } else {
        setCurrentSegment(null);
      }
    });

    return unsubscribe;
  }, [analysis]);

  const handleTextExtracted = useCallback(async (text: string) => {
    setPdfText(text);
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('narratorPerspective', settings.narratorPerspective);
      formData.append('visualStyle', settings.visualStyle);
      formData.append('colorScheme', settings.colorScheme);
      formData.append('animationDuration', String(settings.animationDuration));
      formData.append('includeEquations', String(settings.includeEquations));
      formData.append('includeCode', String(settings.includeCode));

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const result: AnalysisResult = await res.json();

      // Ensure presentation script exists (API should have built it, but fallback)
      if (!result.presentationScript) {
        result.presentationScript = buildPresentationScript(result);
      }

      setAnalysis(result);
      setPlayerState({ ...defaultPlayerState });
      lastAnalysisSettingsRef.current = { ...settings };
      setSettingsChanged(false);

      // Destroy old timeline and create new one
      if (timelineRef.current) {
        timelineRef.current.destroy();
      }
      timelineRef.current = new TimelineController(result.presentationScript);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to analyze paper');
    } finally {
      setIsAnalyzing(false);
    }
  }, [settings]);

  // Detect when settings have changed since last analysis
  useEffect(() => {
    if (!analysis) return;
    const last = lastAnalysisSettingsRef.current;
    const changed = (
      last.narratorPerspective !== settings.narratorPerspective ||
      last.visualStyle !== settings.visualStyle ||
      last.colorScheme !== settings.colorScheme ||
      last.animationDuration !== settings.animationDuration ||
      last.includeEquations !== settings.includeEquations ||
      last.includeCode !== settings.includeCode
    );
    setSettingsChanged(changed);
  }, [settings, analysis]);

  const handleReanalyze = useCallback(async () => {
    if (!pdfText) return;
    await handleTextExtracted(pdfText);
  }, [pdfText, handleTextExtracted]);

  const currentSection = analysis?.sections[playerState.currentSection];

  // Timeline-driven controls
  const handlePlay = () => {
    timelineRef.current?.play();
    setPlayerState((s) => ({ ...s, isPlaying: true }));
  };

  const handlePause = () => {
    timelineRef.current?.pause();
    setPlayerState((s) => ({ ...s, isPlaying: false }));
  };

  const handleReset = () => {
    timelineRef.current?.pause();
    timelineRef.current?.seek(0);
    setPlayerState((s) => ({ ...s, isPlaying: false, progress: 0, globalTime: 0, currentSegment: 0 }));
  };

  const handlePrevSection = () => {
    const prev = Math.max(0, playerState.currentSection - 1);
    timelineRef.current?.pause();
    timelineRef.current?.seekToSection(prev);
    setPlayerState((s) => ({ ...s, isPlaying: false, currentSection: prev, progress: 0, currentSegment: 0 }));
  };

  const handleNextSection = () => {
    const next = Math.min(
      (analysis?.sections.length || 1) - 1,
      playerState.currentSection + 1
    );
    timelineRef.current?.pause();
    timelineRef.current?.seekToSection(next);
    setPlayerState((s) => ({ ...s, isPlaying: false, currentSection: next, progress: 0, currentSegment: 0 }));
  };

  const handleSectionSelect = (index: number) => {
    timelineRef.current?.pause();
    timelineRef.current?.seekToSection(index);
    setPlayerState((s) => ({ ...s, isPlaying: false, currentSection: index, progress: 0, currentSegment: 0 }));
  };

  const handleSpeedChange = (speed: number) => {
    timelineRef.current?.setSpeed(speed);
    setPlayerState((s) => ({ ...s, speed }));
  };

  const handleSeek = (time: number) => {
    timelineRef.current?.seek(time);
  };

  const handleNarrationUpdate = (narration: string) => {
    if (!analysis || !currentSection) return;
    const updatedSections = [...analysis.sections];
    updatedSections[playerState.currentSection] = {
      ...currentSection,
      narration,
    };
    const updatedAnalysis = { ...analysis, sections: updatedSections };

    // Rebuild presentation script with updated narration
    updatedAnalysis.presentationScript = buildPresentationScript(updatedAnalysis);
    setAnalysis(updatedAnalysis);

    // Recreate timeline with updated script
    if (timelineRef.current) {
      const wasPlaying = timelineRef.current.isPlaying();
      const currentTime = timelineRef.current.getCurrentTime();
      timelineRef.current.destroy();
      timelineRef.current = new TimelineController(updatedAnalysis.presentationScript);
      timelineRef.current.seek(currentTime);
      if (wasPlaying) timelineRef.current.play();
    }
  };

  // Determine what to render based on timeline phase
  const isTransitioning = timelineState?.phase === 'transition';
  const transitionFromIndex = timelineState?.fromSection ?? 0;
  const transitionToIndex = timelineState?.toSection ?? 0;
  const transitionProgress = timelineState?.transitionProgress ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">PaperAnimate</h1>
              <p className="text-xs text-gray-500">Research Paper to Visual Explanation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-gray-600">Powered by Gemini</span>
            </div>

            {analysis && (
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {showSidebar ? (
                  <PanelRightClose className="w-4 h-4 text-gray-600" />
                ) : (
                  <PanelRightOpen className="w-4 h-4 text-gray-600" />
                )}
              </button>
            )}

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Github className="w-4 h-4 text-gray-600" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {!analysis ? (
            /* Upload Screen */
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                  Transform Research into Visual Stories
                </h2>
                <p className="text-gray-500 text-lg">
                  Upload any research paper and watch it come alive with clean,
                  educational animations powered by Gemini AI.
                </p>
              </div>

              <PDFUploader
                onTextExtracted={handleTextExtracted}
                isAnalyzing={isAnalyzing}
              />

              {/* Features */}
              <div className="grid grid-cols-3 gap-4 mt-8">
                {[
                  {
                    title: 'Math & Equations',
                    description: 'LaTeX rendering with step-by-step animation',
                    color: 'bg-purple-50 text-purple-600',
                  },
                  {
                    title: 'CS & Algorithms',
                    description: 'Data structure and algorithm visualizations',
                    color: 'bg-green-50 text-green-600',
                  },
                  {
                    title: 'Biology & Chemistry',
                    description: '3D molecular structures and processes',
                    color: 'bg-orange-50 text-orange-600',
                  },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="bg-white rounded-xl border border-gray-100 p-4"
                  >
                    <div
                      className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium mb-2 ${feature.color}`}
                    >
                      {feature.title}
                    </div>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            /* Workspace */
            <motion.div
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-6"
            >
              {/* Left Sidebar - Section List */}
              {showSidebar && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-72 flex-shrink-0 space-y-4"
                >
                  {/* Paper Info */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-gray-800 line-clamp-2">
                      {analysis.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {analysis.abstract}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {analysis.field.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {analysis.sections.length} sections
                      </span>
                    </div>
                  </div>

                  {/* Panel Tabs */}
                  <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
                    {(['sections', 'code', 'settings'] as const).map((panel) => (
                      <button
                        key={panel}
                        onClick={() => setActivePanel(panel)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          activePanel === panel
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {panel.charAt(0).toUpperCase() + panel.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Panel Content */}
                  {activePanel === 'sections' && (
                    <SectionList
                      sections={analysis.sections}
                      currentSection={playerState.currentSection}
                      onSectionSelect={handleSectionSelect}
                    />
                  )}

                  {activePanel === 'code' && currentSection && (
                    <CodePanel section={currentSection} />
                  )}

                  {activePanel === 'settings' && (
                    <SettingsPanel
                      settings={settings}
                      field={analysis.field}
                      onSettingsChange={setSettings}
                      settingsChanged={settingsChanged}
                      onReanalyze={handleReanalyze}
                      isReanalyzing={isAnalyzing}
                    />
                  )}
                </motion.div>
              )}

              {/* Main Content */}
              <div className="flex-1 space-y-4">
                {currentSection && (
                  <>
                    {/* Animation Player or Transition */}
                    {isTransitioning && analysis.presentationScript ? (
                      <SectionTransitioner
                        prevSection={analysis.sections[transitionFromIndex]}
                        nextSection={analysis.sections[transitionToIndex]}
                        transition={analysis.presentationScript.transitions[transitionFromIndex]}
                        transitionProgress={transitionProgress}
                      />
                    ) : (
                      <AnimationPlayer
                        section={currentSection}
                        playerState={playerState}
                        animationProgress={timelineState?.sectionProgress ?? playerState.progress}
                        activeStepId={timelineState?.activeStepId}
                        enableDoodles={settings.enableDoodles}
                        enableCharacter={settings.enableCharacter}
                      />
                    )}

                    {/* Voice Narration & Captions */}
                    <Captions
                      text={currentSection.narration}
                      isPlaying={playerState.isPlaying}
                      narrationSpeed={settings.narrationSpeed}
                      showCaptions={showCaptions}
                      enableVoice={enableVoice}
                      onVoiceToggle={setEnableVoice}
                      onCaptionsToggle={setShowCaptions}
                      currentSegment={currentSegment}
                      segmentProgress={timelineState?.segmentProgress ?? 0}
                      onNarrationComplete={() => {
                        if (timelineState?.phase === 'complete') {
                          handlePause();
                        }
                      }}
                    />

                    <PlayerControls
                      playerState={playerState}
                      totalSections={analysis.sections.length}
                      totalDuration={timelineRef.current?.getTotalDuration() || 0}
                      currentTime={playerState.globalTime}
                      onPlay={handlePlay}
                      onPause={handlePause}
                      onReset={handleReset}
                      onPrevSection={handlePrevSection}
                      onNextSection={handleNextSection}
                      onSpeedChange={handleSpeedChange}
                      onSeek={handleSeek}
                    />

                    {/* Narration */}
                    {settings.showNarration && (
                      <NarrationPanel
                        section={currentSection}
                        onNarrationUpdate={handleNarrationUpdate}
                        currentSegmentIndex={timelineState?.segmentIndex ?? -1}
                        narratorPerspective={settings.narratorPerspective}
                      />
                    )}

                    {/* New Paper button */}
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => {
                          timelineRef.current?.destroy();
                          timelineRef.current = null;
                          setAnalysis(null);
                          setPdfText(null);
                          setSettingsChanged(false);
                          setPlayerState(defaultPlayerState);
                          setTimelineState(null);
                          setCurrentSegment(null);
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-4"
                      >
                        Upload a different paper
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between text-xs text-gray-400">
          <span>PaperAnimate - Gemini API Developer Competition 2025</span>
          <span>Built with Gemini, Next.js, Three.js, D3.js</span>
        </div>
      </footer>
    </div>
  );
}
