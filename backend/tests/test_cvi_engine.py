"""Unit tests for the CVI Calculation Engine."""

import pytest

from app.services.cvi_engine import (
    normalise,
    compute_component_score,
    compute_vulnerability,
    compute_cri,
    normalise_all,
    compute_dimension_scores,
    compute_full_scores,
    ALL_DIMENSION_CODES,
)


class TestNormalise:
    """Stage 1 — Min-Max Normalisation tests."""

    def test_positive_direction_midpoint(self):
        result = normalise(50.0, 0.0, 100.0, "+")
        assert result == pytest.approx(0.5)

    def test_positive_direction_min(self):
        result = normalise(0.0, 0.0, 100.0, "+")
        assert result == pytest.approx(0.0)

    def test_positive_direction_max(self):
        result = normalise(100.0, 0.0, 100.0, "+")
        assert result == pytest.approx(1.0)

    def test_inverted_direction_midpoint(self):
        result = normalise(50.0, 0.0, 100.0, "-")
        assert result == pytest.approx(0.5)

    def test_inverted_direction_min(self):
        """For inverted: raw min → normalised 1.0 (lowest raw = highest vulnerability)."""
        result = normalise(0.0, 0.0, 100.0, "-")
        assert result == pytest.approx(1.0)

    def test_inverted_direction_max(self):
        """For inverted: raw max → normalised 0.0."""
        result = normalise(100.0, 0.0, 100.0, "-")
        assert result == pytest.approx(0.0)

    def test_edge_case_min_equals_max(self):
        result = normalise(5.0, 5.0, 5.0, "+")
        assert result == pytest.approx(0.5)

    def test_edge_case_min_equals_max_inverted(self):
        result = normalise(5.0, 5.0, 5.0, "-")
        assert result == pytest.approx(0.5)

    def test_out_of_range_high_clamped(self):
        result = normalise(150.0, 0.0, 100.0, "+")
        assert result == pytest.approx(1.0)

    def test_out_of_range_low_clamped(self):
        result = normalise(-10.0, 0.0, 100.0, "+")
        assert result == pytest.approx(0.0)

    def test_real_indicator_literacy_inverted(self):
        """Literacy rate is inverted (-): 75% literacy in range [30, 95] should give low vulnerability."""
        result = normalise(75.0, 30.0, 95.0, "-")
        # (75-30)/(95-30) = 45/65 ≈ 0.692, inverted: 1-0.692 ≈ 0.308
        assert result == pytest.approx(1.0 - 45.0 / 65.0, abs=0.001)

    def test_real_indicator_rainfall_positive(self):
        """Rainfall Risk Index is positive (+): 0.8 in range [0.1, 0.9]."""
        result = normalise(0.8, 0.1, 0.9, "+")
        # (0.8-0.1)/(0.9-0.1) = 0.7/0.8 = 0.875
        assert result == pytest.approx(0.875, abs=0.001)


class TestComputeComponentScore:
    """Stage 2 — Component Score Aggregation tests."""

    def test_normal_case(self):
        result = compute_component_score([0.2, 0.4, 0.6, 0.8])
        assert result == pytest.approx(0.5)

    def test_empty_list(self):
        result = compute_component_score([])
        assert result is None

    def test_single_value(self):
        result = compute_component_score([0.7])
        assert result == pytest.approx(0.7)

    def test_all_zeros(self):
        result = compute_component_score([0.0, 0.0, 0.0])
        assert result == pytest.approx(0.0)

    def test_all_ones(self):
        result = compute_component_score([1.0, 1.0, 1.0])
        assert result == pytest.approx(1.0)

    def test_mixed_values(self):
        result = compute_component_score([0.1, 0.9])
        assert result == pytest.approx(0.5)


class TestComputeVulnerability:
    """Stage 3a — Vulnerability computation tests."""

    def test_known_values(self):
        # Vulnerability = (Exposure + Sensitivity + (1 - Adaptive_Capacity)) / 3
        result = compute_vulnerability(0.6, 0.5, 0.4)
        expected = (0.6 + 0.5 + (1.0 - 0.4)) / 3
        assert result == pytest.approx(expected, abs=0.001)

    def test_all_half(self):
        result = compute_vulnerability(0.5, 0.5, 0.5)
        expected = (0.5 + 0.5 + 0.5) / 3
        assert result == pytest.approx(expected, abs=0.001)

    def test_none_exposure(self):
        result = compute_vulnerability(None, 0.5, 0.4)
        expected = (0.5 + 0.6) / 2  # only sensitivity and (1-AC)
        assert result == pytest.approx(expected, abs=0.001)

    def test_all_none(self):
        result = compute_vulnerability(None, None, None)
        assert result is None

    def test_high_adaptive_capacity_reduces_vulnerability(self):
        """High AC should reduce vulnerability."""
        v_low_ac = compute_vulnerability(0.5, 0.5, 0.2)
        v_high_ac = compute_vulnerability(0.5, 0.5, 0.8)
        assert v_low_ac > v_high_ac


class TestComputeCRI:
    """Stage 3b — CRI computation tests."""

    def test_known_values(self):
        result = compute_cri(0.6, 0.8)
        assert result == pytest.approx(0.7, abs=0.001)

    def test_both_zero(self):
        result = compute_cri(0.0, 0.0)
        assert result == pytest.approx(0.0)

    def test_both_one(self):
        result = compute_cri(1.0, 1.0)
        assert result == pytest.approx(1.0)

    def test_hazard_only(self):
        result = compute_cri(0.6, None)
        assert result == pytest.approx(0.6)

    def test_vulnerability_only(self):
        result = compute_cri(None, 0.4)
        assert result == pytest.approx(0.4)

    def test_both_none(self):
        result = compute_cri(None, None)
        assert result is None

    def test_bounded(self):
        """CRI should always be in [0, 1]."""
        result = compute_cri(1.0, 1.0)
        assert 0.0 <= result <= 1.0


