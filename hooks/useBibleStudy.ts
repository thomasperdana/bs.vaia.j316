
import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { TranscriptEntry, SessionStatus, Speaker } from '../types';
import { BIBLE_STUDY_SYSTEM_INSTRUCTION } from '../constants';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

// Helper to create a pcm blob for the API
const createPcmBlob = (data: Float32Array) => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};


export const useBibleStudy = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  
  const sessionRef = useRef<LiveSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const cleanup = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
     if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();

    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    nextStartTimeRef.current = 0;
    setStatus(SessionStatus.IDLE);
    // Don't clear transcript to allow user to review
  }, []);

  const startSession = useCallback(async () => {
    if (status !== SessionStatus.IDLE) return;
    
    setTranscript([]); // Clear previous transcript
    setStatus(SessionStatus.THINKING);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: BIBLE_STUDY_SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
            setStatus(SessionStatus.LISTENING);
          },
          onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.outputTranscription?.text) {
                  currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                  setStatus(SessionStatus.SPEAKING);
              }
              if (message.serverContent?.inputTranscription?.text) {
                  currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                  setStatus(SessionStatus.LISTENING);
              }

              if (message.serverContent?.turnComplete) {
                  const userInput = currentInputTranscriptionRef.current.trim();
                  const modelOutput = currentOutputTranscriptionRef.current.trim();
                  
                  setTranscript(prev => {
                      const newTranscript = [...prev];
                      if(userInput) newTranscript.push({ speaker: Speaker.USER, text: userInput });
                      if(modelOutput) newTranscript.push({ speaker: Speaker.FACILITATOR, text: modelOutput });
                      return newTranscript;
                  });

                  currentInputTranscriptionRef.current = '';
                  currentOutputTranscriptionRef.current = '';
                  setStatus(SessionStatus.LISTENING);
              }

              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio && outputAudioContextRef.current) {
                setStatus(SessionStatus.SPEAKING);
                const audioContext = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);

                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                
                source.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(source);
                  if (audioSourcesRef.current.size === 0) {
                      setStatus(SessionStatus.LISTENING);
                  }
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
              }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setStatus(SessionStatus.ERROR);
            cleanup();
          },
          onclose: () => {
            cleanup();
          },
        },
      });

      sessionRef.current = await sessionPromise;
      
    } catch (error) {
      console.error('Failed to start session:', error);
      setStatus(SessionStatus.ERROR);
      cleanup();
    }
  }, [status, cleanup]);
  
  const endSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { status, transcript, startSession, endSession };
};
