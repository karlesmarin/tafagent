"""Independent 60-digit reference vectors and semantic regression checks."""
import math, json, sys
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/"python"),str(ROOT/"cli")]
import taf_browser as browser
import diagnose_model as cli
VECTORS=json.loads((ROOT/"tests/finite_family_vectors.json").read_text())["cases"]

@pytest.mark.parametrize("case",VECTORS)
def test_independent_finite_sum_vectors(case):
    g,N=case["gamma"],case["N"]
    for module in [browser,cli]:
        actual=module.finite_family(g,N)
        for key in ["Z","U","I","Cv","S"]:
            assert actual[key]==pytest.approx(case[key],rel=1e-10,abs=1e-11)
        assert module.finite_quantile(g,N)==case["D90"]
    assert cli.partition_Z(g,N)==pytest.approx(case["Z"],rel=1e-10)
    assert cli.mean_log_d(g,N)==pytest.approx(case["U"],rel=1e-10)
    assert cli.heat_capacity_Cv(g,N)==pytest.approx(case["Cv"],abs=1e-11)
    assert cli.entropy_S(g,N)==pytest.approx(case["S"],abs=1e-11)
    assert cli.D_f_closed(g,.9,N)==browser.df_window(g,N)==case["D90"]

@pytest.mark.parametrize("g,N",[(float("nan"),5),(float("inf"),5),(1,0),(1,1.5),(1,True)])
def test_invalid_family_domain(g,N):
    for module in [browser,cli]:
        with pytest.raises(ValueError):module.finite_family(g,N)

@pytest.mark.parametrize("f",[0,1,-.2,float("nan"),True])
def test_invalid_mass(f):
    with pytest.raises(ValueError):browser.df_window(.7,50,f)

def test_zero_negative_and_singleton():
    assert cli.free_energy_F(0,2000) is None
    assert cli.free_energy_F(-1,14)==pytest.approx(math.log(105))
    for g in [-1000,0,1,1000]:
        r=browser.finite_family(g,1)
        assert r["I"]==r["Cv"]==r["S"]==0
        assert browser.df_window(g,1)==1
    assert browser.df_window(-1000,2000)==2000

def params(T=2048):
    return dict(theta=10000,T_train=2048,T_eval=T,n_attention_heads=8,
                n_kv_heads=8,d_head=64,n_layers=6,n_params=7e7)

@pytest.mark.parametrize("T",[512,1024,2000,2048,4096,8192,65536])
@pytest.mark.parametrize("observed",[None,0,.7,1,1.05,-.2])
def test_no_capacity_from_inverse_or_observed_slope(T,observed):
    p=params(T);g=browser.gamma_pade(p["theta"],T)
    assert browser.d_horizon(p["theta"],g)==pytest.approx(T)
    out=browser.run_recipe_x2(**p,gamma_obs=observed)
    assert out["verdict"]=="NEEDS EVALUATION"
    assert out["retrieval_prediction"] is None
    assert all(x["key"]!="benchmark_yes" for x in out["confidence"]["factors"])
    kv=browser.run_recipe_x19(**p,gamma_obs=observed)
    assert kv["policy_recommendation"] is None

def test_no_architecture_correction_by_default():
    for gqa in [False,True]:
        r=browser.gamma_decompose(.977,has_GQA=gqa,has_SWA=True,n_params=8e9)
        assert r["gamma_corrected"]==.977
    assert browser.gamma_decompose(.7,has_GQA=True,apply_exploratory=True)["delta_GQA"]==.11

def test_profile_and_sign_contract():
    p=browser.profile_model(**params())
    assert p["gamma_observed"] is None
    assert p["key_numbers"]["L_NIAH_ceiling"] is None
    assert p["v04_diagnostics"]=={}
    assert "IH" not in p["model_summary"]["architecture_class"]
    c=browser.ih_phase_check(.7,.9,8000)
    assert c["gamma_random_minus_text"]==pytest.approx(.2)
    assert c["delta_gamma"]==pytest.approx(-.2)
    assert c["phase_observed"] is None

def test_kv_bf16_bytes():
    r=browser.kv_cache_memory(6,8,64,2048,2)
    assert r["bytes"]==4*6*8*64*2048
