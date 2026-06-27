from assessment.part1_flow import (
    Part1Orchestrator, Stage, Directive, extract_lead, _looks_lost, TOPIC_BANK,
)


def test_intro_then_identity_is_verbatim():
    o = Part1Orchestrator(username="sam")
    d = o.start()
    assert d.stage == Stage.INTRO and d.deliver == "echo"
    assert "examiner" in d.text and "full name" in d.text
    assert o.stage == Stage.CONFIRM_IDENTITY      # now expecting the name


def test_identity_then_first_topic_opening():
    o = Part1Orchestrator()
    o.start()
    d = o.on_user_turn("Sam")
    assert d.stage == Stage.INTERVIEW and d.deliver == "echo"
    assert d.text.startswith("Thank you, Sam.")
    assert o.current_topic == "home" and d.text.endswith(TOPIC_BANK["home"])


def test_followups_then_switch_after_max():
    o = Part1Orchestrator(max_followups=2, max_topics=3)
    o.start(); o.on_user_turn("Sam")                       # -> home opening
    d1 = o.on_user_turn("I live in a spacious apartment near the river with my family")
    assert d1.deliver == "instruct" and o.followups == 1   # follow-up 1
    d2 = o.on_user_turn("Yes it has a big balcony and lots of light")
    assert d2.deliver == "instruct" and o.followups == 2   # follow-up 2
    d3 = o.on_user_turn("It is really comfortable and modern")
    assert d3.deliver == "echo"                            # max follow-ups -> switch
    assert o.current_topic == "work_study"
    assert d3.text.startswith("Thank you.")


def test_struggle_switches_topic_immediately():
    o = Part1Orchestrator()
    o.start(); o.on_user_turn("Sam")
    d = o.on_user_turn("no")                               # 1 word -> struggling
    assert d.deliver == "echo" and d.meta.get("switched_because") == "struggle"
    assert d.text.startswith("Let's move on.")
    assert o.current_topic == "work_study"


def test_finishes_after_max_topics():
    o = Part1Orchestrator(max_topics=2, max_followups=0)
    o.start(); o.on_user_turn("Sam")                       # topic 1 (home)
    o.on_user_turn("a short answer here ok")               # max_followups=0 -> switch to topic 2
    d = o.on_user_turn("another short answer fine here")   # topic 2 done -> finished
    assert d.stage == Stage.DONE and "complete" in d.text.lower()


def test_lead_extraction_and_lost_detection():
    assert extract_lead("I really love playing the violin in an orchestra")  # not None
    assert extract_lead("yes no ok") is None                # no long content word
    assert _looks_lost("I don't know") and _looks_lost("")
    assert not _looks_lost("I work as a software engineer")
