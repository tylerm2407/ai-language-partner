/**
 * Gemini Live WebSocket manager.
 * Handles real-time bidirectional audio streaming with Gemini Live API.
 * Audio format: PCM 16-bit 16kHz mono.
 */

export type GeminiLiveState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'LISTENING' | 'AI_SPEAKING';

export interface GeminiLiveConfig {
  model: string;
  targetLanguage: string;
  level: string;
  topic: string;
  generationConfig: {
    responseModalities: string[];
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: string;
        };
      };
    };
  };
}

export interface GeminiLiveCallbacks {
  onStateChange?: (state: GeminiLiveState) => void;
  onAudioChunk?: (base64Audio: string) => void;
  onTranscript?: (userText: string, aiText: string) => void;
  onTurnComplete?: () => void;
  onError?: (error: Error) => void;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private state: GeminiLiveState = 'DISCONNECTED';
  private callbacks: GeminiLiveCallbacks = {};
  private startTime: number = 0;
  private remainingMinutes: number = 0;
  private minuteCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Accumulate transcript parts
  private currentUserText: string = '';
  private currentAiText: string = '';

  getState(): GeminiLiveState {
    return this.state;
  }

  getElapsedMinutes(): number {
    if (this.startTime === 0) return 0;
    return (Date.now() - this.startTime) / 60000;
  }

  getRemainingMinutes(): number {
    return Math.max(0, this.remainingMinutes - this.getElapsedMinutes());
  }

  /**
   * Connect to Gemini Live WebSocket.
   * @param sessionUri - WebSocket URI from voice-session-token edge function
   * @param config - Voice configuration from edge function
   * @param systemPrompt - System instruction for the conversation
   * @param remainingMinutes - Remaining daily voice minutes
   * @param callbacks - Event callbacks
   */
  connect(
    sessionUri: string,
    config: GeminiLiveConfig,
    systemPrompt: string,
    remainingMinutes: number,
    callbacks: GeminiLiveCallbacks
  ): void {
    if (this.ws) {
      this.disconnect();
    }

    this.callbacks = callbacks;
    this.remainingMinutes = remainingMinutes;
    this.setState('CONNECTING');

    try {
      this.ws = new WebSocket(sessionUri);

      this.ws.onopen = () => {
        // Send BidiGenerateContentSetup message
        const setupMessage = {
          setup: {
            model: config.model,
            generationConfig: config.generationConfig,
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
          },
        };

        this.ws?.send(JSON.stringify(setupMessage));
        this.startTime = Date.now();
        this.setState('CONNECTED');

        // Start minute tracking
        this.minuteCheckInterval = setInterval(() => {
          if (this.getRemainingMinutes() <= 0) {
            this.callbacks.onError?.(new Error('Voice minutes exhausted'));
            this.disconnect();
          }
        }, 10000); // Check every 10 seconds
      };

      this.ws.onmessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;
          if (!data) return;

          this.handleServerMessage(data);
        } catch (err) {
          console.error('[GeminiLive] Failed to parse message:', err);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[GeminiLive] WebSocket error:', event);
        this.callbacks.onError?.(new Error('WebSocket connection error'));
      };

      this.ws.onclose = (event) => {
        console.log('[GeminiLive] WebSocket closed:', event.code, event.reason);
        this.cleanup();
        this.setState('DISCONNECTED');
      };
    } catch (err) {
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      this.setState('DISCONNECTED');
    }
  }

  /**
   * Send audio data to Gemini Live.
   * @param pcmBase64 - Base64 encoded PCM 16-bit 16kHz mono audio chunk
   */
  sendAudio(pcmBase64: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = {
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/pcm;rate=16000',
          data: pcmBase64,
        }],
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a text message instead of audio.
   */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }],
        }],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Disconnect and clean up.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.cleanup();
    this.setState('DISCONNECTED');
  }

  private handleServerMessage(data: Record<string, unknown>): void {
    const serverContent = data.serverContent as Record<string, unknown> | undefined;

    if (data.setupComplete) {
      this.setState('LISTENING');
      return;
    }

    if (!serverContent) return;

    const modelTurn = serverContent.modelTurn as { parts?: Array<Record<string, unknown>> } | undefined;

    if (modelTurn?.parts) {
      for (const part of modelTurn.parts) {
        // Audio response
        if (part.inlineData) {
          const inlineData = part.inlineData as { data: string };
          this.setState('AI_SPEAKING');
          this.callbacks.onAudioChunk?.(inlineData.data);
        }

        // Text response (transcript of AI speech)
        if (typeof part.text === 'string') {
          this.currentAiText += part.text;
        }
      }
    }

    // Check for turn completion
    if (serverContent.turnComplete) {
      if (this.currentAiText || this.currentUserText) {
        this.callbacks.onTranscript?.(this.currentUserText, this.currentAiText);
      }
      this.callbacks.onTurnComplete?.();
      this.currentUserText = '';
      this.currentAiText = '';
      this.setState('LISTENING');
    }
  }

  private setState(state: GeminiLiveState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private cleanup(): void {
    if (this.minuteCheckInterval) {
      clearInterval(this.minuteCheckInterval);
      this.minuteCheckInterval = null;
    }
    this.startTime = 0;
    this.currentUserText = '';
    this.currentAiText = '';
  }
}
