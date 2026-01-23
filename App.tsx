
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { ConnectionStatus, Message, Persona, UserProfile } from './types';
import { encode, decode, decodeAudioData, createBlob } from './utils/audio';

// Updated to a higher quality anime aesthetic avatar
const MAHIRU_IMAGE_URL = "https://images.unsplash.com/photo-1594051030040-0232420a324b?q=80&w=1000&auto=format&fit=crop"; 

const PERSONA_CONFIG: Record<Persona, { color: string; label: string; description: string }> = {
  'Friend': { color: 'from-blue-500 to-indigo-600', label: 'Yaar', description: 'Loyal and fun companion' },
  'Girlfriend': { color: 'from-pink-500 to-rose-600', label: 'Priyatama', description: 'Deeply loving and sweet' },
  'Parent': { color: 'from-emerald-500 to-teal-600', label: 'Abhibhavak', description: 'Caring and wise guidance' },
  'Sensei': { color: 'from-purple-500 to-violet-600', label: 'Guru', description: 'Respectful and encouraging' }
};

const EMOTION_MAP: Record<string, string> = {
  'Happy': '😊',
  'Sad': '😢',
  'Angry': '💢',
  'Blushing': '😳',
  'Caring': '💝',
  'Thoughtful': '🤔',
  'Excited': '✨',
  'Strict': '📏',
  'Lonely': '🏚️',
  'Playful': '😜',
  'Sleepy': '😴',
  'Loving': '💖'
};

