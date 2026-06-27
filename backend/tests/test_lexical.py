from assessment.features.lexical import extract_lexical, mtld


def test_empty():
    lx = extract_lexical("")
    assert lx.token_count == 0


def test_basic_overuse_flagged():
    text = "the food was good and the service was good so good really good"
    lx = extract_lexical(text)
    assert lx.token_count == 13
    assert "good" in lx.flagged_basic_overuse   # appears 4x


def test_mtld_short_is_zero():
    assert mtld(["a", "b", "c"]) == 0.0          # too short to be stable


def test_mtld_nonzero_on_diverse_text():
    tokens = ("the quick brown fox jumps over the lazy dog while a curious "
              "cat watches the colourful birds fly across the bright sky").split()
    assert mtld(tokens) > 0
