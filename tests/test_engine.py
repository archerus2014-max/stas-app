import unittest

from backend.engine import run_stas
from backend.models import SportAvailability, SportProfile, UserProfile


class TestStasEngine(unittest.TestCase):

    def setUp(self):
        self.user = UserProfile(
            age_years=14,
            sex="male",
            height_cm=165,
            weight_kg=55,
            physical={
                "speed": 8,
                "strength": 6,
                "endurance": 7,
                "coordination": 8,
                "flexibility": 6,
            },
            psychology={
                "teamwork": 8,
                "discipline": 7,
                "competition": 8,
            },
            goal="competition",
        )

        self.sports = [
            SportProfile(
                id="test_basketball",
                name="Тестовый баскетбол",
                category="Игровые",
                physical={
                    "speed": 8,
                    "strength": 6,
                    "endurance": 7,
                    "coordination": 8,
                    "flexibility": 6,
                },
                psychology={
                    "teamwork": 8,
                    "discipline": 7,
                    "competition": 8,
                },
                team=True,
                contact="medium",
            ),
            SportProfile(
                id="test_chess",
                name="Тестовые шахматы",
                category="Интеллектуально-спортивные",
                physical={
                    "speed": 2,
                    "strength": 2,
                    "endurance": 2,
                    "coordination": 3,
                    "flexibility": 2,
                },
                psychology={
                    "teamwork": 3,
                    "discipline": 8,
                    "competition": 6,
                },
                team=False,
                contact="none",
            ),
        ]

        self.availability = [
            SportAvailability(
                sport_id="test_basketball",
                name="Тестовый баскетбол",
                status="active",
                organization_or_object="Тестовый спортивный объект",
                address="Лангепас",
                source="test",
                checked_at="2026-08-24",
            ),
            SportAvailability(
                sport_id="test_chess",
                name="Тестовые шахматы",
                status="unknown",
                source="test",
                checked_at="2026-08-24",
            ),
        ]

    def test_engine_returns_scores(self):
        result = run_stas(
            user=self.user,
            sports=self.sports,
            availability=self.availability,
            data_version="test",
        )

        self.assertEqual(len(result.scores), 2)
        self.assertGreaterEqual(result.scores[0].score, 0)
        self.assertLessEqual(result.scores[0].score, 100)

    def test_available_sport_is_selected(self):
        result = run_stas(
            user=self.user,
            sports=self.sports,
            availability=self.availability,
        )

        self.assertEqual(len(result.langepas_sports), 1)
        self.assertEqual(
            result.langepas_sports[0].sport_id,
            "test_basketball",
        )

    def test_unknown_sport_can_be_alternative(self):
        result = run_stas(
            user=self.user,
            sports=self.sports,
            availability=self.availability,
        )

        self.assertTrue(
            any(item.sport_id == "test_chess" for item in result.alternatives)
        )

    def test_missing_anthropometry_produces_warning(self):
        user = UserProfile(age_years=14)

        result = run_stas(
            user=user,
            sports=self.sports,
            availability=self.availability,
        )

        self.assertTrue(
            any("рост" in warning.lower() for warning in result.warnings)
        )


if __name__ == "__main__":
    unittest.main()
