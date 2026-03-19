"""Tests for the What-If Simulation engine and custom weighting."""

import pytest

from app.services.cvi_engine import (
    normalise,
    normalise_all,
    compute_component_score,
    compute_dimension_scores,
    compute_full_scores,
    compute_weighted_scores,
)


class TestComputeWeightedScores:
    """Test weighted CRI computation for simulation mode."""

    def test_equal_weights_matches_default(self):
        """Equal weights should produce the same result as the default pipeline."""
        dimension_scores = {
            "hazard": 0.7,
            "soc_exposure": 0.6,
            "sensitivity": 0.5,
            "adaptive_capacity": 0.4,
            "env_exposure": 0.3,
            "env_sensitivity": 0.2,
        }
        default_result = compute_full_scores(dimension_scores)

        # With no weights, should fall back to default
        weighted_none = compute_weighted_scores(dimension_scores, weights=None)
        assert weighted_none["cri"] == pytest.approx(default_result["cri"], abs=0.001)

    def test_custom_weights_change_result(self):
        """Different weights should produce a different CRI."""
        dimension_scores = {
            "hazard": 0.9,
            "soc_exposure": 0.2,
            "sensitivity": 0.3,
            "adaptive_capacity": 0.8,
            "env_exposure": 0.2,
            "env_sensitivity": 0.3,
        }
        default_result = compute_full_scores(dimension_scores)

        # Weight heavily towards hazard
        hazard_heavy = compute_weighted_scores(dimension_scores, {
            "hazard": 0.7, "exposure": 0.1, "sensitivity": 0.1, "adaptive_capacity": 0.1,
        })

        # With high hazard score (0.9) and heavy hazard weight,
        # CRI should be higher than default
        assert hazard_heavy["cri"] > default_result["cri"]

    def test_zero_hazard_weight(self):
        """Zero hazard weight should give vulnerability-driven CRI."""
        dimension_scores = {
            "hazard": 0.9,
            "soc_exposure": 0.3,
            "sensitivity": 0.3,
            "adaptive_capacity": 0.7,
            "env_exposure": 0.3,
            "env_sensitivity": 0.3,
        }

        result = compute_weighted_scores(dimension_scores, {
            "hazard": 0.0, "exposure": 0.33, "sensitivity": 0.33, "adaptive_capacity": 0.34,
        })

        # With zero hazard weight, CRI should be entirely vulnerability-driven
        # and lower than if hazard (0.9) were included
        assert result["cri"] is not None
        assert result["cri"] < 0.9  # since vulnerability is much lower than hazard

    def test_weights_with_missing_dimensions(self):
        """Weighted scores should handle missing dimension gracefully."""
        dimension_scores = {
            "hazard": 0.7,
            "soc_exposure": None,
            "sensitivity": 0.5,
            "adaptive_capacity": 0.4,
            "env_exposure": None,
            "env_sensitivity": None,
        }
        result = compute_weighted_scores(dimension_scores, {
            "hazard": 0.25, "exposure": 0.25, "sensitivity": 0.25, "adaptive_capacity": 0.25,
        })
        assert result["cri"] is not None
        assert 0.0 <= result["cri"] <= 1.0


