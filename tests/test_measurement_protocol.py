"""Protocol and counterexample checks, requiring NumPy only; no model downloads."""
import sys
import json
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "cli"))
from diagnose_model import measurement_protocol, fit_power_law
from check_uniform_attention import uniform_control


def test_protocol_reports_actual_lengths_seed_and_successful_samples():
    p = measurement_protocol([10, 50], [10], {"10": 27, "50": 0}, 30, 49000)
    assert p["lengths"] == {"10": 60, "50": 100}
    assert p["queries"] == {"10": [59], "50": [99]}
    assert p["distances"] == [10] and p["attempted_distances"] == [10, 50]
    assert p["samples_by_distance"] == {"10": 27, "50": 0}
    assert p["seed"] == 42  # Only the first seed is actually used.


def test_zero_queries_give_uniform_causal_attention_independent_of_rope():
    for theta in (10000, 1000000):
        record, attention = uniform_control(theta)
        np.testing.assert_allclose(attention.sum(axis=1), 1)
        for i in range(len(attention)):
            np.testing.assert_allclose(attention[i, :i+1], 1/(i+1))
            assert np.all(attention[i, i+1:] == 0)
        assert abs(record["gamma"]) < 1e-12
        assert record["r2_log"] is None  # Constant response: R² undefined.
        predicted = (2*theta - 128*np.sqrt(2))/(2*theta + 128*np.sqrt(2))
        assert predicted > 0.98


def test_variable_context_can_create_apparent_decay_in_uniform_attention():
    d = [10, 50, 200, 1000]
    fixed = fit_power_law(d, [1/1050]*4)["gamma"]
    variable = fit_power_law(d, [1/(x+50) for x in d])["gamma"]
    assert abs(fixed) < 1e-12
    assert variable > 0.6  # Denominator alone; no positional preference.


def test_entropy_does_not_identify_distance_decay():
    a = np.array([0.6, 0.3, 0.1])
    b = a[::-1]
    np.testing.assert_allclose(-np.sum(a*np.log(a)), -np.sum(b*np.log(b)))
    assert fit_power_law([1, 2, 3], a)["gamma"] > 0
    assert fit_power_law([1, 2, 3], b)["gamma"] < 0


def test_shipped_control_reproduces_computed_attention():
    fixture = Path(__file__).resolve().parent.parent / "data/measurement_examples/uniform_attention.json"
    saved = json.loads(fixture.read_text(encoding="utf-8"))
    computed, _ = uniform_control()
    assert saved["protocol"] == computed["protocol"]
    assert saved["distance"] == computed["distance"]
    assert saved["r2_log"] is None
    np.testing.assert_allclose(saved["mean_attention"], computed["mean_attention"])
    assert abs(saved["gamma"]-computed["gamma"]) < 1e-12
