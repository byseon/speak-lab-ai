from assessment.transcript import candidate_text, transcript_messages, transcript_ready


def test_transcript_messages_reads_final_transcription_event():
    conv = {
        "conversation_id": "c1",
        "events": [
            {"event_type": "system.replica_joined", "properties": {}},
            {
                "event_type": "application.transcription_ready",
                "properties": {
                    "transcript": [
                        {"role": "system", "content": "You are Aria, an IELTS examiner."},
                        {"role": "assistant", "content": "What do you do?"},
                        {"role": "user", "content": "I work as a designer."},
                        {"role": "assistant", "content": "Where are you from?"},
                        {"role": "user", "content": "I'm from Seoul."},
                    ],
                },
            },
        ],
    }

    assert len(transcript_messages(conv)) == 5
    assert candidate_text(conv) == "I work as a designer. I'm from Seoul."
    assert transcript_ready(conv) is True


def test_transcript_messages_reads_early_nested_turns():
    conv = {
        "events": [
            {
                "event_type": "conversation.updated",
                "properties": {
                    "conversation": {
                        "turns": [
                            {"speaker": "examiner", "text": "Tell me about your hometown."},
                            {"speaker": "candidate", "text": "It is a quiet coastal city."},
                        ],
                    },
                },
            },
        ],
    }

    assert candidate_text(conv) == "It is a quiet coastal city."


def test_candidate_text_accepts_non_user_tavus_roles():
    conv = {
        "events": [
            {
                "event_type": "application.transcription_ready",
                "properties": {
                    "transcript": [
                        {"role": "assistant", "content": "What do you study?"},
                        {"role": "customer", "content": "I study economics."},
                        {"role": "speaker_0", "content": "I also work part time."},
                    ],
                },
            },
        ],
    }

    assert candidate_text(conv) == "I study economics. I also work part time."


def test_not_ready_returns_empty():
    conv = {"events": [{"event_type": "system.replica_joined", "properties": {}}]}

    assert candidate_text(conv) == ""
    assert transcript_ready(conv) is False