class TestSimulationScenarios:
    """Test simulation scenarios with modified indicator values."""

    def test_reducing_sensitivity_reduces_cri(self):
        """Reducing a sensitivity indicator (like pop_density) should reduce CRI."""
        reference_map = {
            "rainfall": {"global_min": 0.0, "global_max": 1.0, "direction": "+", "weight": 1.0},
            "pop_density": {"global_min": 100.0, "global_max": 5000.0, "direction": "+", "weight": 1.0},
            "population": {"global_min": 0.0, "global_max": 1000000.0, "direction": "+", "weight": 1.0},
        }

        # Original: high pop density
        raw_orig = {
            "rainfall": {"name": "Rainfall", "raw_value": 0.7},
            "pop_density": {"name": "Pop Density", "raw_value": 4000.0},
            "population": {"name": "Population", "raw_value": 500000.0},
        }

        # Simulated: low pop density
        raw_sim = {
            "rainfall": {"name": "Rainfall", "raw_value": 0.7},
            "pop_density": {"name": "Pop Density", "raw_value": 500.0},
            "population": {"name": "Population", "raw_value": 500000.0},
        }

        norm_orig = normalise_all(raw_orig, reference_map)
        dim_orig = compute_dimension_scores(norm_orig)
        full_orig = compute_full_scores(dim_orig)

        norm_sim = normalise_all(raw_sim, reference_map)
        dim_sim = compute_dimension_scores(norm_sim)
        full_sim = compute_full_scores(dim_sim)

        # Lower pop density → lower sensitivity → lower vulnerability → lower CRI
        assert full_sim["cri"] < full_orig["cri"]

    def test_increasing_hazard_increases_cri(self):
        """Increasing a positive hazard indicator should increase CRI."""
        reference_map = {
            "rainfall": {"global_min": 0.0, "global_max": 1.0, "direction": "+", "weight": 1.0},
            "salinity": {"global_min": 0.0, "global_max": 30.0, "direction": "+", "weight": 1.0},
        }

        raw_orig = {
            "rainfall": {"name": "Rainfall", "raw_value": 0.5},
            "salinity": {"name": "Salinity", "raw_value": 5.0},
        }
        raw_sim = {
            "rainfall": {"name": "Rainfall", "raw_value": 0.5},
            "salinity": {"name": "Salinity", "raw_value": 20.0},
        }

        norm_orig = normalise_all(raw_orig, reference_map)
        dim_orig = compute_dimension_scores(norm_orig)
        full_orig = compute_full_scores(dim_orig)

        norm_sim = normalise_all(raw_sim, reference_map)
        dim_sim = compute_dimension_scores(norm_sim)
        full_sim = compute_full_scores(dim_sim)

        # Higher salinity → higher hazard score → higher CRI
        assert full_sim["cri"] > full_orig["cri"]

    def test_no_changes_same_result(self):
        """Simulation with same values should produce identical scores."""
        reference_map = {
            "rainfall": {"global_min": 0.0, "global_max": 1.0, "direction": "+", "weight": 1.0},
        }
        raw = {
            "rainfall": {"name": "Rainfall", "raw_value": 0.6},
        }

        norm = normalise_all(raw, reference_map)
        dim = compute_dimension_scores(norm)
        full = compute_full_scores(dim)

        # "Simulate" with same values
        norm2 = normalise_all(raw, reference_map)
        dim2 = compute_dimension_scores(norm2)
        full2 = compute_full_scores(dim2)

        assert full["cri"] == pytest.approx(full2["cri"])

    def test_custom_weights_validation(self):
        """Custom weights that sum to 1.0 should work correctly."""
        dimension_scores = {
            "hazard": 0.5,
            "soc_exposure": 0.5,
            "sensitivity": 0.5,
            "adaptive_capacity": 0.5,
            "env_exposure": 0.5,
            "env_sensitivity": 0.5,
        }

        # All equal with equal dimensions → should produce 0.5 CRI
        result = compute_weighted_scores(dimension_scores, {
            "hazard": 0.25, "exposure": 0.25, "sensitivity": 0.25, "adaptive_capacity": 0.25,
        })
        assert result["cri"] == pytest.approx(0.5, abs=0.001)

    def test_normalise_inverted_indicator(self):
        """Verify inverted normalisation for adaptive capacity indicators."""
        # Literacy 80% in range [30, 95]: (80-30)/(95-30) = 50/65 ≈ 0.769
        # Inverted: 1 - 0.769 ≈ 0.231 (high literacy = low vulnerability)
        result = normalise(80.0, 30.0, 95.0, "-")
        expected = 1.0 - (80.0 - 30.0) / (95.0 - 30.0)
        assert result == pytest.approx(expected, abs=0.001)
        assert result < 0.5  # high literacy should mean low vulnerability contribution

    def test_normalise_positive_indicator(self):
        """Verify positive normalisation for hazard indicators."""
        # Salinity 20 ppt in range [0, 30]: 20/30 ≈ 0.667
        result = normalise(20.0, 0.0, 30.0, "+")
        expected = 20.0 / 30.0
        assert result == pytest.approx(expected, abs=0.001)
        assert result > 0.5  # high salinity = high vulnerability
