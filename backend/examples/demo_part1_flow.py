"""Simulate the near-deterministic Part 1 flow on scripted candidate answers.

    uv run python examples/demo_part1_flow.py

Shows the exact Directive sequence the Part1Orchestrator produces — intro, identity,
topic openings (echo, verbatim), follow-ups on conversational leads (instruct), and a
topic switch when the candidate struggles. In the live app each Directive maps to a
Tavus call (echo -> conversation.echo, instruct -> conversation.overwrite-context).
"""

from __future__ import annotations

from assessment.part1_flow import Part1Orchestrator

# A scripted candidate: good answers, then a struggle on 'work_study' to force a switch.
ANSWERS = [
    "Sam",                                                  # identity
    "I live in a cosy apartment near the river with my family",
    "Yes, it has a lovely balcony where I drink coffee",
    "It feels really peaceful and modern",                  # 3rd -> switch (max follow-ups)
    "um, I don't know",                                     # struggle -> switch immediately
    "I love hiking and landscape photography on weekends",
    "Mostly in the mountains just outside the city",
]


def show(d) -> None:
    arrow = "🗣  SAY (echo)   " if d.deliver == "echo" else "🧭 INSTRUCT (ctx)"
    topic = f"  [topic={d.topic}]" if d.topic else ""
    lead = f"  (lead={d.meta['lead']})" if d.meta.get("lead") else ""
    print(f"  {arrow} {d.text}{topic}{lead}")


def main() -> None:
    o = Part1Orchestrator(username="Sam")
    print("=== Part 1 — deterministic directive sequence ===\n")
    print("EXAMINER:")
    show(o.start())
    for ans in ANSWERS:
        print(f"\nCANDIDATE: {ans}")
        print("EXAMINER:")
        show(o.on_user_turn(ans))
    print(f"\n(final stage: {o.stage.value}, topics covered: {o.topics_done})")


if __name__ == "__main__":
    main()