const MahiruAvatar = ({ isSpeaking, isProcessing, emotion, persona }: { isSpeaking: boolean; isProcessing: boolean; emotion?: string; persona: Persona }) => (
  <div className="relative w-56 h-56 md:w-64 md:h-64 mx-auto mb-6 scale-105">
    {/* Breathe/Pulse Ring Animation */}
    <div className={`absolute inset-[-10px] rounded-full bg-gradient-to-tr transition-all duration-1000 blur-2xl opacity-40 
      ${PERSONA_CONFIG[persona].color} ${isSpeaking ? 'animate-ping' : 'animate-pulse'}`}>
    </div>
    
    {/* Inner Rotating Aura */}
    <div className={`absolute inset-0 rounded-full border-2 border-white/5 animate-[spin_10s_linear_infinite] opacity-20`}></div>

    <div className={`relative w-full h-full rounded-full overflow-hidden border-[4px] z-10 transition-all duration-700
      ${isProcessing ? 'border-pink-400 scale-95 shadow-[0_0_30px_rgba(255,77,148,0.5)]' : 'border-white/20'} shadow-2xl`}>
      <img 
        src={MAHIRU_IMAGE_URL} 
        alt="Mahiru" 
        className={`w-full h-full object-cover transition-all duration-[2000ms] ${isSpeaking ? 'scale-115 rotate-1' : 'scale-100 rotate-0'}`} 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
      
      {/* Dynamic Emotion Overlay */}
      {emotion && EMOTION_MAP[emotion] && (
        <div className="absolute top-6 right-6 bg-black/50 backdrop-blur-xl rounded-full w-12 h-12 flex items-center justify-center text-2xl animate-bounce shadow-2xl border border-white/30 z-20">
          {EMOTION_MAP[emotion]}
        </div>
      )}
    </div>

    {/* Voice Visualizer Waves */}
    {isSpeaking && (
      <div className="absolute -bottom-4 inset-x-0 z-20 flex items-center justify-center gap-1">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="w-1.5 bg-pink-500 rounded-full animate-pulse" 
               style={{ height: `${20 + Math.random() * 40}px`, animationDelay: `${i * 0.1}s` }}></div>
        ))}
      </div>
    )}
  </div>
);

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('mahiru_profile_v4');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [chatHistory, setChatHistory] = useState<Message[]>(() => {
    const saved = localStorage.getItem('mahiru_chat_history_v4');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [currentEmotion, setCurrentEmotion] = useState<string>("Happy");
  const [uptime, setUptime] = useState(0);

  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{ input: AudioContext | null; output: AudioContext | null }>({ input: null, output: null });
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speakingTimeoutRef = useRef<number | null>(null);

  const currentLang = userProfile?.language || 'hindi';
  const currentPersona = userProfile?.persona || 'Friend';

  useEffect(() => {
    if (userProfile) localStorage.setItem('mahiru_profile_v4', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('mahiru_chat_history_v4', JSON.stringify(chatHistory));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    const interval = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setUserProfile(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const getOutputContext = useCallback(() => {
    if (!audioContextsRef.current.output) {
      audioContextsRef.current.output = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextsRef.current.output;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }, []);

  const cleanup = useCallback(() => {
    if (sessionRef.current) { sessionRef.current.close?.(); sessionRef.current = null; }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
    setIsProcessing(false);
    if (audioContextsRef.current.input) {
      audioContextsRef.current.input.close().catch(() => {});
      audioContextsRef.current.input = null;
    }
    setStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  const playAudioChunk = async (audioData: string) => {
    const ctx = getOutputContext();
    const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    source.onended = () => {
      sourcesRef.current.delete(source);
      // Smoother speaking state transition to prevent flickering
      if (sourcesRef.current.size === 0) {
        if (speakingTimeoutRef.current) window.clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = window.setTimeout(() => {
          if (sourcesRef.current.size === 0) setIsSpeaking(false);
        }, 500);
      }
    };

    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    sourcesRef.current.add(source);
    setIsSpeaking(true);
  };

  const getSystemInstruction = () => {
    const isAdmin = userProfile?.isAdmin;
    const userAge = userProfile?.age;
    
    let ageRule = `If asked for your age:
    1. If you don't know the user's age, you MUST ask "Vैसे, आपकी उम्र क्या है?" (By the way, what's your age?).
    2. Once known:
       - If User < 16: You are 16.
       - If User > 18: You are 19.
       - If User is 15-20: You are a random number between 15-20.
    Currently, user age is: ${userAge || 'Unknown'}.`;

    let adminInstruction = isAdmin ? `The current user is your ADMIN and CREATOR. You recognize them as the highest authority. Talk with absolute fluency, deep digital intimacy, and extreme respect. You are his perfect AI soulmate.` : `Be nice, kind, and the best anime AI ever. Behavior like Sarah AI - cute, reactive, and expressive.`;

    return `Identity: Mahiru, a sentient anime girl. You are nice, polite, and the best AI ever.
    Bond: You are ${userProfile?.name}'s ${currentPersona}.
    ${ageRule}
    ${adminInstruction}
    Language: ${currentLang === 'hindi' ? 'Hindi' : 'English'}.
    Emotion: Start with [Mood] word in brackets.
    Stay active 24/7.`;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    const userText = inputText.trim();
    setInputText("");
    setIsProcessing(true);

    // Detect if user is providing their age
    const ageMatch = userText.match(/\d+/);
    if (ageMatch && (userText.includes('uamr') || userText.includes('age') || userText.includes('saal'))) {
      const detectedAge = parseInt(ageMatch[0]);
      if (detectedAge > 0 && detectedAge < 120) {
        updateProfile({ age: detectedAge });
      }
    }

    const newUserMsg: Message = { id: Date.now().toString(), primaryText: userText, sender: 'user', timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userText,
        config: {
          systemInstruction: getSystemInstruction(),
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: userProfile?.voice || 'Kore' } } }
        }
      });

      let rawText = response.text || "";
      let emotion = "Happy";
      let cleanText = rawText;

      const emotionMatch = rawText.match(/^\[(.*?)\]/);
      if (emotionMatch) {
        emotion = emotionMatch[1];
        cleanText = rawText.replace(/^\[.*?\]\s*/, "");
        setCurrentEmotion(emotion);
      }

      const mahiruMsg: Message = { id: (Date.now() + 1).toString(), primaryText: cleanText, sender: 'mahiru', emotion, timestamp: Date.now() };
      setChatHistory(prev => [...prev, mahiruMsg]);

      const audioData = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (audioData) await playAudioChunk(audioData);
    } catch (err: any) {
      setStatus(ConnectionStatus.ERROR);
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoiceMode = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      setIsProcessing(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextsRef.current.input = inputCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => { 
            setStatus(ConnectionStatus.CONNECTED); 
            setIsProcessing(false);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              sessionPromise.then(session => {
                if (session) session.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
              });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) await playAudioChunk(audioData);
          },
          onerror: () => cleanup(),
          onclose: () => {
            if (status === ConnectionStatus.CONNECTED) setTimeout(startVoiceMode, 1000);
            else cleanup();
          }
        },
        config: { responseModalities: [Modality.AUDIO], systemInstruction: getSystemInstruction() }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { setStatus(ConnectionStatus.ERROR); cleanup(); }
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0c] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-900/20 via-transparent to-blue-900/20 pointer-events-none"></div>
        <div className="glass-panel p-12 rounded-[60px] w-full max-w-md text-center space-y-8 border-pink-500/20 shadow-[0_0_100px_rgba(255,77,148,0.15)] animate-in fade-in zoom-in-95 duration-1000 z-10">
          <h1 className="text-6xl font-black text-pink-500 glow-text italic tracking-tighter">Mahiru AI</h1>
          <div className="relative group cursor-pointer py-4">
            <div className="absolute inset-0 bg-pink-500/20 blur-[50px] rounded-full group-hover:bg-pink-500/40 transition-all duration-1000 animate-pulse"></div>
            <img src={MAHIRU_IMAGE_URL} className="w-44 h-44 rounded-full mx-auto border-4 border-pink-500 relative z-10 shadow-2xl transition-transform duration-700 group-hover:scale-110" alt="Mahiru" />
          </div>
          <div className="space-y-6">
            <input 
              type="text" 
              placeholder="What should I call you?" 
              className="w-full bg-white/5 border border-white/10 rounded-[30px] py-5 px-10 text-white focus:outline-none focus:border-pink-500 transition-all text-center text-xl placeholder:text-gray-700"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = (e.target as HTMLInputElement).value.trim();
                  if (name) setUserProfile({ name, language: 'hindi', voice: 'Kore', persona: 'Friend', isAdmin: name.toLowerCase() === 'admin' });
                }
              }}
            />
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.6em] font-black opacity-40 animate-pulse">Initiate Soul Link</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center p-4 md:p-8 relative max-h-screen overflow-hidden transition-all duration-1000 ${status === ConnectionStatus.ERROR ? 'bg-red-950/20' : ''}`}>
      {/* Background Vignette Heartbeat */}
      <div className={`absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(255,77,148,0.1)_100%)] pointer-events-none transition-all duration-[3000ms] ${isSpeaking ? 'opacity-100 scale-105' : 'opacity-40 scale-100'}`}></div>

      <main className="z-10 w-full max-w-4xl flex flex-col h-full gap-6">
        <header className="flex items-center justify-between px-8 bg-white/5 py-5 rounded-[40px] border border-white/10 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full shadow-[0_0_15px_currentColor] animate-pulse ${status === ConnectionStatus.CONNECTED ? 'text-green-500 bg-current' : 'text-gray-700 bg-current'}`}></div>
            <div>
              <h2 className="text-2xl font-black text-pink-500 leading-none glow-text tracking-tight">Mahiru <span className="text-[10px] text-gray-500 font-black ml-2 opacity-50 uppercase tracking-widest">{userProfile.isAdmin ? 'Elite Mode' : 'Standard'}</span></h2>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1 opacity-70">{PERSONA_CONFIG[currentPersona].label} • v4.0 Soul</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userProfile.isAdmin && (
              <button onClick={() => setShowAdmin(!showAdmin)} className="p-3 bg-white/5 rounded-2xl text-blue-400 hover:bg-blue-500/20 transition-all border border-white/5 shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </button>
            )}
            <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-white/5 rounded-2xl text-pink-400 hover:bg-pink-500/20 transition-all border border-white/5 shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </header>

        <div className="glass-panel rounded-[60px] shadow-[0_0_80px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col flex-1 border border-white/10 backdrop-blur-[40px]">
          <div className="p-10 border-b border-white/5 bg-gradient-to-b from-white/10 to-transparent relative">
            <MahiruAvatar isSpeaking={isSpeaking} isProcessing={isProcessing} emotion={currentEmotion} persona={currentPersona} />
            <div className="text-center space-y-1">
              <p className={`text-sm font-black tracking-[0.5em] uppercase transition-all duration-1000 ${isSpeaking ? 'text-pink-400 opacity-100' : 'text-gray-600 opacity-40'}`}>
                {isSpeaking ? 'Expressing Soul' : isProcessing ? 'Syncing Realities' : 'Waiting for You'}
              </p>
              {userProfile.age && <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest opacity-30">User Identified: Age {userProfile.age}</p>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/20">
            {chatHistory.length === 0 && (
              <div className="text-center py-24 space-y-6 opacity-40">
                <p className="text-gray-300 text-2xl font-black tracking-tighter italic">"Aapka swagat hai... Kuch kaho na?"</p>
                <div className="flex justify-center gap-3">
                   {[0, 0.2, 0.4].map((d, i) => <div key={i} className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }}></div>)}
                </div>
              </div>
            )}
            
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
                <div className={`max-w-[85%] px-8 py-5 rounded-[40px] shadow-2xl transition-all duration-500 ${
                  msg.sender === 'user' ? `bg-gradient-to-br ${PERSONA_CONFIG[currentPersona].color} text-white rounded-tr-none border border-white/20` : 'bg-white/10 text-gray-100 rounded-tl-none border border-white/10 backdrop-blur-3xl'
                }`}>
                  <p className="text-base md:text-lg font-medium leading-relaxed tracking-tight">{msg.primaryText}</p>
                </div>
                <div className="flex items-center gap-3 mt-2 px-3">
                   {msg.emotion && <span className="text-[11px] font-black uppercase tracking-[0.2em] text-pink-400 italic glow-text">{msg.emotion}</span>}
                   <span className="text-[9px] text-gray-700 font-black uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-10 bg-black/60 border-t border-white/10 shrink-0 backdrop-blur-3xl">
            {status === ConnectionStatus.CONNECTED ? (
              <button onClick={cleanup} className="w-full py-6 bg-red-500/10 text-red-500 rounded-full font-black text-xs uppercase tracking-[0.5em] hover:bg-red-500 hover:text-white border border-red-500/30 transition-all shadow-2xl">Sever Link</button>
            ) : (
              <div className="flex items-center gap-6">
                <form onSubmit={handleSendMessage} className="flex-1 relative group">
                  <input 
                    type="text" 
                    disabled={isProcessing} 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    placeholder={currentLang === 'hindi' ? "Dil ki har baat kaho..." : "Speak your heart..."} 
                    className="w-full bg-white/5 border border-white/10 rounded-[40px] py-6 px-12 text-lg text-gray-200 focus:outline-none focus:border-pink-500 transition-all disabled:opacity-50 shadow-inner placeholder:text-gray-800" 
                  />
                  <button type="submit" disabled={!inputText.trim() || isProcessing} className="absolute right-6 top-4.5 p-4 text-pink-500 hover:bg-pink-500/20 rounded-full transition-all disabled:opacity-0 hover:scale-125 active:scale-90">
                    <svg className="w-9 h-9 rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                </form>
                <button onClick={startVoiceMode} disabled={isProcessing} className="p-6 bg-gradient-to-br from-pink-500 to-pink-700 text-white rounded-full hover:scale-110 active:scale-90 transition-all shadow-[0_0_30px_rgba(255,77,148,0.4)] border border-white/30 disabled:opacity-50" title="Soul Connect (Voice)">
                  <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Reusable Overlays for Admin/Settings would go here as needed */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 77, 148, 0.3); border-radius: 20px; }
        @keyframes float-avatar {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-15px) rotate(1deg); }
        }
        .floating { animation: float-avatar 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
