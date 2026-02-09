'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { extractText } from '@/lib/pdf-parser';

interface PDFUploaderProps {
  onTextExtracted: (text: string, fileName: string) => void;
  isAnalyzing: boolean;
}

export default function PDFUploader({ onTextExtracted, isAnalyzing }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setIsExtracting(true);

    try {
      const text = await extractText(file);
      if (text.trim().length < 100) {
        setError('The document appears to have very little text. Please try a different file.');
        setIsExtracting(false);
        return;
      }
      onTextExtracted(text, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text from file');
    } finally {
      setIsExtracting(false);
    }
  }, [onTextExtracted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const isLoading = isExtracting || isAnalyzing;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300
        ${isDragging
          ? 'border-blue-500 bg-blue-50 scale-[1.02]'
          : 'border-gray-300 hover:border-gray-400 bg-white'
        }
        ${isLoading ? 'pointer-events-none opacity-70' : 'cursor-pointer'}
      `}
    >
      <input
        type="file"
        accept=".pdf,.txt,.md,.tex"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        disabled={isLoading}
      />

      <div className="flex flex-col items-center gap-4">
        {isLoading ? (
          <>
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <div>
              <p className="text-lg font-medium text-gray-800">
                {isExtracting ? 'Extracting text...' : 'Analyzing paper with Gemini...'}
              </p>
              {fileName && (
                <p className="text-sm text-gray-500 mt-1">{fileName}</p>
              )}
              {isAnalyzing && (
                <p className="text-sm text-gray-400 mt-2">
                  This may take a moment. Gemini is reading your paper and generating visualizations.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {fileName ? (
              <FileText className="w-12 h-12 text-blue-500" />
            ) : (
              <Upload className="w-12 h-12 text-gray-400" />
            )}
            <div>
              <p className="text-lg font-medium text-gray-800">
                {fileName ? fileName : 'Drop your research paper here'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports PDF, TXT, MD, and LaTeX files
              </p>
            </div>
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg mt-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
