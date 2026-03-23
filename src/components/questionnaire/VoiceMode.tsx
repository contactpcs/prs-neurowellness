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
      // Match by number ("one", "two", "1", "2") or by label substring
      const numMap: Record<string, number> = {
        zero: 0, one: 1, two: 2, three: 3, four: 4,
        "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
      };
      if (numMap[lower] !== undefined && options.find(o => o.value === numMap[lower])) {
        onAnswer(numMap[lower]);
        return;
      }
      const match = options.find(o => lower.includes(o.label.toLowerCase().split(" ")[0]));
      if (match) onAnswer(match.value);
    },
  });

  useEffect(() => {
    if (isActive && questionText) {
      const timer = setTimeout(() => {
        const fullText = options
          ? `${questionText}. Your options are: ${options.map((o, i) => `${i}: ${o.label}`).join(". ")}`
          : questionText;
        speak(fullText);
      }, 300);
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
