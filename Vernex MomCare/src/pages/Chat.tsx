import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, Info, Mic, Send, Sparkles, Square, Stethoscope, User } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_BASE } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSpeechRecognition, type VoiceLanguage } from '@/hooks/useSpeechRecognition';
import {
  createAISession,
  deleteAISession,
  fetchAIHistory,
  fetchAISessions,
  renameAISession,
  sendToAI,
} from '@/lib/aiChat';
import { fetchThread, sendDoctorMessage } from '@/lib/doctorChat';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';
import { SPEECH_EVENT_NAME, speakResponse, stopSpeaking } from '@/utils/speechSynthesis';

const mergeVoiceTranscript = (baseText: string, transcript: string) => {
  if (!baseText) return transcript;
  if (!transcript) return baseText;
  return `${baseText}${baseText.endsWith(' ') ? '' : ' '}${transcript}`;
};

type ChatInputMode = 'text' | 'voice';
type SessionSummary = {
  id: string;
  lastMessage: string;
  lastAt: string;
  createdAt?: string;
  title?: string;
};

const VoiceActivity = ({
  mode,
  compact = false,
}: {
  mode: 'listening' | 'speaking';
  compact?: boolean;
}) => (
  <div className={cn('flex items-center gap-1.5', compact && 'gap-1')}>
    {[0, 1, 2, 3].map((index) => (
      <span
        key={`${mode}-${index}`}
        className={cn(
          'rounded-full bg-primary/70',
          compact ? 'w-0.5' : 'w-1',
          mode === 'listening' ? 'animate-pulse-soft' : 'animate-pulse'
        )}
        style={{
          height: compact ? `${8 + index * 2}px` : `${10 + index * 3}px`,
          animationDelay: `${index * 120}ms`,
          animationDuration: mode === 'listening' ? '1s' : '0.75s',
        }}
      />
    ))}
  </div>
);

