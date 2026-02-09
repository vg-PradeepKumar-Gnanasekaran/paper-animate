'use client';

import { useState } from 'react';
import { PaperSection } from '@/types';
import { MessageSquare, RefreshCw, Copy, Check } from 'lucide-react';

interface NarrationPanelProps {
  section: PaperSection;
  onNarrationUpdate: (narration: string) => void;
  currentSegmentIndex?: number;
  narratorPerspective?: string;
}

export default function NarrationPanel({
  section,
  onNarrationUpdate,
  currentSegmentIndex = -1,
  narratorPerspective = 'first-person',
}: NarrationPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNarration, setEditedNarration] = useState(section.narration);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const segments = section.script?.segments || [];
  const hasSegments = segments.length > 0;

  const handleSave = () => {
    onNarrationUpdate(editedNarration);
    setIsEditing(false);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch('/api/generate-animation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          action: 'regenerate-narration',
          style: 'conversational',
          perspective: narratorPerspective,
        }),
      });
      const data = await res.json();
      if (data.narration) {
        setEditedNarration(data.narration);
        onNarrationUpdate(data.narration);
      }
    } catch (error) {
      console.error('Failed to regenerate narration:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(section.narration);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-700">
            Narration Script
          </h4>
          {hasSegments && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
              {segments.length} segments
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Copy narration"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            title="Regenerate narration"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-gray-400 ${
                isRegenerating ? 'animate-spin' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editedNarration}
            onChange={(e) => setEditedNarration(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditedNarration(section.narration);
                setIsEditing(false);
              }}
              className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : hasSegments ? (
        // Segment-by-segment display
        <div className="space-y-1.5">
          {segments.map((segment, i) => {
            const isActive = i === currentSegmentIndex;
            const isPast = currentSegmentIndex >= 0 && i < currentSegmentIndex;

            return (
              <div
                key={segment.id}
                className={`flex gap-2 px-2.5 py-2 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 border border-blue-200'
                    : isPast
                    ? 'bg-gray-50 opacity-60'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setIsEditing(true)}
                title="Click to edit full narration"
              >
                <span
                  className={`text-[10px] font-mono font-bold mt-0.5 flex-shrink-0 ${
                    isActive ? 'text-blue-600' : 'text-gray-300'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-relaxed ${
                      isActive ? 'text-blue-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    {segment.text}
                  </p>
                  {segment.emphasis && segment.emphasis.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {segment.emphasis.map((word) => (
                        <span
                          key={word}
                          className="text-[9px] px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded font-medium"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 flex-shrink-0">
                  {segment.estimatedDuration}s
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback: flat narration text
        <p
          onClick={() => setIsEditing(true)}
          className="text-sm text-gray-600 leading-relaxed cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
          title="Click to edit"
        >
          {section.narration}
        </p>
      )}
    </div>
  );
}
