"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  IconButton,
  Stack,
  Typography,
  Fade,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import CircularProgress from "@mui/material/CircularProgress";
import {
  CONCIERGE_NODES,
  CONCIERGE_ROOT,
  type ConciergeOption,
} from "@/lib/conciergeScript";

const HOTLINE_TEL = "+18555675323";
const HOTLINE_DISPLAY = "(855) 567-5323";
// Must match ESCALATE_MARKER in lib/ai/assistant.ts. Duplicated here as a
// plain literal so the client bundle never imports the server-only AI lib.
const ESCALATE_MARKER = "[[ESCALATE]]";

type Turn =
  | { kind: "bot"; text: string; options: ConciergeOption[] }
  | { kind: "user"; text: string }
  | { kind: "ai"; text: string; escalate: boolean; streaming: boolean; question: string };

/** Split a raw model reply into display text + whether it asked to escalate. */
function parseAiReply(raw: string): { display: string; escalate: boolean } {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(ESCALATE_MARKER)) {
    const rest = trimmed.slice(ESCALATE_MARKER.length);
    const nl = rest.indexOf("\n");
    return { display: (nl === -1 ? "" : rest.slice(nl + 1)).trim(), escalate: true };
  }
  return { display: raw, escalate: false };
}

/**
 * Render Beacon's reply with standard-looking links and **bold** emphasis.
 * Preferred form is markdown [Label](/dashboard/...): renders as a gold
 * link showing the LABEL (e.g. an expert's name), navigating in-app.
 * Bare /dashboard/... paths still linkify as a fallback.
 */
