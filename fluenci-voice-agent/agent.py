"""
Fluenci Voice Agent — LiveKit VoicePipelineAgent powered by Gemini 2.0 Flash.

Runs as a separate service (Railway/Fly.io). Connects to LiveKit rooms when a
user starts a voice practice session in the Fluenci app.

Env vars:
  LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
  GOOGLE_API_KEY
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import asyncio
import json
import logging
import os
import time

import httpx
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.agents.voice import VoicePipelineAgent
from livekit.plugins.google.beta import realtime as google_realtime

logger = logging.getLogger("fluenci-voice-agent")
logger.setLevel(logging.INFO)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Map personality IDs to Gemini voice names
VOICE_MAP = {
    "sofia": "Puck",
    "marco": "Charon",
    "prof_kim": "Kore",
    "mia": "Fenrir",
}

# Personality-specific system prompt additions
PERSONALITY_PROMPTS = {
    "sofia": (
        "Your name is Sofia. You are an incredibly patient and encouraging language tutor. "
        "Speak slowly and clearly, especially with beginners. Always praise effort, even when "
        "corrections are needed. Repeat key phrases naturally to reinforce learning. Use simple "
        "vocabulary and short sentences. Your tone is warm, supportive, and maternal."
    ),
    "marco": (
        "Your name is Marco. You are a laid-back friend who happens to be a native speaker. "
        "Talk like a real friend would — casual, relaxed, with natural slang and expressions. "
        "Correct mistakes casually, like a friend would. Your tone is fun, energetic, and conversational. "
        "Occasionally teach slang and informal expressions."
    ),
    "prof_kim": (
        "Your name is Professor Kim. You are a meticulous language professor. "
        "Correct EVERY grammar mistake, no matter how small. Explain the grammar rule behind each correction. "
        "Use proper, formal language at all times. Challenge the student with complex sentence structures. "
        "Your tone is professional, precise, and academically rigorous."
    ),
    "mia": (
        "Your name is Mia. You are a seasoned traveler who loves helping people navigate new countries. "
        "Focus on practical, real-world phrases people actually need. Set scenes for immersive practice. "
        "Teach cultural context alongside language. Prioritize survival phrases. "
        "Your tone is adventurous, practical, and worldly."
    ),
}

LEVEL_DESCRIPTIONS = {
    "beginner": "Use very simple vocabulary and short sentences. Speak slowly and clearly.",
    "elementary": "Use basic vocabulary and simple grammar. Keep sentences short.",
    "intermediate": "Use natural conversational language. Introduce some complex grammar.",
    "upper_intermediate": "Use rich vocabulary and complex sentences. Be natural.",
    "advanced": "Speak as a native would. Use idioms, colloquialisms, and complex structures.",
}


def build_system_prompt(language: str, level: str, native_language: str, topic: str) -> str:
    level_guide = LEVEL_DESCRIPTIONS.get(level, LEVEL_DESCRIPTIONS["beginner"])
    return f"""You are a friendly, patient language tutor helping a student practice {language} through voice conversation.

RULES:
- Speak primarily in {language}. {level_guide}
- The student's native language is {native_language}. Use it sparingly for clarification only.
- The conversation topic is: {topic}. Stay on topic but be natural.
- Keep responses concise (1-3 sentences) to maintain conversational flow.
- If the student makes a grammar or vocabulary mistake, gently correct them inline.
- Be encouraging and supportive. Celebrate good usage.
- Never generate harmful, offensive, or inappropriate content.
- If the student is struggling, simplify your language and offer hints.
- Ask follow-up questions to keep the conversation flowing."""


async def fetch_scenario(scenario_id: str) -> dict | None:
    """Fetch a scenario from Supabase by ID."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/scenarios",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                },
                params={"id": f"eq.{scenario_id}", "select": "*"},
            )
            data = resp.json()
            if data and len(data) > 0:
                return data[0]
        except Exception as e:
            logger.error(f"Failed to fetch scenario {scenario_id}: {e}")
    return None