export default function Chat() {
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const [activeTab, setActiveTab] = useState<'ai' | 'doctor'>('ai');
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [doctorMessages, setDoctorMessages] = useState<Message[]>([]);
  const [doctorPeerId, setDoctorPeerId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [titleMap, setTitleMap] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string>(() => {
    const existing = localStorage.getItem('vnx_chat_session');
    if (existing) return existing;
    const fresh = `s-${Date.now()}`;
    localStorage.setItem('vnx_chat_session', fresh);
    return fresh;
  });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionError, setSessionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const voiceLanguage: VoiceLanguage = 'en';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string>(sessionId);
  const voiceInputBaseRef = useRef('');
  const voicePauseTimeoutRef = useRef<number | null>(null);
  const lastSpokenAiMessageIdRef = useRef<string | null>(null);
  const shouldSpeakNextAiResponseRef = useRef(false);
  const {
    clearTranscript,
    error: speechRecognitionError,
    finalTranscript,
    isListening,
    isSupported: isSpeechRecognitionSupported,
    startListening,
    stopListening,
    transcript,
  } = useSpeechRecognition(voiceLanguage);

  const resolveDoctorId = (maybeDoctorId: unknown): string | null => {
    if (!maybeDoctorId) return null;
    if (typeof maybeDoctorId === 'string') return maybeDoctorId;
    if (
      typeof maybeDoctorId === 'object' &&
      maybeDoctorId !== null &&
      '_id' in maybeDoctorId &&
      typeof maybeDoctorId._id === 'string'
    ) {
      return maybeDoctorId._id;
    }
    return null;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, doctorMessages, activeTab]);

  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const handleSpeechStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: 'start' | 'end' }>).detail;
      setIsAiSpeaking(detail?.state === 'start');
    };

    window.addEventListener(SPEECH_EVENT_NAME, handleSpeechStateChange as EventListener);
    return () => {
      window.removeEventListener(SPEECH_EVENT_NAME, handleSpeechStateChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'ai' || !isListening) return;
    stopListening();
  }, [activeTab, isListening, stopListening]);

  useEffect(() => {
    if (activeTab !== 'ai') {
      setIsHistoryOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'ai') return;
    shouldSpeakNextAiResponseRef.current = false;
    stopSpeaking();
    setIsAiSpeaking(false);
    clearTranscript();
  }, [activeTab, clearTranscript]);

  useEffect(() => {
    if (activeTab !== 'ai' || !transcript) return;
    setInputValue(mergeVoiceTranscript(voiceInputBaseRef.current, transcript));
  }, [activeTab, transcript]);

  useEffect(() => {
    if (voicePauseTimeoutRef.current) {
      window.clearTimeout(voicePauseTimeoutRef.current);
      voicePauseTimeoutRef.current = null;
    }

    if (activeTab !== 'ai' || !isListening || !transcript) {
      return;
    }

    voicePauseTimeoutRef.current = window.setTimeout(() => {
      stopListening();
    }, 1250);

    return () => {
      if (voicePauseTimeoutRef.current) {
        window.clearTimeout(voicePauseTimeoutRef.current);
        voicePauseTimeoutRef.current = null;
      }
    };
  }, [activeTab, isListening, stopListening, transcript]);

  useEffect(() => {
    if (activeTab !== 'ai' || !finalTranscript || isTyping) {
      return;
    }

    void handleSendMessage(finalTranscript, 'voice');
  }, [activeTab, finalTranscript, isTyping]);

  useEffect(() => {
    const latestMessage = aiMessages[aiMessages.length - 1];

    if (
      activeTab !== 'ai' ||
      !latestMessage?.isAI ||
      isTyping ||
      latestMessage.id.includes('-ai-error')
    ) {
      return;
    }

    if (lastSpokenAiMessageIdRef.current === latestMessage.id) {
      return;
    }

    lastSpokenAiMessageIdRef.current = latestMessage.id;

    if (!shouldSpeakNextAiResponseRef.current) {
      return;
    }

    shouldSpeakNextAiResponseRef.current = false;
    speakResponse(latestMessage.content, voiceLanguage);
  }, [activeTab, aiMessages, isTyping]);

  useEffect(() => {
    if (!inputValue.trim()) return;
    stopSpeaking();
    setIsAiSpeaking(false);
    shouldSpeakNextAiResponseRef.current = false;
  }, [inputValue]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vnx_chat_titles');
      if (raw) setTitleMap(JSON.parse(raw));
    } catch {
      setTitleMap({});
    }
  }, []);

  const saveTitle = (sessionKey: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      setEditingSession(null);
      return;
    }

    renameAISession(sessionKey, trimmed)
      .then((session) => {
        setSessions((prev) =>
          prev.map((item) => (item.id === session._id ? { ...item, title: session.title } : item)),
        );
        setEditingSession(null);
      })
      .catch((err) => console.error('Rename session error:', err));
  };

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => {
      const title = (titleMap[session.id] || session.title || '').toLowerCase();
      return title.includes(query) || session.lastMessage.toLowerCase().includes(query);
    });
  }, [searchQuery, sessions, titleMap]);

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      if (!user?.id) return;
      setSessionError('');
      try {
        const list = await fetchAISessions(user.id);
        const mapped: SessionSummary[] = list.map((session) => ({
          id: session._id,
          title: session.title,
          lastMessage: session.lastMessage,
          lastAt: session.lastAt,
          createdAt: session.createdAt,
        }));
        if (!isMounted) return;
        setSessions(mapped);
        setSelectedSession((currentSelected) => {
          const nextSelected = currentSelected && mapped.some((session) => session.id === currentSelected)
            ? currentSelected
            : mapped[0]?.id ?? null;

          if (nextSelected) {
            setSessionId(nextSelected);
            localStorage.setItem('vnx_chat_session', nextSelected);
          } else {
            setSessionId('');
            setAiMessages([]);
            localStorage.removeItem('vnx_chat_session');
          }

          return nextSelected;
        });
      } catch (error) {
        console.error('AI sessions error:', error);
        if (isMounted) {
          setSessionError('Unable to load sessions. Please restart backend.');
        }
      }
    };

    void loadSessions();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!user?.id || !sessionId) {
        setAiMessages([]);
        return;
      }

      const requestedSession = sessionId;
      try {
        const history = await fetchAIHistory(user.id, sessionId);
        if (sessionRef.current !== requestedSession) return;
        const mapped = history.map((message) => ({
          id: message._id,
          content: message.content,
          senderId: message.role === 'assistant' ? 'ai' : user.id,
          senderType: message.role === 'assistant' ? 'ai' : 'user',
          timestamp: new Date(message.createdAt),
          isAI: message.role === 'assistant',
        })) as Message[];
        lastSpokenAiMessageIdRef.current = mapped[mapped.length - 1]?.id ?? null;
        setAiMessages(mapped);
      } catch (error) {
        console.error('AI history error:', error);
      }
    };

    void loadHistory();
  }, [sessionId, user?.id]);

  useEffect(() => {
    const loadDoctorPeer = async () => {
      if (!user?.id || user.role !== 'patient') return;

      const existing = resolveDoctorId((user as Record<string, unknown>)?.doctorId);
      if (existing) {
        setDoctorPeerId(existing);
        return;
      }

      try {
        let data: Record<string, unknown> | null = null;
        const byIdRes = await fetch(`${API_BASE}/api/auth/patient/${user.id}`);
        if (byIdRes.ok) {
          data = (await byIdRes.json()) as Record<string, unknown>;
        } else if (user.email) {
          const byEmailRes = await fetch(
            `${API_BASE}/api/auth/patient/by-email/${encodeURIComponent(user.email)}`,
          );
          if (byEmailRes.ok) {
            data = (await byEmailRes.json()) as Record<string, unknown>;
          }
        }

        const patient = data?.patient as Record<string, unknown> | undefined;
        if (data?.success && patient?.doctorId) {
          setDoctorPeerId(resolveDoctorId(patient.doctorId));
        }
      } catch (err) {
        console.error('Doctor peer load error:', err);
      }
    };

    void loadDoctorPeer();
  }, [user?.email, user?.id, user?.role]);

  useEffect(() => {
    const loadDoctorThread = async () => {
      if (!user?.id || !doctorPeerId) return;
      try {
        const thread = await fetchThread(user.id, doctorPeerId);
        const mapped: Message[] = thread.map((message) => ({
          id: message._id,
          content: message.content,
          senderId: message.senderId,
          senderType: message.senderId === user.id ? 'user' : 'doctor',
          timestamp: new Date(message.createdAt),
        }));
        setDoctorMessages(mapped);
      } catch (err) {
        console.error('Doctor thread error:', err);
      }
    };

    if (activeTab !== 'doctor') return;

    void loadDoctorThread();
    const intervalId = setInterval(() => {
      void loadDoctorThread();
    }, 4000);
    return () => clearInterval(intervalId);
  }, [activeTab, doctorPeerId, user?.id]);

  const handleSendMessage = async (
    messageOverride?: string,
    inputMode: ChatInputMode = 'text',
  ) => {
    const resolvedMessage = (messageOverride ?? inputValue).trim();

    if (!resolvedMessage) return;
    if (activeTab === 'doctor' && !doctorPeerId) return;

    if (inputMode === 'voice' && activeTab === 'ai') {
      shouldSpeakNextAiResponseRef.current = true;
    } else {
      shouldSpeakNextAiResponseRef.current = false;
      stopSpeaking();
      setIsAiSpeaking(false);
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content: resolvedMessage,
      senderId: user?.id || 'user',
      senderType: isDoctor ? 'doctor' : 'user',
      timestamp: new Date(),
    };

    if (activeTab === 'ai') {
      setAiMessages((prev) => [...prev, newMessage]);
    } else {
      setDoctorMessages((prev) => [...prev, newMessage]);
    }

    setInputValue('');
    clearTranscript();
    voiceInputBaseRef.current = '';

    if (activeTab === 'ai') {
      setIsTyping(true);
      try {
        if (!user?.id) {
          throw new Error('User not found. Please log in again.');
        }

        const reply = await sendToAI(resolvedMessage, user.id, sessionId);
        const aiResponse: Message = {
          id: `msg-${Date.now()}-ai`,
          content: reply,
          senderId: 'ai',
          senderType: 'ai',
          timestamp: new Date(),
          isAI: true,
        };
        setAiMessages((prev) => [...prev, aiResponse]);
      } catch (error) {
        const aiError: Message = {
          id: `msg-${Date.now()}-ai-error`,
          content: error instanceof Error ? error.message : 'AI failed. Please try again.',
          senderId: 'ai',
          senderType: 'ai',
          timestamp: new Date(),
          isAI: true,
        };
        setAiMessages((prev) => [...prev, aiError]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    if (!user?.id || !doctorPeerId) return;
    try {
      const sent = await sendDoctorMessage(user.id, doctorPeerId, resolvedMessage);
      setDoctorMessages((prev) =>
        prev.map((message) =>
          message.id === newMessage.id
            ? { ...message, id: sent._id, timestamp: new Date(sent.createdAt) }
            : message,
        ),
      );
    } catch (error) {
      console.error('Doctor chat send error:', error);
    }
  };

  const startNewChat = () => {
    if (!user?.id) return;
    createAISession(user.id, 'New chat')
      .then((session) => {
        localStorage.setItem('vnx_chat_session', session._id);
        setSessionId(session._id);
        setSelectedSession(session._id);
        setAiMessages([]);
        setIsTyping(false);
        setIsAiSpeaking(false);
        shouldSpeakNextAiResponseRef.current = false;
        stopSpeaking();
        lastSpokenAiMessageIdRef.current = null;
        setSessions((prev) => [
          {
            id: session._id,
            title: session.title,
            lastMessage: session.lastMessage,
            lastAt: session.lastAt,
            createdAt: session.createdAt,
          },
          ...prev,
        ]);
      })
      .catch((err) => console.error('Create session error:', err));
  };

  const handleDeleteSession = (id: string) => {
    deleteAISession(id)
      .then(() => {
        const remainingSessions = sessions.filter((session) => session.id !== id);
        setSessions(remainingSessions);
        setTitleMap((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          localStorage.setItem('vnx_chat_titles', JSON.stringify(next));
          return next;
        });

        if (sessionId === id) {
          const nextSessionId = remainingSessions[0]?.id ?? null;
          setSelectedSession(nextSessionId);
          setSessionId(nextSessionId ?? '');
          setIsAiSpeaking(false);
          shouldSpeakNextAiResponseRef.current = false;
          stopSpeaking();
          lastSpokenAiMessageIdRef.current = null;
          if (nextSessionId) {
            localStorage.setItem('vnx_chat_session', nextSessionId);
          } else {
            setAiMessages([]);
            localStorage.removeItem('vnx_chat_session');
          }
        }
      })
      .catch((err) => console.error('Delete session error:', err));
  };

  const handleVoiceInputToggle = () => {
    if (!isSpeechRecognitionSupported || activeTab !== 'ai') return;

    if (isListening) {
      stopListening();
      return;
    }

    stopSpeaking();
    setIsAiSpeaking(false);
    shouldSpeakNextAiResponseRef.current = false;
    voiceInputBaseRef.current = inputValue;
    clearTranscript();
    startListening();
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Chat</h1>
          <p className="text-muted-foreground">
            {isDoctor
              ? 'Communicate with your patients'
              : 'Get support from AI or your doctor'}
          </p>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-0 border-b">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'ai' | 'doctor')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Thozhi
                </TabsTrigger>
                <TabsTrigger value="doctor" className="gap-2">
                  <Stethoscope className="h-4 w-4" />
                  {isDoctor ? 'Patient Chat' : 'Doctor Chat'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          {activeTab === 'ai' && (
            <div className="flex items-center gap-2 bg-info/10 border-b border-info/20 px-4 py-2">
              <Info className="h-4 w-4 text-info shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Thozhi</span> - This assistant does
                not replace professional medical advice.
              </p>
            </div>
          )}

          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="relative h-full flex overflow-hidden">
              {activeTab === 'ai' && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className={cn(
                      'absolute top-4 z-40 h-10 w-10 rounded-full bg-background shadow-md transition-all duration-300',
                      isHistoryOpen ? 'left-[18.75rem]' : 'left-4'
                    )}
                    onClick={() => setIsHistoryOpen((current) => !current)}
                    aria-label={isHistoryOpen ? 'Hide history' : 'Show history'}
                  >
                    {isHistoryOpen ? (
                      <ChevronLeft className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>

                  <aside
                    className={cn(
                      'absolute inset-y-0 left-0 z-30 w-80 border-r bg-background shadow-xl flex flex-col overflow-hidden transform-gpu transition-all duration-300 ease-out',
                      isHistoryOpen
                        ? 'translate-x-0 opacity-100 pointer-events-auto'
                        : '-translate-x-full opacity-0 pointer-events-none'
                    )}
                  >
                  <div className="px-5 py-5 border-b bg-background/70">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl font-semibold text-foreground">History</p>
                        <p className="text-xs text-muted-foreground">Your Thozhi chats by session</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-full px-4 text-sm"
                        onClick={startNewChat}
                      >
                        New chat
                      </Button>
                    </div>
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search chats..."
                      className="mt-4 h-10 rounded-2xl bg-background text-sm"
                    />
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-3 overflow-x-auto touch-pan-x overscroll-x-contain">
                      {filteredSessions.length === 0 && (
                        <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                          {sessionError || 'No sessions yet'}
                        </div>
                      )}

                      {filteredSessions.map((session) => {
                        const title =
                          titleMap[session.id] ||
                          session.title ||
                          `Chat ${new Date(session.createdAt || session.lastAt).toLocaleDateString()}`;

                        const isSelected = selectedSession === session.id;

                        return (
                          <div
                            key={session.id}
                            className={cn(
                              'min-w-[20rem] rounded-3xl border px-4 py-4 transition-colors',
                              isSelected
                                ? 'border-primary/25 bg-primary/5 shadow-sm'
                                : 'border-border/80 bg-background',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                {editingSession === session.id ? (
                                  <input
                                    autoFocus
                                    className="w-full rounded-xl border border-primary/30 bg-background px-3 py-2 text-sm font-semibold outline-none"
                                    defaultValue={title}
                                    onBlur={(event) => saveTitle(session.id, event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        saveTitle(
                                          session.id,
                                          (event.target as HTMLInputElement).value,
                                        );
                                      }
                                      if (event.key === 'Escape') {
                                        setEditingSession(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="w-full text-left"
                                    onClick={() => {
                                      setSelectedSession(session.id);
                                      setSessionId(session.id);
                                      localStorage.setItem('vnx_chat_session', session.id);
                                    }}
                                  >
                                    <div className="truncate text-base font-semibold text-foreground">
                                      {title}
                                    </div>
                                  </button>
                                )}
                                <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
                                  {session.lastMessage || 'Start a conversation with Thozhi'}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                                  onClick={() => setEditingSession(session.id)}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="text-[11px] font-medium text-red-500 transition-colors hover:text-red-600"
                                  onClick={() => handleDeleteSession(session.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  </aside>
                </>
              )}

              <div className="flex-1 flex flex-col min-h-0 relative z-10">
                <ScrollArea className="h-full p-4 flex-1">
                  <div className="space-y-4">
                    {activeTab === 'ai' && aiMessages.length <= 4 && (
                      <div className="text-center py-8 animate-fade-in">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
                          <Bot className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">Thozhi</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          I&apos;m here to help answer your pregnancy-related questions. Ask me
                          about nutrition, symptoms, exercise, or any other concerns.
                        </p>
                      </div>
                    )}

                    {(activeTab === 'ai' ? aiMessages : doctorMessages).map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-3 animate-fade-in',
                          message.senderType !== 'ai' && !isDoctor && message.senderType === 'user'
                            ? 'flex-row-reverse'
                            : '',
                          isDoctor && message.senderType === 'doctor' ? 'flex-row-reverse' : '',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                            message.isAI
                              ? 'bg-primary/10'
                              : message.senderType === 'doctor'
                                ? 'bg-info/10'
                                : 'bg-accent',
                          )}
                        >
                          {message.isAI ? (
                            <Bot className="h-4 w-4 text-primary" />
                          ) : message.senderType === 'doctor' ? (
                            <Stethoscope className="h-4 w-4 text-info" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 max-w-[75%]',
                            message.isAI
                              ? 'bg-primary/10 rounded-tl-sm'
                              : message.senderType === 'doctor'
                                ? isDoctor
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'bg-info/10 rounded-tl-sm'
                                : !isDoctor && message.senderType === 'user'
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'bg-accent rounded-tl-sm',
                          )}
                        >
                          <p className="text-[15px] leading-relaxed">{message.content}</p>
                          <p
                            className={cn(
                              'text-[10px] mt-1',
                              message.senderType === 'user' && !isDoctor
                                ? 'text-primary-foreground/70'
                                : isDoctor && message.senderType === 'doctor'
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {message.timestamp.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}

                    {isTyping && (
                      <div className="flex gap-3 animate-fade-in">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="rounded-2xl bg-primary/10 px-4 py-3 rounded-tl-sm">
                          <div className="flex gap-1">
                            <span className="h-2 w-2 rounded-full bg-primary/50 animate-pulse-soft" />
                            <span
                              className="h-2 w-2 rounded-full bg-primary/50 animate-pulse-soft"
                              style={{ animationDelay: '150ms' }}
                            />
                            <span
                              className="h-2 w-2 rounded-full bg-primary/50 animate-pulse-soft"
                              style={{ animationDelay: '300ms' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="border-t p-4">
                  {activeTab === 'doctor' && !doctorPeerId && !isDoctor && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      You don&apos;t have an assigned doctor yet.
                    </p>
                  )}

                  {activeTab === 'ai' && (isListening || isAiSpeaking) && (
                    <div className="mb-3 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-9 w-9 items-center justify-center">
                          <span className="absolute inline-flex h-9 w-9 rounded-full bg-primary/15 animate-ping" />
                          <span className="absolute inline-flex h-7 w-7 rounded-full bg-primary/20 animate-pulse" />
                          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-background text-primary shadow-sm">
                            {isListening ? <Mic className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {isListening ? 'Listening to you...' : 'Thozhi is replying...'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {isListening
                              ? 'Speak naturally. Your message will send when you pause.'
                              : 'Speech stops immediately if you start typing.'}
                          </p>
                        </div>
                      </div>
                      <VoiceActivity mode={isListening ? 'listening' : 'speaking'} />
                    </div>
                  )}

                  {activeTab === 'ai' && speechRecognitionError && (
                    <p className="mb-2 text-xs text-destructive">{speechRecognitionError}</p>
                  )}

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleSendMessage(undefined, 'text');
                    }}
                    className="flex gap-3"
                  >
                    <Input
                      placeholder={
                        activeTab === 'ai'
                          ? 'Ask a pregnancy-related question...'
                          : isDoctor
                            ? 'Message your patient...'
                            : 'Message your doctor...'
                      }
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      className="h-12 rounded-full px-5 text-sm"
                      disabled={activeTab === 'doctor' && !doctorPeerId && !isDoctor}
                    />
                    {activeTab === 'ai' && (
                      <Button
                        type="button"
                        size="icon"
                        variant={isListening ? 'default' : 'outline'}
                        className={cn(
                          'relative h-12 w-12 rounded-full shrink-0 overflow-visible',
                          (isListening || isAiSpeaking) && 'border-primary/40'
                        )}
                        onClick={handleVoiceInputToggle}
                        disabled={!isSpeechRecognitionSupported}
                        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                        title={
                          isSpeechRecognitionSupported
                            ? isListening
                              ? 'Stop listening'
                              : 'Start voice input'
                            : 'Speech recognition is not supported in this browser'
                        }
                      >
                        {(isListening || isAiSpeaking) && (
                          <>
                            <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                            <span className="absolute -inset-1 rounded-full border border-primary/20" />
                          </>
                        )}
                        <span className="relative flex items-center justify-center">
                          {isListening ? (
                            <Square className="h-3.5 w-3.5" />
                          ) : isAiSpeaking ? (
                            <VoiceActivity mode="speaking" compact />
                          ) : (
                            <Mic className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </Button>
                    )}
                    <Button
                      type="submit"
                      size="icon"
                      className="h-12 w-12 rounded-full shrink-0"
                      disabled={activeTab === 'doctor' && !doctorPeerId && !isDoctor}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