function renderRichText(text: string): React.ReactNode {
  // Tokens: [label](path) links, **bold** spans, bare portal paths.
  const re = /(\[[^\]\n]+\]\((?:\/dashboard|\/legal)[\w\-/]*\))|(\*\*[^*]+\*\*)|((?:\/dashboard|\/legal)[\w\-/]*)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  const link = (path: string, label: string) => (
    <Box
      key={`l${key++}`}
      component={Link}
      href={path}
      sx={{
        color: "#A07823",
        fontWeight: 700,
        textDecoration: "underline",
        textDecorationColor: "rgba(160,120,35,0.4)",
        textUnderlineOffset: "2px",
        "&:hover": { textDecorationColor: "#A07823" },
      }}
    >
      {label}
    </Box>
  );

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const close = m[1].indexOf("](");
      const label = m[1].slice(1, close);
      const path = m[1].slice(close + 2, -1);
      out.push(link(path, label));
    } else if (m[2]) {
      const inner = m[2].slice(2, -2);
      if (inner.startsWith("/dashboard") || inner.startsWith("/legal")) {
        out.push(link(inner, inner));
      } else {
        out.push(
          <Box key={`b${key++}`} component="strong" sx={{ fontWeight: 700 }}>
            {inner}
          </Box>,
        );
      }
    } else if (m[3]) {
      out.push(link(m[3], m[3]));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * MemberAssistant — "Beacon", the guided expert for the member portal.
 *
 * It's a button-driven option tree (no LLM, no backend) defined in
 * lib/conciergeScript.ts. Each turn the bot shows a message + a row of
 * buttons; tapping one either branches to another node OR opens a deep
 * link (kit page, hotline tel:, mailto:, etc.).
 *
 * A node stack tracks the menu depth so members can step back one level
 * at a time with the header Back button (no dead-end forward-only tree).
 *
 * Float bottom-right on every signed-in page (mounted from AppShell).
 */
export function MemberAssistant() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Turn[]>([
    { kind: "bot", text: CONCIERGE_ROOT.reply, options: CONCIERGE_ROOT.options },
  ]);
  // Menu depth — ids of the nodes we've stepped into. Drives the Back button.
  const [nodeStack, setNodeStack] = useState<string[]>([CONCIERGE_ROOT.id]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Keep the latest turn in view as new ones append.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [history, open]);

  const choose = (opt: ConciergeOption) => {
    // Record the choice as a "user" line so the thread reads naturally.
    setHistory((prev) => [...prev, { kind: "user", text: opt.label }]);
    if (opt.next) {
      const next = CONCIERGE_NODES[opt.next] ?? CONCIERGE_ROOT;
      setNodeStack((prev) => [...prev, next.id]);
      // Tiny pause so the typing rhythm doesn't feel instant.
      window.setTimeout(() => {
        setHistory((prev) => [
          ...prev,
          { kind: "bot", text: next.reply, options: next.options },
        ]);
      }, 220);
    }
    // For `href` options the Link handles navigation; nothing more to do.
  };

  // Step back one menu level and re-show the parent's options as a fresh,
  // interactive turn (only the latest turn's options are clickable).
  const back = () => {
    if (nodeStack.length <= 1) return;
    const newStack = nodeStack.slice(0, -1);
    const parentId = newStack[newStack.length - 1]!;
    const parent = CONCIERGE_NODES[parentId] ?? CONCIERGE_ROOT;
    setNodeStack(newStack);
    setHistory((prev) => [
      ...prev,
      { kind: "user", text: "← Back" },
      { kind: "bot", text: parent.reply, options: parent.options },
    ]);
  };

  const reset = () => {
    setNodeStack([CONCIERGE_ROOT.id]);
    setHistory([
      { kind: "bot", text: CONCIERGE_ROOT.reply, options: CONCIERGE_ROOT.options },
    ]);
  };

  // ─── Free-text "Ask Beacon" (AI) ─────────────────────────────────────
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Grow the textarea with its content (up to the CSS maxHeight).
  const autosize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // ─── Voice dictation (Web Speech API — Chrome/Edge/Safari) ──────────
  // Requires a secure context (https or localhost) and mic permission.
  // Chrome's recognizer is cloud-backed, so it also needs to be online.
  type SpeechRecognitionLike = {
    start: () => void;
    stop: () => void;
    abort?: () => void;
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult:
      | ((e: {
          resultIndex: number;
          results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
        }) => void)
      | null;
    onend: (() => void) | null;
    onerror: ((e: { error?: string }) => void) | null;
  };
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setVoiceSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition) && window.isSecureContext);
  }, []);

  // These fire AFTER the getUserMedia pre-flight succeeded, so the mic
  // itself is fine — a not-allowed here means the browser's cloud speech
  // service refused (Brave/Arc strip it; only Chrome, Edge, Safari work).
  const VOICE_ERROR_TEXT: Record<string, string> = {
    "not-allowed": "Mic is fine, but this browser's speech service refused, voice input only works in Chrome, Edge, or Safari.",
    "service-not-allowed": "This browser's speech service is unavailable, voice input only works in Chrome, Edge, or Safari.",
    "language-not-supported": "This browser's speech service doesn't support the language, try Chrome or Edge.",
    "audio-capture": "No microphone found, plug one in or check your input device.",
    network: "Voice needs an internet connection to Google's speech service, check your network and retry.",
    "no-speech": "Didn't catch that, tap the mic and speak again.",
    aborted: "",
  };

  const toggleVoice = async () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    setVoiceError(null);
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError("Voice input isn't supported in this browser, try Chrome, Edge, or Safari.");
      return;
    }
    // Pre-flight: grab the mic directly. This forces a real permission
    // prompt when needed and separates "no mic / OS blocked" from
    // "speech service unavailable" — SpeechRecognition alone reports
    // everything as a generic not-allowed.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        setVoiceError("No microphone detected, plug one in or enable it in Windows sound settings.");
      } else if (name === "NotAllowedError" || name === "SecurityError") {
        setVoiceError("Windows or the browser is blocking the mic. Check Windows Settings → Privacy & security → Microphone → allow desktop apps.");
      } else if (name === "NotReadableError") {
        setVoiceError("Another app is using the microphone, close it and try again.");
      } else {
        setVoiceError("Couldn't access the microphone, you can type instead.");
      }
      return;
    }
    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onresult = (e) => {
        // Only consume results added since the last event — iterating the
        // whole list re-appends earlier finals as duplicates.
        let transcript = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]!;
          if (r.isFinal && r[0]) transcript += `${r[0].transcript} `;
        }
        if (transcript.trim()) {
          setInput((prev) => `${prev ? `${prev} ` : ""}${transcript.trim()}`);
          requestAnimationFrame(autosize);
        }
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e) => {
        setListening(false);
        const msg = VOICE_ERROR_TEXT[e.error ?? ""] ?? `Voice input failed (${e.error ?? "unknown"}), you can type instead.`;
        if (msg) setVoiceError(msg);
      };
      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setVoiceError("Couldn't start voice input in this browser, you can type instead.");
    }
  };

  // Stop the mic if the panel closes mid-dictation.
  useEffect(() => {
    if (!open && listening) recognitionRef.current?.stop();
  }, [open, listening]);

  // Patch the most recent AI turn as the stream fills in.
  const updateLastAi = (patch: Partial<Extract<Turn, { kind: "ai" }>>) => {
    setHistory((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i]!.kind === "ai") {
          const next = prev.slice();
          next[i] = { ...(next[i] as Extract<Turn, { kind: "ai" }>), ...patch };
          return next;
        }
      }
      return prev;
    });
  };

  const send = async () => {
    const q = input.trim();
    if (!q || sending) return;
    if (listening) recognitionRef.current?.stop();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setSending(true);
    setHistory((prev) => [
      ...prev,
      { kind: "user", text: q },
      { kind: "ai", text: "", escalate: false, streaming: true, question: q },
    ]);

    try {
      const res = await fetch("/api/member/assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: q }),
      });

      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        updateLastAi({
          text: j.error || `Beacon is unavailable right now. Try the hotline at ${HOTLINE_DISPLAY}.`,
          streaming: false,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const { display, escalate } = parseAiReply(raw);
        updateLastAi({ text: display, escalate, streaming: true });
      }
      const final = parseAiReply(raw);
      updateLastAi({ text: final.display, escalate: final.escalate, streaming: false });
    } catch {
      updateLastAi({
        text: `Something went wrong. You can reach the team on the hotline at ${HOTLINE_DISPLAY}.`,
        streaming: false,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <Box
          component="button"
          type="button"
          onClick={() => setOpen(true)}
          sx={{
            all: "unset",
            position: "fixed",
            right: { xs: 16, md: 24 },
            bottom: { xs: 16, md: 24 },
            zIndex: 1200,
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 1.75,
            py: 1.1,
            borderRadius: 999,
            bgcolor: "#0A1A2F",
            color: "#FFFFFF",
            cursor: "pointer",
            fontSize: "0.86rem",
            fontWeight: 700,
            boxShadow: "0 12px 32px -12px rgba(14,42,61,0.55)",
            transition: "transform 200ms ease, background-color 200ms ease",
            "&:hover": { bgcolor: "#0F2540", transform: "translateY(-2px)" },
            "&:focus-visible": { outline: "2px solid var(--gold, #F0C16E)", outlineOffset: 3 },
          }}
        >
          <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: "#F0C16E" }} />
          Ask Beacon
        </Box>
      )}

      {/* Panel */}
      <Fade in={open} unmountOnExit>
        <Box
          sx={{
            position: "fixed",
            right: { xs: 0, md: 24 },
            bottom: { xs: 0, md: 24 },
            zIndex: 1300,
            width: { xs: "100vw", md: 420 },
            height: { xs: "100dvh", md: 580 },
            display: "flex",
            flexDirection: "column",
            bgcolor: "#FFFFFF",
            borderRadius: { xs: 0, md: 3 },
            border: { md: "1px solid rgba(14,42,61,0.08)" },
            boxShadow: "0 32px 64px -24px rgba(14,42,61,0.4)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1.5,
              bgcolor: "#0A1A2F",
              color: "#FFFFFF",
              flexShrink: 0,
            }}
          >
            {nodeStack.length > 1 && (
              <IconButton
                aria-label="Back"
                onClick={back}
                size="small"
                sx={{
                  color: "rgba(255,255,255,0.85)",
                  mr: 0.25,
                  "&:hover": { color: "#FFFFFF", bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                bgcolor: "rgba(217,168,75,0.18)",
                color: "#F0C16E",
                display: "grid",
                placeItems: "center",
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, lineHeight: 1 }}>
                Beacon
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", mt: 0.25 }}>
                Your ASN guide: answers or the hotline
              </Typography>
            </Box>
            <IconButton
              aria-label="Start over"
              onClick={reset}
              size="small"
              sx={{
                color: "rgba(255,255,255,0.7)",
                "&:hover": { color: "#FFFFFF", bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              <RefreshRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              aria-label="Close"
              onClick={() => setOpen(false)}
              size="small"
              sx={{
                color: "rgba(255,255,255,0.7)",
                "&:hover": { color: "#FFFFFF", bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              <CloseRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>

          {/* Conversation scroller */}
          <Box
            ref={scrollerRef}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              bgcolor: "#FBF8F1",
              px: 2,
              py: 2,
            }}
          >
            <Stack spacing={1.5}>
              {history.map((turn, i) => {
                if (turn.kind === "user") return <UserTurn key={i} text={turn.text} />;
                if (turn.kind === "ai") return <AiTurn key={i} turn={turn} />;
                return (
                  <BotTurn
                    key={i}
                    text={turn.text}
                    options={turn.options}
                    onChoose={choose}
                    isLatest={i === history.length - 1}
                  />
                );
              })}
            </Stack>
          </Box>

          {/* Ask Beacon — free-text input */}
          <Box
            sx={{
              px: 1.5,
              py: 1.25,
              borderTop: "1px solid rgba(14,42,61,0.06)",
              bgcolor: "#FFFFFF",
              flexShrink: 0,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "flex-end",
                bgcolor: "#F4F1EA",
                border: "1px solid rgba(14,42,61,0.1)",
                borderRadius: 2.5,
                px: 1.25,
                py: 0.5,
                "&:focus-within": { borderColor: "#A07823" },
              }}
            >
              <Box
                component="textarea"
                ref={inputRef}
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setInput(e.target.value);
                  autosize();
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={listening ? "Listening… speak your question" : "Ask Beacon anything…"}
                rows={1}
                disabled={sending}
                sx={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  resize: "none",
                  bgcolor: "transparent",
                  fontFamily: "inherit",
                  fontSize: "0.86rem",
                  color: "#0A1A2F",
                  lineHeight: 1.5,
                  py: 0.75,
                  maxHeight: 120,
                  overflowY: "auto",
                  "&::placeholder": { color: listening ? "#A07823" : "#9AA4AE" },
                }}
              />
              {voiceSupported && (
                <IconButton
                  aria-label={listening ? "Stop dictation" : "Speak your question"}
                  onClick={toggleVoice}
                  disabled={sending}
                  size="small"
                  sx={{
                    mb: 0.25,
                    color: listening ? "#B4232B" : "#7A8590",
                    bgcolor: listening ? "rgba(180,35,43,0.1)" : "transparent",
                    "&:hover": { color: listening ? "#B4232B" : "#0A1A2F", bgcolor: listening ? "rgba(180,35,43,0.14)" : "rgba(14,42,61,0.06)" },
                  }}
                >
                  {listening ? <StopRoundedIcon sx={{ fontSize: 18 }} /> : <MicRoundedIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              )}
              <IconButton
                aria-label="Send"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                size="small"
                sx={{
                  bgcolor: "#0A1A2F",
                  color: "#FFFFFF",
                  mb: 0.25,
                  "&:hover": { bgcolor: "#13294A" },
                  "&.Mui-disabled": { bgcolor: "rgba(14,42,61,0.18)", color: "#FFFFFF" },
                }}
              >
                {sending ? <CircularProgress size={16} sx={{ color: "#FFFFFF" }} /> : <SendRoundedIcon sx={{ fontSize: 17 }} />}
              </IconButton>
            </Stack>
            {voiceError && (
              <Typography sx={{ fontSize: "0.7rem", color: "#B4232B", mt: 0.6, textAlign: "center" }}>
                {voiceError}
              </Typography>
            )}
            <Typography sx={{ fontSize: "0.66rem", color: "#9AA4AE", mt: 0.6, textAlign: "center" }}>
              Prefer a person? Hotline{" "}
              <Box component="a" href={`tel:${HOTLINE_TEL}`} sx={{ color: "#A07823", fontWeight: 700, textDecoration: "none" }}>
                {HOTLINE_DISPLAY}
              </Box>
            </Typography>
          </Box>
        </Box>
      </Fade>
    </>
  );
}

function BotTurn({
  text,
  options,
  onChoose,
  isLatest,
}: {
  text: string;
  options: ConciergeOption[];
  onChoose: (o: ConciergeOption) => void;
  isLatest: boolean;
}) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          bgcolor: "rgba(217,168,75,0.18)",
          color: "#A07823",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            bgcolor: "#FFFFFF",
            border: "1px solid rgba(14,42,61,0.08)",
            borderRadius: 2,
            px: 1.5,
            py: 1.25,
            boxShadow: "0 1px 0 rgba(14,42,61,0.02)",
          }}
        >
          <Typography sx={{ fontSize: "0.88rem", color: "#0A1A2F", lineHeight: 1.55 }}>
            {text}
          </Typography>
        </Box>
        {isLatest && options.length > 0 && (
          <Stack direction="column" spacing={0.75} sx={{ mt: 1.25 }}>
            {options.map((opt, idx) => (
              <OptionButton key={`${opt.label}-${idx}`} option={opt} onChoose={onChoose} />
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function UserTurn({ text }: { text: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
      <Box
        sx={{
          bgcolor: "#0A1A2F",
          color: "#FFFFFF",
          borderRadius: 2,
          px: 1.5,
          py: 1,
          maxWidth: "78%",
        }}
      >
        <Typography sx={{ fontSize: "0.85rem", lineHeight: 1.4, color: "#FFFFFF", fontWeight: 500 }}>{text}</Typography>
      </Box>
    </Stack>
  );
}

/** A free-text answer from Beacon, with a hand-off card when it escalates. */
function AiTurn({ turn }: { turn: Extract<Turn, { kind: "ai" }> }) {
  const showTyping = turn.streaming && turn.text.length === 0;
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          bgcolor: "rgba(217,168,75,0.18)",
          color: "#A07823",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {(turn.text.length > 0 || showTyping) && (
          <Box
            sx={{
              bgcolor: "#FFFFFF",
              border: "1px solid rgba(14,42,61,0.08)",
              borderRadius: 2,
              px: 1.5,
              py: 1.25,
              boxShadow: "0 1px 0 rgba(14,42,61,0.02)",
            }}
          >
            {showTyping ? (
              <Typography sx={{ fontSize: "0.88rem", color: "#7A8590", lineHeight: 1.55 }}>
                Beacon is thinking…
              </Typography>
            ) : (
              <Typography sx={{ fontSize: "0.88rem", color: "#0A1A2F", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {renderRichText(turn.text)}
              </Typography>
            )}
          </Box>
        )}
        {turn.escalate && !turn.streaming && <EscalationCard question={turn.question} />}
      </Box>
    </Stack>
  );
}

function EscalationCard({ question }: { question: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const fileInquiry = async () => {
    if (status === "sending" || status === "done") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/member/pearl/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <Box sx={{ mt: 1.25, bgcolor: "rgba(34,108,78,0.08)", border: "1px solid rgba(34,108,78,0.25)", borderRadius: 2, px: 1.5, py: 1.25 }}>
        <Typography sx={{ fontSize: "0.82rem", color: "#1F5C40", lineHeight: 1.5, fontWeight: 600 }}>
          Done. The team will get back to you within 2 to 3 business days.
        </Typography>
        <Typography sx={{ fontSize: "0.78rem", color: "#3B4A55", lineHeight: 1.5, mt: 0.5 }}>
          Keep an eye on your inbox. We&apos;ll send everything ASN offers your way.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1.25 }}>
      <Stack direction="column" spacing={0.75}>
        <Box
          component="a"
          href={`tel:${HOTLINE_TEL}`}
          sx={{ textDecoration: "none" }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              bgcolor: "#0A1A2F",
              color: "#FFFFFF",
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
              cursor: "pointer",
              transition: "background-color 160ms ease",
              "&:hover": { bgcolor: "#13294A" },
            }}
          >
            <CallRoundedIcon sx={{ fontSize: 16, color: "#F0C16E" }} />
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#FFFFFF" }}>Call the hotline: {HOTLINE_DISPLAY}</Typography>
          </Stack>
        </Box>

        <Box
          role="button"
          tabIndex={0}
          onClick={fileInquiry}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void fileInquiry();
            }
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "#FFFFFF",
              color: "#0A1A2F",
              border: "1px solid rgba(14,42,61,0.14)",
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
              cursor: "pointer",
              transition: "background-color 160ms ease, border-color 160ms ease",
              "&:hover": { bgcolor: "#FBF3E2", borderColor: "#A07823" },
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
              <MarkEmailReadRoundedIcon sx={{ fontSize: 16, color: "#A07823" }} />
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {status === "sending" ? "Sending…" : "Have the team email me"}
              </Typography>
            </Stack>
            {status === "sending" && <CircularProgress size={14} sx={{ color: "#A07823" }} />}
          </Stack>
        </Box>

        {status === "error" && (
          <Typography sx={{ fontSize: "0.74rem", color: "#B4232B", pl: 0.5 }}>
            Couldn&apos;t send that. Try again, or call the hotline.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function OptionButton({
  option,
  onChoose,
}: {
  option: ConciergeOption;
  onChoose: (o: ConciergeOption) => void;
}) {
  const primary = option.tone === "primary";
  const isExternal =
    !!option.href && (option.href.startsWith("http") || option.href.startsWith("tel:") || option.href.startsWith("mailto:"));

  const inner = (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        justifyContent: "space-between",
        bgcolor: primary ? "#0A1A2F" : "#FFFFFF",
        color: primary ? "#FFFFFF" : "#0A1A2F",
        border: `1px solid ${primary ? "#0A1A2F" : "rgba(14,42,61,0.14)"}`,
        borderRadius: 1.5,
        px: 1.5,
        py: 1,
        cursor: "pointer",
        transition: "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
        // Hover keeps a light background with dark text (or dark bg + white
        // text for primary) so the label always stays readable.
        "&:hover": {
          bgcolor: primary ? "#13294A" : "#FBF3E2",
          color: primary ? "#FFFFFF" : "#0A1A2F",
          borderColor: "#A07823",
          transform: "translateY(-1px)",
        },
      }}
    >
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: "inherit" }}>
        {option.label}
      </Typography>
      <ArrowForwardRoundedIcon sx={{ fontSize: 14, color: primary ? "#F0C16E" : "#A07823" }} />
    </Stack>
  );

  if (option.href) {
    if (isExternal) {
      return (
        <Box
          component="a"
          href={option.href}
          onClick={() => onChoose(option)}
          sx={{ textDecoration: "none" }}
        >
          {inner}
        </Box>
      );
    }
    return (
      <Box
        component={Link}
        href={option.href}
        onClick={() => onChoose(option)}
        sx={{ textDecoration: "none" }}
      >
        {inner}
      </Box>
    );
  }
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => onChoose(option)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChoose(option);
        }
      }}
    >
      {inner}
    </Box>
  );
}

// Keep the empty-state launcher icon import alive even if we ever drop the
// launcher floating button — also used by other portals.
export { ChatBubbleRoundedIcon as ConciergeIcon };
