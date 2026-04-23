"use client";

import { useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui";
import { useVoiceMode } from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";

interface VoiceModeProps {
  questionText: string;
  options?: Array<{ value: number; label: string }>;
  onAnswer: (value: number | string) => void;
  isActive: boolean;
}

export function VoiceMode({ questionText, options, onAnswer, isActive }: VoiceModeProps) {
  const {
    isListening, isReading, transcript, error, isSupported,
    startListening, stopListening, speak, stopSpeaking,
  } = useVoiceMode({
    onTranscript: (text) => {
      if (!options) return;
      const lower = text.toLowerCase().trim();
      const words = lower.split(/\s+/);

      const numMap: Record<string, number> = {
        zero: 0, none: 0,
        one: 1, first: 1,
        two: 2, second: 2,
        three: 3, third: 3,
        four: 4, fourth: 4,
        five: 5, fifth: 5,
      };

      // 1. Spoken number (digit or word) maps to option.value
      for (const word of words) {
        const num = parseFloat(word);
        if (!isNaN(num)) {
          const opt = options.find(o => o.value === num);
          if (opt) { onAnswer(opt.value); return; }
        }
        if (numMap[word] !== undefined) {
          const opt = options.find(o => o.value === numMap[word]);
          if (opt) { onAnswer(opt.value); return; }
        }
      }

      // 2. Exact label match
      for (const opt of options) {
        if (lower === opt.label.toLowerCase()) { onAnswer(opt.value); return; }
      }

      // 3. Transcript contains full label
      for (const opt of options) {
        if (lower.includes(opt.label.toLowerCase())) { onAnswer(opt.value); return; }
      }

      // 4. First significant word (≥4 chars) of label appears in transcript
      for (const opt of options) {
        const sig = opt.label.toLowerCase().split(/\s+/).find(w => w.length >= 4);
        if (sig && lower.includes(sig)) { onAnswer(opt.value); return; }
      }
    },
  });

  useEffect(() => {
    if (isActive && questionText) {
      const timer = setTimeout(() => speak(questionText), 300);
      return () => clearTimeout(timer);
    }
  }, [questionText, isActive]);

  if (!isSupported) {
    return (
      <div className="bg-warning-50 text-warning-700 px-4 py-3 rounded-lg text-sm">
        Voice mode is not supported in this browser. Please use Chrome or Edge.
      </div>
    );
  }

  return (
    <div className="bg-primary-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary-700">Voice Mode Active</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isReading ? "danger" : "outline"}
            onClick={isReading ? stopSpeaking : () => speak(questionText)}
          >
            {isReading ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {isReading ? "Stop" : "Read"}
          </Button>
          <Button
            size="sm"
            variant={isListening ? "danger" : "primary"}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isListening ? "Stop" : "Speak"}
          </Button>
        </div>
      </div>

      {isListening && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-danger-500 rounded-full animate-pulse" />
          <span className="text-sm text-neutral-600">Listening...</span>
        </div>
      )}

      {transcript && (
        <div className="bg-white rounded-lg px-3 py-2 text-sm text-neutral-700">
          Heard: &ldquo;{transcript}&rdquo;
        </div>
      )}

      {error && (
        <div className="text-xs text-danger-500">Error: {error}</div>
      )}
    </div>
  );
}
