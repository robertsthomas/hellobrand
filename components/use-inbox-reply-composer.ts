"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type RefObject
} from "react";
import { useCompletion } from "@ai-sdk/react";

import type {
  EmailThreadDetail,
  NegotiationStance
} from "@/lib/types";

type ReplyJourney = "idle" | "user_set" | "ai_set" | "ai_generated";

type DraftRevisionTarget = {
  subject: string;
  body: string;
};

type ReplyComposerState = {
  draft: { subject: string; body: string } | null;
  replySubject: string;
  replyBody: string;
  replyJourney: ReplyJourney;
  isDrafting: boolean;
  replyStance: NegotiationStance | "";
  isPromptCommandOpen: boolean;
  draftInstructions: string;
  openRefinementPopover: "length" | "tone" | "focus" | null;
};

type ReplyComposerAction =
  | { type: "reset_for_thread" }
  | {
      type: "load_saved_draft";
      draft: { subject: string; body: string; source: "manual" | "ai" };
    }
  | { type: "set_body_input"; value: string }
  | { type: "set_draft_instructions"; value: string }
  | { type: "set_prompt_command_open"; value: boolean }
  | { type: "set_reply_stance"; value: NegotiationStance | "" }
  | {
      type: "set_open_refinement_popover";
      value: "length" | "tone" | "focus" | null;
    }
  | { type: "apply_prompt"; instructions: string }
  | { type: "clear_prompt" }
  | { type: "prepare_prompt_use" }
  | { type: "start_draft"; subject: string; preserveBody: boolean }
  | { type: "finish_draft"; body: string; subject: string }
  | { type: "stream_progress"; value: string }
  | { type: "draft_failed" }
  | { type: "cancel_draft" }
  | { type: "clear_draft" }
  | { type: "close_prompt_after_draft" };

const initialState: ReplyComposerState = {
  draft: null,
  replySubject: "",
  replyBody: "",
  replyJourney: "idle",
  isDrafting: false,
  replyStance: "collaborative",
  isPromptCommandOpen: false,
  draftInstructions: "",
  openRefinementPopover: null
};

function stripReplySubjectHeader(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^\s*subject:\s*[^\n]*\n+/i, "")
    .trimStart();
}

function extractReplyBodyFromJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fencedMatch ? fencedMatch[1]!.trim() : trimmed;

  if (!candidate.startsWith("{") || !candidate.endsWith("}")) {
    return value;
  }

  try {
    const parsed = JSON.parse(candidate) as { body?: unknown };
    if (typeof parsed.body === "string" && parsed.body.trim()) {
      return parsed.body;
    }
  } catch {
    return value;
  }

  return value;
}

function normalizeGeneratedReply(value: string) {
  return stripReplySubjectHeader(extractReplyBodyFromJson(value))
    .replace(
      /\n{2,}I kept your note in mind:\s*[\s\S]*$/i,
      ""
    )
    .replace(
      /\n{2,}I kept (?:your|the) (?:note|prompt|instruction)s? in mind:\s*[\s\S]*$/i,
      ""
    )
    .trim();
}