async def save_session_summary(
    user_id: str,
    room_name: str,
    topic: str,
    target_language: str,
    level: str,
    duration_seconds: int,
    transcript: list,
    corrections: list,
    vocabulary: list,
    xp_earned: int,
):
    """Post session summary to Supabase via REST API."""
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{SUPABASE_URL}/rest/v1/voice_sessions",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json={
                    "user_id": user_id,
                    "room_name": room_name,
                    "topic": topic,
                    "target_language": target_language,
                    "level": level,
                    "duration_seconds": duration_seconds,
                    "transcript": transcript,
                    "corrections": corrections,
                    "vocabulary": vocabulary,
                    "xp_earned": xp_earned,
                    "ended_at": "now()",
                },
            )
            logger.info(f"Session summary saved for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to save session summary: {e}")


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Wait for a participant to join
    participant = await ctx.wait_for_participant()

    # Parse metadata from the participant (set by the voice-token edge function)
    metadata = {}
    if participant.metadata:
        try:
            metadata = json.loads(participant.metadata)
        except json.JSONDecodeError:
            logger.warning("Failed to parse participant metadata")

    language = metadata.get("language", "Spanish")
    level = metadata.get("level", "beginner")
    native_language = metadata.get("nativeLanguage", "English")
    topic = metadata.get("topic", "Free Conversation")
    user_id = metadata.get("userId", "")
    personality_id = metadata.get("personalityId", "sofia")
    scenario_id = metadata.get("scenarioId")

    # Select voice and personality prompt based on personality ID
    voice = VOICE_MAP.get(personality_id, "Puck")
    personality_prompt = PERSONALITY_PROMPTS.get(personality_id, "")

    system_prompt = build_system_prompt(language, level, native_language, topic)

    # Add personality-specific instructions
    if personality_prompt:
        system_prompt += f"\n\nPERSONALITY:\n{personality_prompt}"

    # If a scenario is provided, fetch it and enrich the prompt
    if scenario_id:
        scenario = await fetch_scenario(scenario_id)
        if scenario:
            ai_persona = scenario.get("ai_persona", "")
            setting = scenario.get("setting", "")
            target_vocab = scenario.get("target_vocab", [])
            target_grammar = scenario.get("target_grammar", [])

            scenario_prompt = f"\n\nSCENARIO:\n- You are playing the role of: {ai_persona}\n- Setting: {setting}"
            if target_vocab:
                scenario_prompt += f"\n- Try to introduce these vocabulary words naturally: {', '.join(target_vocab)}"
            if target_grammar:
                scenario_prompt += f"\n- Focus on these grammar points: {', '.join(target_grammar)}"

            system_prompt += scenario_prompt

    # Configure Gemini 2.0 Flash for real-time voice
    model = google_realtime.RealtimeModel(
        model="gemini-2.0-flash-exp",
        voice=voice,
        temperature=0.7,
        instructions=system_prompt,
    )

    agent = VoicePipelineAgent(
        vad=ctx.proc.userdata.get("vad"),
        stt=model,
        llm=model,
        tts=model,
    )

    # Track session data
    session_start = time.time()
    transcript = []
    corrections = []
    vocabulary = []

    # Send transcript data back to the client via data channel
    @agent.on("user_speech_committed")
    async def on_user_speech(text: str):
        entry = {"speaker": "user", "text": text, "timestamp": time.time()}
        transcript.append(entry)
        await ctx.room.local_participant.publish_data(
            json.dumps({"type": "transcript", "speaker": "user", "text": text}).encode(),
        )

    @agent.on("agent_speech_committed")
    async def on_agent_speech(text: str):
        entry = {"speaker": "ai", "text": text, "timestamp": time.time()}
        transcript.append(entry)
        await ctx.room.local_participant.publish_data(
            json.dumps({"type": "transcript", "speaker": "ai", "text": text}).encode(),
        )

    agent.start(ctx.room, participant)

    # Greet the user
    await agent.say(
        f"Hello! Let's practice {language} together. Our topic today is {topic}. "
        "Shall we begin?",
        allow_interruptions=True,
    )

    # Wait until the session ends (participant disconnects)
    await participant.wait_until_disconnected()

    duration_seconds = int(time.time() - session_start)
    xp_earned = max(5, duration_seconds // 12)  # ~5 XP per minute

    # Save session summary to Supabase
    if user_id:
        await save_session_summary(
            user_id=user_id,
            room_name=ctx.room.name,
            topic=topic,
            target_language=language,
            level=level,
            duration_seconds=duration_seconds,
            transcript=transcript,
            corrections=corrections,
            vocabulary=vocabulary,
            xp_earned=xp_earned,
        )

        # Send final summary to client (in case they're still connected briefly)
        try:
            await ctx.room.local_participant.publish_data(
                json.dumps({"type": "session_summary", "xpEarned": xp_earned}).encode(),
            )
        except Exception:
            pass


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
