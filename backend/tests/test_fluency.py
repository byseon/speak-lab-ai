from assessment.schema import Word
from assessment.features.fluency import extract_fluency, SHORT_PAUSE_S


def _w(text, start, end, conf=0.9):
    return Word(text, start, end, conf)


def test_empty():
    f = extract_fluency([])
    assert f.word_count == 0 and f.speech_rate_wpm == 0.0


def test_pauses_fillers_repetitions():
    words = [
        _w("i", 0.0, 0.2), _w("i", 0.2, 0.4),      # immediate repetition
        _w("went", 0.4, 0.7),                       # then a 0.5s silent pause:
        _w("um", 1.2, 1.5),                         # filled pause
        _w("to", 1.5, 1.7), _w("japan", 1.7, 2.3),
    ]
    f = extract_fluency(words)
    assert f.word_count == 6
    assert f.repetition_count == 1
    assert f.filled_pause_count == 1
    assert f.silent_pause_count == 1            # only the 0.5s gap >= 0.25s
    assert f.long_pause_count == 0
    assert f.mean_length_of_run == 3.0          # 6 words / 2 runs
    # effective rate strips the filler + the repeated copy -> lower than raw
    assert f.effective_speech_rate_wpm < f.speech_rate_wpm


def test_long_pause_detected():
    words = [_w("hello", 0.0, 0.5), _w("world", 2.0, 2.5)]  # 1.5s gap
    f = extract_fluency(words)
    assert f.long_pause_count == 1
    assert f.silent_pause_count == 1


def test_discourse_markers():
    words = [_w("well", 0.0, 0.3), _w("you", 0.3, 0.4), _w("know", 0.4, 0.6),
             _w("for", 0.6, 0.8), _w("example", 0.8, 1.2)]
    f = extract_fluency(words)
    # "well" (unigram) + "you know" + "for example" (bigrams) = 3
    assert f.discourse_marker_count == 3
    assert SHORT_PAUSE_S == 0.25
