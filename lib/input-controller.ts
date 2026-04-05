import type { KeystrokeEvent } from "@/lib/types";

export interface InputState {
  typedValue: string;
  caretPosition: number;
  isActive: boolean;
  startTime: number | null;
  lastKeystrokeTime: number;
  keystrokeLog: KeystrokeEvent[];
}

export type InputAction =
  | { type: "START" }
  | { type: "INSERT"; text: string; expected: string; caretAdvance?: number }
  | { type: "KEYPRESS"; char: string; expected: string }
  | { type: "BACKSPACE" }
  | { type: "RESET" }
  | { type: "COMPLETE" };

export const initialInputState: InputState = {
  typedValue: "",
  caretPosition: 0,
  isActive: false,
  startTime: null,
  lastKeystrokeTime: 0,
  keystrokeLog: [],
};

export function inputReducer(state: InputState, action: InputAction): InputState {
  const now = Date.now();

  switch (action.type) {
    case "START": {
      return {
        ...state,
        isActive: true,
        startTime: state.startTime ?? now,
        lastKeystrokeTime: now,
      };
    }

    case "KEYPRESS": {
      if (!state.isActive) {
        return state;
      }

      const baseline = state.startTime ?? now;
      const isCorrect = action.char === action.expected;
      const newLog: KeystrokeEvent = {
        timestamp: now - baseline,
        correct: isCorrect,
      };

      return {
        ...state,
        typedValue:
          state.typedValue.slice(0, state.caretPosition) +
          action.char +
          state.typedValue.slice(state.caretPosition),
        caretPosition: state.caretPosition + 1,
        lastKeystrokeTime: now,
        keystrokeLog: [...state.keystrokeLog, newLog],
      };
    }

    case "INSERT": {
      if (!state.isActive) {
        return state;
      }

      const baseline = state.startTime ?? now;
      const caretAdvance = action.caretAdvance ?? action.text.length;
      const newLog: KeystrokeEvent[] =
        action.text.length > 0
          ? action.text.split("").map((char, index) => ({
              timestamp: now - baseline,
              correct: char === (action.expected[index] ?? ""),
            }))
          : caretAdvance > 0 && action.expected.length > 0
            ? [
                {
                  timestamp: now - baseline,
                  correct: state.typedValue[state.caretPosition] === action.expected[0],
                },
              ]
            : [];

      return {
        ...state,
        typedValue:
          state.typedValue.slice(0, state.caretPosition) +
          action.text +
          state.typedValue.slice(state.caretPosition),
        caretPosition: state.caretPosition + caretAdvance,
        lastKeystrokeTime: now,
        keystrokeLog: [...state.keystrokeLog, ...newLog],
      };
    }

    case "BACKSPACE": {
      if (state.caretPosition === 0) {
        return state;
      }

      const charBefore = state.typedValue[state.caretPosition - 1] ?? "";
      const charAfter = state.typedValue[state.caretPosition] ?? "";
      const pairedCloser = getPairedCloser(charBefore);
      const removePair = pairedCloser !== null && pairedCloser === charAfter;

      const deleteStart = state.caretPosition - 1;
      const deleteEnd = removePair ? state.caretPosition + 1 : state.caretPosition;

      return {
        ...state,
        typedValue: state.typedValue.slice(0, deleteStart) + state.typedValue.slice(deleteEnd),
        caretPosition: Math.max(0, state.caretPosition - 1),
        lastKeystrokeTime: now,
      };
    }

    case "RESET": {
      return { ...initialInputState };
    }

    case "COMPLETE": {
      return { ...state, isActive: false };
    }

    default: {
      return state;
    }
  }
}

function getPairedCloser(char: string): string | null {
  switch (char) {
    case "(":
      return ")";
    case "[":
      return "]";
    case "{":
      return "}";
    case '"':
      return '"';
    case "'":
      return "'";
    default:
      return null;
  }
}

export function isAfk(lastKeystrokeTime: number, thresholdMs = 10_000): boolean {
  if (!lastKeystrokeTime) {
    return false;
  }

  return Date.now() - lastKeystrokeTime > thresholdMs;
}
