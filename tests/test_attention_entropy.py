import json
import subprocess
import sys
from pathlib import Path
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'cli'))
sys.path.insert(0, str(ROOT / 'python'))
from attention_entropy import attention_row_entropy, summarize_attention_entropy
from taf_browser import gamma_decompose, gamma_decompose_v2


def test_entropy_limits_and_causal_support():
    uniform = attention_row_entropy([.25]*4)
    assert uniform['entropy_bits'] == 2
    assert uniform['normalized_entropy'] == 1
    assert uniform['kl_to_uniform_bits'] == 0
    spike = attention_row_entropy([1,0,0,0])
    assert spike['entropy_bits'] == 0 and spike['kl_to_uniform_bits'] == 2
    assert attention_row_entropy([1,0], [True,False])['normalized_entropy'] is None
    assert attention_row_entropy([.5,.5,0], [True,True,False])['entropy_bits'] == 1


@pytest.mark.parametrize('row', [[], [-.1,1.1], [np.nan,1], [np.inf,0], [0,0], [.2,.2]])
def test_invalid_attention_rejected(row):
    with pytest.raises(ValueError):
        attention_row_entropy(row)


def test_masks_and_aggregation():
    with pytest.raises(ValueError):
        attention_row_entropy([.5,.5], [True,False])
    result = summarize_attention_entropy([[1,0],[0,1]])
    assert result['mean_entropy_bits'] == 0  # Entropy of the averaged row would be 1.
    assert result['gamma_correction']['applied'] is False
    json.dumps(result, allow_nan=False)


def test_entropy_does_not_locate_mass_or_adjust_gamma():
    a = attention_row_entropy([.6,.3,.1])
    b = attention_row_entropy([.1,.3,.6])
    assert a['entropy_bits'] == pytest.approx(b['entropy_bits'])


def test_exploratory_terms_require_opt_in():
    with pytest.raises(TypeError):
        gamma_decompose(.8, n_params=1e9, apply_exploratory='false')
    for size in (100e6, 1e9):
        baseline = gamma_decompose(.8, n_params=size, has_SWA=True)
        assert baseline['gamma_corrected'] == .8
        assert not baseline['corrections']['post_IH']['applied']
        assert baseline['delta_post_IH'] == baseline['delta_SWA'] == 0
    enabled = gamma_decompose(.8, n_params=1e9, has_SWA=True, apply_exploratory=True)
    assert enabled['gamma_corrected'] == pytest.approx(.65)
    assert enabled['corrections']['post_IH']['applied']
    assert enabled['delta_SWA'] == 0  # Retired, even with opt-in.


def test_v2_retired_imprint_and_candidate_provenance():
    default = gamma_decompose_v2(.8, 1000, corpus='random', is_instruct=True, has_GQA=True)
    assert default['gamma_corrected'] == pytest.approx(.91)
    assert default['corrections']['imprint']['candidate'] < 0
    assert default['delta_imprint'] == default['delta_instruct'] == default['delta_post_IH'] == 0
    enabled = gamma_decompose_v2(.8, 1000, corpus='random', is_instruct=True, apply_exploratory=True)
    assert enabled['gamma_corrected'] == pytest.approx(.55)
    assert enabled['delta_imprint'] == 0
    assert not enabled['corrections']['imprint']['applied']


def test_cli_help_and_invalid_flags_do_not_load_models():
    cli = ROOT / 'cli/diagnose_model.py'
    help_result = subprocess.run([sys.executable,str(cli),'--help'], capture_output=True, text=True)
    assert help_result.returncode == 0 and '--entropy-only' in help_result.stdout
    bad = subprocess.run([sys.executable,str(cli),'--model','unused','--entropy-tokens','0'],capture_output=True,text=True)
    assert bad.returncode == 2 and 'tokens >= 2' in bad.stderr