class TestNormaliseAll:
    """Test normalise_all helper."""

    def test_normalise_multiple_indicators(self):
        raw_values = {
            "rainfall": {"name": "Rainfall Risk Index", "raw_value": 0.5},
            "literacy": {"name": "Literacy Rate", "raw_value": 75.0},
        }
        reference_map = {
            "rainfall": {"global_min": 0.0, "global_max": 1.0, "direction": "+", "weight": 1.0},
            "literacy": {"global_min": 30.0, "global_max": 95.0, "direction": "-", "weight": 1.0},
        }
        result = normalise_all(raw_values, reference_map)

        assert "rainfall" in result
        assert result["rainfall"]["normalised_value"] == pytest.approx(0.5)
        assert "literacy" in result
        expected_literacy = 1.0 - (75.0 - 30.0) / (95.0 - 30.0)
        assert result["literacy"]["normalised_value"] == pytest.approx(expected_literacy, abs=0.001)

    def test_missing_reference_skipped(self):
        raw_values = {
            "rainfall": {"name": "Rainfall", "raw_value": 0.5},
            "unknown": {"name": "Unknown", "raw_value": 1.0},
        }
        reference_map = {
            "rainfall": {"global_min": 0.0, "global_max": 1.0, "direction": "+", "weight": 1.0},
        }
        result = normalise_all(raw_values, reference_map)
        assert "rainfall" in result
        assert "unknown" not in result


class TestComputeDimensionScores:
    """Test dimension score aggregation."""

    def test_hazard_only(self):
        normalised = {
            "rainfall": {"normalised_value": 0.8, "name": "R", "raw_value": 0, "global_min": 0, "global_max": 1, "direction": "+"},
            "heat": {"normalised_value": 0.6, "name": "H", "raw_value": 0, "global_min": 0, "global_max": 1, "direction": "+"},
        }
        scores = compute_dimension_scores(normalised)
        assert scores["hazard"] == pytest.approx(0.7)
        assert scores["soc_exposure"] is None  # no data

    def test_all_dimensions(self):
        # One indicator per dimension
        normalised = {
            "rainfall": {"normalised_value": 0.8, "name": "R", "raw_value": 0, "global_min": 0, "global_max": 1, "direction": "+"},
            "population": {"normalised_value": 0.5, "name": "P", "raw_value": 0, "global_min": 0, "global_max": 1, "direction": "+"},
            "pop_density": {"normalised_value": 0.6, "name": "PD", "raw_value": 0, "global_min": 0, "global_max": 1, "direction": "+"},
            "literacy": {"normalised_value": 0.3, "name": "L", "raw_value": 0, "global_min": 0, "global_max": 1, "direction": "-"},
            "forest": {"normalised_value": 0.4, "name": "F", "raw_value": 0, "global_min": 0, "global_max": 1, "direction": "+"},
            "ndvi": {"normalised_value": 0.7, "name": "N", "raw_value": 0, "global_min": 0, "global_max": 1, "direction": "+"},
        }
        scores = compute_dimension_scores(normalised)
        assert scores["hazard"] == pytest.approx(0.8)
        assert scores["soc_exposure"] == pytest.approx(0.5)
        assert scores["sensitivity"] == pytest.approx(0.6)
        assert scores["adaptive_capacity"] == pytest.approx(0.3)
        assert scores["env_exposure"] == pytest.approx(0.4)
        assert scores["env_sensitivity"] == pytest.approx(0.7)


class TestComputeFullScores:
    """Test the full score computation from dimension scores."""

    def test_complete_pipeline(self):
        dimension_scores = {
            "hazard": 0.7,
            "soc_exposure": 0.6,
            "sensitivity": 0.5,
            "adaptive_capacity": 0.4,
            "env_exposure": 0.3,
            "env_sensitivity": 0.2,
        }
        result = compute_full_scores(dimension_scores)

        # Combined exposure = mean(0.6, 0.3) = 0.45
        assert result["exposure"] == pytest.approx(0.45)

        # Combined sensitivity = mean(0.5, 0.2) = 0.35
        # Vulnerability = (0.45 + 0.35 + (1-0.4)) / 3 = (0.45 + 0.35 + 0.6) / 3 = 1.4/3 ≈ 0.4667
        expected_vuln = (0.45 + 0.35 + 0.6) / 3
        assert result["vulnerability"] == pytest.approx(expected_vuln, abs=0.001)

        # CRI = (0.7 + vulnerability) / 2
        expected_cri = (0.7 + expected_vuln) / 2
        assert result["cri"] == pytest.approx(expected_cri, abs=0.001)

    def test_missing_dimensions(self):
        dimension_scores = {
            "hazard": 0.7,
            "soc_exposure": None,
            "sensitivity": 0.5,
            "adaptive_capacity": None,
            "env_exposure": None,
            "env_sensitivity": None,
        }
        result = compute_full_scores(dimension_scores)
        assert result["exposure"] is None
        # Vulnerability uses only sensitivity (no exposure, no AC)
        assert result["vulnerability"] == pytest.approx(0.5)
        # CRI = (0.7 + 0.5) / 2 = 0.6
        assert result["cri"] == pytest.approx(0.6)
