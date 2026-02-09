'use client';

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { PaperSection } from '@/types';
import { Code2, Download, Copy, Check, RefreshCw } from 'lucide-react';

interface CodePanelProps {
  section: PaperSection;
  onCodeUpdate?: (code: string) => void;
}

export default function CodePanel({ section, onCodeUpdate }: CodePanelProps) {
  const [activeTab, setActiveTab] = useState<'manim' | 'animation'>('manim');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [manimCode, setManimCode] = useState(section.manimCode || '# Manim code will be generated here');
  const [animationCode, setAnimationCode] = useState(
    JSON.stringify(section.animationData, null, 2) || '{}'
  );

  const handleCopy = () => {
    const code = activeTab === 'manim' ? manimCode : animationCode;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = activeTab === 'manim' ? manimCode : animationCode;
    const ext = activeTab === 'manim' ? 'py' : 'json';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${section.title.replace(/\s+/g, '_').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      const engine = activeTab === 'manim' ? 'manim' : section.visualization;
      const res = await fetch('/api/generate-animation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          engine,
          action: 'generate-code',
        }),
      });
      const data = await res.json();
      if (data.code) {
        if (activeTab === 'manim') {
          setManimCode(data.code);
        } else {
          setAnimationCode(data.code);
          if (onCodeUpdate) onCodeUpdate(data.code);
        }
      }
    } catch (error) {
      console.error('Failed to regenerate code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-gray-500" />
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('manim')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'manim'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Manim (Python)
            </button>
            <button
              onClick={() => setActiveTab('animation')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === 'animation'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Animation Data
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            title="Regenerate code"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-gray-500 ${
                isGenerating ? 'animate-spin' : ''
              }`}
            />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-500" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            title="Download code"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <Editor
        height="300px"
        language={activeTab === 'manim' ? 'python' : 'json'}
        value={activeTab === 'manim' ? manimCode : animationCode}
        onChange={(value) => {
          if (activeTab === 'manim') {
            setManimCode(value || '');
          } else {
            setAnimationCode(value || '');
            if (onCodeUpdate) onCodeUpdate(value || '');
          }
        }}
        theme="vs-light"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 12 },
          renderLineHighlight: 'none',
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
        }}
      />
    </div>
  );
}