function reducer(
  state: ReplyComposerState,
  action: ReplyComposerAction
): ReplyComposerState {
  switch (action.type) {
    case "reset_for_thread":
      return {
        ...state,
        draft: null,
        replySubject: "",
        replyBody: "",
        replyJourney: "idle",
        isDrafting: false,
        isPromptCommandOpen: false,
        draftInstructions: "",
        openRefinementPopover: null
      };
    case "load_saved_draft":
      return {
        ...state,
        draft: {
          subject: action.draft.subject,
          body: action.draft.body
        },
        replySubject: action.draft.subject,
        replyBody: action.draft.body,
        replyJourney: action.draft.source === "ai" ? "ai_generated" : "user_set",
        isDrafting: false,
        isPromptCommandOpen: false,
        draftInstructions: "",
        openRefinementPopover: null
      };
    case "set_body_input":
      if (state.replyJourney === "ai_set") {
        return {
          ...state,
          replyBody: action.value,
          draftInstructions: action.value
        };
      }

      if (state.replyJourney === "ai_generated") {
        return {
          ...state,
          draft: action.value.trim().length > 0 ? state.draft : null,
          replyBody: action.value,
          replyJourney: action.value.trim().length > 0 ? "user_set" : "idle"
        };
      }

      if (state.replyJourney === "idle" || state.replyJourney === "user_set") {
        return {
          ...state,
          replyBody: action.value,
          replyJourney: action.value.trim().length > 0 ? "user_set" : "idle"
        };
      }

      return {
        ...state,
        replyBody: action.value
      };
    case "set_draft_instructions":
      return {
        ...state,
        draftInstructions: action.value
      };
    case "set_prompt_command_open":
      return {
        ...state,
        isPromptCommandOpen: action.value
      };
    case "set_reply_stance":
      return {
        ...state,
        replyStance: action.value
      };
    case "set_open_refinement_popover":
      return {
        ...state,
        openRefinementPopover: action.value
      };
    case "apply_prompt":
      return {
        ...state,
        draft: null,
        replySubject: "",
        replyBody: action.instructions,
        replyJourney: "ai_set",
        isPromptCommandOpen: false
      };
    case "clear_prompt":
      return {
        ...state,
        draftInstructions: "",
        replyBody: state.replyJourney === "ai_set" ? "" : state.replyBody,
        replyJourney: state.replyJourney === "ai_set" ? "idle" : state.replyJourney,
        isPromptCommandOpen: false
      };
    case "prepare_prompt_use":
      return {
        ...state,
        draft: null,
        replySubject: "",
        replyBody: "",
        replyJourney: "idle",
        isPromptCommandOpen: false
      };
    case "start_draft":
      return {
        ...state,
        draft: {
          subject: action.subject,
          body: ""
        },
        replySubject: action.subject,
        replyBody: action.preserveBody ? state.replyBody : "",
        replyJourney: "ai_set",
        isDrafting: true,
        openRefinementPopover: null
      };
    case "finish_draft":
      return {
        ...state,
        draft: {
          subject: state.draft?.subject ?? action.subject,
          body: normalizeGeneratedReply(action.body)
        },
        isDrafting: false
      };
    case "stream_progress":
      return {
        ...state,
        replyBody: normalizeGeneratedReply(action.value),
        replyJourney: "ai_generated"
      };
    case "draft_failed":
      return {
        ...state,
        isDrafting: false
      };
    case "cancel_draft":
      return {
        ...state,
        isDrafting: false,
        replyJourney: state.replyBody.trim().length > 0 ? "ai_generated" : "idle"
      };
    case "clear_draft":
      return {
        ...state,
        draft: null,
        replySubject: "",
        replyBody: "",
        replyJourney: "idle",
        isDrafting: false,
        draftInstructions: "",
        isPromptCommandOpen: false,
        openRefinementPopover: null
      };
    case "close_prompt_after_draft":
      return {
        ...state,
        draftInstructions: "",
        isPromptCommandOpen: false
      };
    default:
      return state;
  }
}

type UseInboxReplyComposerOptions = {
  selectedDealId: string;
  selectedThread: EmailThreadDetail | null;
  setErrorMessage: (value: string | null) => void;
};

