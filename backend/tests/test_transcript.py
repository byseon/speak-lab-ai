from assessment.transcript import candidate_text, transcript_messages, transcript_ready

# Mirrors the real Tavus verbose shape: transcript inside transcription_ready event.
CONV = {
    "conversation_id": "c1",
    "events": [
        {"event_type": "system.replica_joined", "properties": {}},
        {"event_type": "application.transcription_ready", "properties": {"transcript": [
            {"role": "system", "content": "You are Aria, an IELTS examiner."},
            {"role": "assistant", "content": "Where are you from?"},
            {"role": "user", "content": "I'm from Seoul."},
            {"role": "assistant", "content": "What do you do there?"},
            {"role": "user", "content": "I work as a machine learning engineer."},
        ]}},
    ],
}


def test_candidate_text_joins_only_user_turns():
    assert candidate_text(CONV) == "I'm from Seoul. I work as a machine learning engineer."


def test_transcript_messages_and_ready():
    assert len(transcript_messages(CONV)) == 5
    assert transcript_ready(CONV) is True


def test_not_ready_returns_empty():
    conv = {"events": [{"event_type": "system.replica_joined", "properties": {}}]}
    assert candidate_text(conv) == ""
    assert transcript_ready(conv) is False
