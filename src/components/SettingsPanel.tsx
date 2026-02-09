'use client';

import { UserSettings, FieldType } from '@/types';
import { Settings, Palette, Type, Zap, MessageSquare, RefreshCw, Loader2 } from 'lucide-react';

interface SettingsPanelProps {
  settings: UserSettings;
  field: FieldType;
  onSettingsChange: (settings: UserSettings) => void;
  settingsChanged?: boolean;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

export default function SettingsPanel({
  settings,
  field,
  onSettingsChange,
  settingsChanged = false,
  onReanalyze,
  isReanalyzing = false,
}: SettingsPanelProps) {
  const update = (key: keyof UserSettings, value: unknown) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-4 h-4 text-gray-500" />
        <h4 className="text-sm font-semibold text-gray-700">Settings</h4>
      </div>

      <div className="space-y-4">
        {/* Narrator Perspective */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <label className="text-xs font-medium text-gray-600">Narrator Perspective</label>
          </div>
          <div className="flex flex-col gap-1.5">
            {([
              { value: 'first-person' as const, label: '1st Person', desc: '"Let me show you..."' },
              { value: 'third-person' as const, label: '3rd Person', desc: '"The paper shows..."' },
              { value: 'instructor' as const, label: 'Instructor', desc: '"Notice how..."' },
            ]).map((option) => (
              <button
                key={option.value}
                onClick={() => update('narratorPerspective', option.value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  settings.narratorPerspective === option.value
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-gray-400 ml-1.5">{option.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Visual Style */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Palette className="w-3.5 h-3.5 text-gray-400" />
            <label className="text-xs font-medium text-gray-600">Visual Style</label>
          </div>
          <div className="flex gap-2">
            {(['minimal', 'detailed'] as const).map((style) => (
              <button
                key={style}
                onClick={() => update('visualStyle', style)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  settings.visualStyle === style
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Color Scheme */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Palette className="w-3.5 h-3.5 text-gray-400" />
            <label className="text-xs font-medium text-gray-600">Color Scheme</label>
          </div>
          <div className="flex gap-2">
            {(['light', 'dark', 'field-specific'] as const).map((scheme) => (
              <button
                key={scheme}
                onClick={() => update('colorScheme', scheme)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  settings.colorScheme === scheme
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                {scheme === 'field-specific' ? field : scheme.charAt(0).toUpperCase() + scheme.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Narration Speed */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Type className="w-3.5 h-3.5 text-gray-400" />
            <label className="text-xs font-medium text-gray-600">Narration Speed</label>
          </div>
          <div className="flex gap-2">
            {(['slow', 'normal', 'fast'] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => update('narrationSpeed', speed)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  settings.narrationSpeed === speed
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                {speed.charAt(0).toUpperCase() + speed.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Animation Duration */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-gray-400" />
            <label className="text-xs font-medium text-gray-600">
              Duration per Concept: {settings.animationDuration}s
            </label>
          </div>
          <input
            type="range"
            min={3}
            max={15}
            step={1}
            value={settings.animationDuration}
            onChange={(e) => update('animationDuration', parseInt(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          {[
            { key: 'includeEquations' as const, label: 'Show Equations' },
            { key: 'includeCode' as const, label: 'Show Code' },
            { key: 'showNarration' as const, label: 'Show Narration' },
            { key: 'enableDoodles' as const, label: 'Sketch Doodles' },
            { key: 'enableCharacter' as const, label: 'Anime Guide' },
          ].map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="text-xs text-gray-600">{label}</span>
              <div
                onClick={() => update(key, !settings[key])}
                className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${
                  settings[key] ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                    settings[key] ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          ))}
        </div>

        {/* Re-analyze button */}
        {settingsChanged && onReanalyze && (
          <div className="pt-3 border-t border-gray-100">
            <button
              onClick={onReanalyze}
              disabled={isReanalyzing}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isReanalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Re-analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-analyze with New Settings
                </>
              )}
            </button>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Settings changed since last analysis
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