export function useInboxReplyComposer({
  selectedDealId,
  selectedThread,
  setErrorMessage
}: UseInboxReplyComposerOptions): {
  draft: ReplyComposerState["draft"];
  replySubject: string;
  replyBody: string;
  replyJourney: ReplyJourney;
  isDrafting: boolean;
  replyStance: NegotiationStance | "";
  isPromptCommandOpen: boolean;
  draftInstructions: string;
  openRefinementPopover: "length" | "tone" | "focus" | null;
  trimmedDraftInstructions: string;
  shouldHighlightAiReply: boolean;
  canRefineGeneratedReply: boolean;
  canClearReplyText: boolean;
  canSendReply: boolean;
  isSavingDraft: boolean;
  replyBodyRef: RefObject<HTMLTextAreaElement | null>;
  setReplyStance: (value: NegotiationStance | "") => void;
  setPromptCommandOpen: (value: boolean) => void;
  setDraftInstructions: (value: string) => void;
  setOpenRefinementPopover: (value: "length" | "tone" | "focus" | null) => void;
  handleReplyBodyChange: (value: string, element?: HTMLTextAreaElement | null) => void;
  applyPromptToNextDraft: () => void;
  clearPromptDialog: () => void;
  saveDraft: (status?: "in_progress" | "ready") => Promise<void>;
  draftReply: (
    overrideInstructions?: string | null,
    revisionTarget?: DraftRevisionTarget | null
  ) => Promise<void>;
  usePromptForDraft: (overrideInstructions?: string | null) => Promise<void>;
  cancelDraftReply: () => void;
  clearDraftComposer: () => void;
  refineGeneratedDraft: (instruction: string) => Promise<void>;
} {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const replyBodyRef = useRef<HTMLTextAreaElement | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const setCompletionRef = useRef<(value: string) => void>(() => {});
  const lastSavedSnapshotRef = useRef<string>("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const selectedThreadId = selectedThread?.thread.id ?? "";

  const {
    completion,
    complete,
    setCompletion,
    stop
  } = useCompletion({
    api: `/api/email/threads/${selectedThreadId || "__unselected__"}/draft`,
    streamProtocol: "text",
    onError: (error) => {
      setErrorMessage(error.message || "Could not generate reply draft.");
      dispatch({ type: "draft_failed" });
    },
    onFinish: (_prompt, nextCompletion) => {
      dispatch({
        type: "finish_draft",
        body: nextCompletion,
        subject: stateRef.current.replySubject
      });
    }
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    stopRef.current = stop;
    setCompletionRef.current = setCompletion;
  }, [setCompletion, stop]);

  const resizeReplyBody = useCallback(() => {
    const textarea = replyBodyRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(24, textarea.scrollHeight)}px`;
  }, []);

  const resetCompletionState = useCallback(() => {
    stop();
    setCompletion("");
  }, [setCompletion, stop]);

  useEffect(() => {
    stopRef.current();
    setCompletionRef.current("");
    dispatch({ type: "reset_for_thread" });
    const savedDraft = selectedThread?.savedDraft;
    if (savedDraft) {
      const snapshot = `${savedDraft.subject}\n${savedDraft.body}\n${savedDraft.status}\n${savedDraft.source}`;
      lastSavedSnapshotRef.current = snapshot;
      dispatch({
        type: "load_saved_draft",
        draft: {
          subject: savedDraft.subject,
          body: savedDraft.body,
          source: savedDraft.source
        }
      });
      return;
    }
    lastSavedSnapshotRef.current = "";
  }, [selectedThread, selectedThreadId]);

  useEffect(() => {
    if (!completion) {
      return;
    }

    dispatch({
      type: "stream_progress",
      value: completion
    });
  }, [completion]);

  useEffect(() => {
    resizeReplyBody();
  }, [resizeReplyBody, state.replyBody, state.replyJourney]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const handleReplyBodyChange = useCallback(
    (value: string, element?: HTMLTextAreaElement | null) => {
      if (element) {
        element.style.height = "0px";
        element.style.height = `${Math.max(24, element.scrollHeight)}px`;
      }

      dispatch({
        type: "set_body_input",
        value
      });
    },
    []
  );

  const applyPromptToNextDraft = useCallback(() => {
    const trimmedInstructions = stateRef.current.draftInstructions.trim();
    dispatch({
      type: "apply_prompt",
      instructions: trimmedInstructions
    });
    setErrorMessage(null);
  }, [setErrorMessage]);

  const clearPromptDialog = useCallback(() => {
    dispatch({ type: "clear_prompt" });
  }, []);

  const draftReply = useCallback(
    async (
      overrideInstructions?: string | null,
      revisionTarget?: DraftRevisionTarget | null
    ) => {
      if (!selectedThreadId) {
        return;
      }

      const currentState = stateRef.current;
      const trimmedInstructions =
        (overrideInstructions ??
          (currentState.replyJourney === "ai_set"
            ? currentState.replyBody
            : currentState.draftInstructions)).trim();
      const requestPrompt =
        trimmedInstructions ||
        revisionTarget?.body?.trim() ||
        selectedThread?.thread.subject?.trim() ||
        "Generate a creator email reply.";
      const nextSubject =
        revisionTarget?.subject?.trim() ||
        (selectedThread?.thread.subject.startsWith("Re:")
          ? selectedThread.thread.subject
          : `Re: ${selectedThread?.thread.subject ?? ""}`);

      dispatch({
        type: "start_draft",
        subject: nextSubject,
        preserveBody: Boolean(revisionTarget) || currentState.replyJourney === "ai_set"
      });
      setCompletion("");
      setErrorMessage(null);

      try {
        await complete(requestPrompt, {
          body: {
            dealId: selectedDealId || null,
            stance: currentState.replyStance || null,
            instructions: trimmedInstructions || null,
            currentDraft: revisionTarget ?? null
          }
        });
        dispatch({ type: "close_prompt_after_draft" });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not generate reply draft."
        );
        dispatch({ type: "draft_failed" });
      }
    },
    [
      complete,
      selectedDealId,
      selectedThread,
      selectedThreadId,
      setCompletion,
      setErrorMessage
    ]
  );

  const usePromptForDraft = useCallback(async (overrideInstructions?: string | null) => {
    const currentInstructions = overrideInstructions ?? stateRef.current.draftInstructions;
    dispatch({ type: "prepare_prompt_use" });
    await draftReply(currentInstructions);
  }, [draftReply]);

  const cancelDraftReply = useCallback(() => {
    stop();
    dispatch({ type: "cancel_draft" });
  }, [stop]);

  const clearDraftComposer = useCallback(() => {
    resetCompletionState();
    dispatch({ type: "clear_draft" });
  }, [resetCompletionState]);

  const saveDraft = useCallback(
    async (status: "in_progress" | "ready" = "in_progress") => {
      if (!selectedThreadId) {
        return;
      }

      const currentState = stateRef.current;
      const fallbackSubject =
        selectedThread?.thread.subject
          ? (selectedThread.thread.subject.startsWith("Re:")
              ? selectedThread.thread.subject
              : `Re: ${selectedThread.thread.subject}`)
          : "";
      const subject = currentState.replySubject.trim() || fallbackSubject;
      const body = currentState.replyBody.trim();
      if (!subject || !body) {
        return;
      }

      const source = currentState.replyJourney === "ai_generated" ? "ai" : "manual";
      const snapshot = `${subject}\n${body}\n${status}\n${source}`;
      if (lastSavedSnapshotRef.current === snapshot) {
        return;
      }

      setIsSavingDraft(true);
      try {
        const response = await fetch(`/api/email/threads/${selectedThreadId}/draft`, {
          method: "PUT",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            subject,
            body,
            status,
            source
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not save draft.");
        }
        lastSavedSnapshotRef.current = snapshot;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not save draft.");
      } finally {
        setIsSavingDraft(false);
      }
    },
    [selectedThread, selectedThreadId, setErrorMessage]
  );

  const refineGeneratedDraft = useCallback(
    async (instruction: string) => {
      const currentState = stateRef.current;
      if (
        currentState.replyJourney !== "ai_generated" ||
        currentState.replyBody.trim().length === 0
      ) {
        return;
      }

      await draftReply(instruction, {
        subject: currentState.replySubject,
        body: currentState.replyBody
      });
    },
    [draftReply]
  );

  return {
    draft: state.draft,
    replySubject: state.replySubject,
    replyBody: state.replyBody,
    replyJourney: state.replyJourney,
    isDrafting: state.isDrafting,
    replyStance: state.replyStance,
    isPromptCommandOpen: state.isPromptCommandOpen,
    draftInstructions: state.draftInstructions,
    openRefinementPopover: state.openRefinementPopover,
    trimmedDraftInstructions: state.draftInstructions.trim(),
    shouldHighlightAiReply:
      state.replyJourney === "ai_set" && !state.isDrafting,
    canRefineGeneratedReply:
      state.replyJourney === "ai_generated" &&
      state.replyBody.trim().length > 0 &&
      !state.isDrafting,
    canClearReplyText: state.replyBody.trim().length > 0,
    canSendReply:
      !state.isDrafting &&
      state.replyBody.trim().length > 0 &&
      (state.replyJourney === "user_set" || state.replyJourney === "ai_generated"),
    isSavingDraft,
    replyBodyRef,
    setReplyStance: (value) =>
      dispatch({
        type: "set_reply_stance",
        value
      }),
    setPromptCommandOpen: (value) =>
      dispatch({
        type: "set_prompt_command_open",
        value
      }),
    setDraftInstructions: (value) =>
      dispatch({
        type: "set_draft_instructions",
        value
      }),
    setOpenRefinementPopover: (value) =>
      dispatch({
        type: "set_open_refinement_popover",
        value
      }),
    handleReplyBodyChange,
    applyPromptToNextDraft,
    clearPromptDialog,
    saveDraft,
    draftReply,
    usePromptForDraft,
    cancelDraftReply,
    clearDraftComposer,
    refineGeneratedDraft
  };
}
