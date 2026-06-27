from assessment.webhook import ConversationStore, handle_event
from assessment.tavus_tools import TOOL_NAME


def _crit(b):
    return {"band": b, "feedback": "be precise", "evidence": ["it was good"]}


def test_tool_call_event_produces_scorecard():
    store = ConversationStore()
    ev = {
        "event_type": "conversation.tool_call", "conversation_id": "c1",
        "tool_name": TOOL_NAME,
        "arguments": {
            "fluency_coherence": _crit(6), "lexical_resource": _crit(6),
            "grammatical_range_accuracy": _crit(6), "pronunciation": _crit(7),
        },
    }
    ack = handle_event(ev, store)
    assert ack["handled"] == "tool_call" and ack["overall_band"] == 6.5
    assert store.get("c1").scorecard.overall_band == 6.5


def test_recording_ready_stashes_uri():
    store = ConversationStore()
    ev = {"event_type": "application.recording_ready", "conversation_id": "c2",
          "properties": {"storage_uri": "s3://bucket/tavus/c2/123.mp4"}}
    ack = handle_event(ev, store)
    assert ack["handled"] == "recording_ready"
    assert store.get("c2").recording_uri.endswith(".mp4")


def test_unknown_event_is_acked_and_logged():
    store = ConversationStore()
    ev = {"event_type": "system.replica_joined", "conversation_id": "c3"}
    ack = handle_event(ev, store)
    assert ack["ok"] and ack["handled"] == "system.replica_joined"
    assert "system.replica_joined" in store.get("c3").events
