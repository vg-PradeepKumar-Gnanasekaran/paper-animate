'use client';

import { PaperSection } from '@/types';
import { motion } from 'framer-motion';
import {
  Sigma,
  Code2,
  Dna,
  BarChart3,
  Shapes,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

interface SectionListProps {
  sections: PaperSection[];
  currentSection: number;
  onSectionSelect: (index: number) => void;
}

const iconMap: Record<string, LucideIcon> = {
  equation: Sigma,
  algorithm: Code2,
  biological_process: Dna,
  graph: BarChart3,
  diagram: Shapes,
  concept: Lightbulb,
};

const vizColorMap: Record<string, string> = {
  katex: 'bg-purple-100 text-purple-700',
  threejs: 'bg-green-100 text-green-700',
  d3: 'bg-orange-100 text-orange-700',
  css: 'bg-blue-100 text-blue-700',
};

export default function SectionList({
  sections,
  currentSection,
  onSectionSelect,
}: SectionListProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3">
        Sections
      </h3>
      {sections.map((section, index) => {
        const Icon = iconMap[section.contentType] || Lightbulb;
        const isActive = index === currentSection;

        return (
          <motion.button
            key={section.id}
            onClick={() => onSectionSelect(index)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                : 'bg-white border border-gray-100 hover:border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-1.5 rounded-lg ${
                  isActive ? 'bg-blue-100' : 'bg-gray-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-600' : 'text-gray-500'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    isActive ? 'text-blue-900' : 'text-gray-800'
                  }`}
                >
                  {section.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {section.concept}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      vizColorMap[section.visualization] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {section.visualization}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {section.contentType.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {isActive && (
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2" />
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
