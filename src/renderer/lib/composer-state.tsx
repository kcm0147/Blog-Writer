import { createContext, useContext, useState, ReactNode } from "react";
import type { ImageInput, PostType, Tone } from "@shared/types";
import type { GenerateOutcome } from "@shared/api";

type Phase = "idle" | "validation" | "loading" | "result" | "error";

interface ComposerState {
  // form fields
  postType: PostType;
  postTypeExtra: string;
  storeName: string;
  address: string;
  visitDate: string;
  length: number;
  tone: Tone;
  title: string;
  keywords: string[];
  keywordDraft: string;
  emphasis: string;
  memo: string;
  images: ImageInput[];

  // flow/result state
  currentDraftId: string | null;
  draftSavedAt: Date | null;
  phase: Phase;
  showValidation: boolean;
  outcome: GenerateOutcome | null;
  errorMessage: string | null;

  // actions
  setPostType: (v: PostType) => void;
  setPostTypeExtra: (v: string) => void;
  setStoreName: (v: string) => void;
  setAddress: (v: string) => void;
  setVisitDate: (v: string) => void;
  setLength: (v: number) => void;
  setTone: (v: Tone) => void;
  setTitle: (v: string) => void;
  setKeywords: (v: string[] | ((prev: string[]) => string[])) => void;
  setKeywordDraft: (v: string) => void;
  setEmphasis: (v: string) => void;
  setMemo: (v: string) => void;
  setImages: (v: ImageInput[] | ((prev: ImageInput[]) => ImageInput[])) => void;
  setCurrentDraftId: (v: string | null) => void;
  setDraftSavedAt: (v: Date | null) => void;
  setPhase: (v: Phase) => void;
  setShowValidation: (v: boolean) => void;
  setOutcome: (v: GenerateOutcome | null) => void;
  setErrorMessage: (v: string | null) => void;
  reset: () => void;
}

const ComposerStateContext = createContext<ComposerState | undefined>(undefined);

export function ComposerStateProvider({ children }: { children: ReactNode }) {
  const [postType, setPostType] = useState<PostType>("맛집");
  const [postTypeExtra, setPostTypeExtra] = useState("");
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [length, setLength] = useState(1500);
  const [tone, setTone] = useState<Tone>("my_style");
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [emphasis, setEmphasis] = useState("");
  const [memo, setMemo] = useState("");
  const [images, setImages] = useState<ImageInput[]>([]);

  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [showValidation, setShowValidation] = useState(false);
  const [outcome, setOutcome] = useState<GenerateOutcome | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = () => {
    setPostType("맛집");
    setPostTypeExtra("");
    setStoreName("");
    setAddress("");
    setVisitDate("");
    setLength(1500);
    setTone("my_style");
    setTitle("");
    setKeywords([]);
    setKeywordDraft("");
    setEmphasis("");
    setMemo("");
    setImages([]);
    setCurrentDraftId(null);
    setDraftSavedAt(null);
    setPhase("idle");
    setShowValidation(false);
    setOutcome(null);
    setErrorMessage(null);
  };

  const value: ComposerState = {
    postType, setPostType,
    postTypeExtra, setPostTypeExtra,
    storeName, setStoreName,
    address, setAddress,
    visitDate, setVisitDate,
    length, setLength,
    tone, setTone,
    title, setTitle,
    keywords, setKeywords,
    keywordDraft, setKeywordDraft,
    emphasis, setEmphasis,
    memo, setMemo,
    images, setImages,
    currentDraftId, setCurrentDraftId,
    draftSavedAt, setDraftSavedAt,
    phase, setPhase,
    showValidation, setShowValidation,
    outcome, setOutcome,
    errorMessage, setErrorMessage,
    reset,
  };

  return (
    <ComposerStateContext.Provider value={value}>
      {children}
    </ComposerStateContext.Provider>
  );
}

export function useComposerState() {
  const context = useContext(ComposerStateContext);
  if (!context) {
    throw new Error("useComposerState must be used within a ComposerStateProvider");
  }
  return context;
}
