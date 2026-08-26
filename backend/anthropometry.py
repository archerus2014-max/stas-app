from dataclasses import asdict
from typing import Dict, Any

from .models import UserProfile


class AnthropometryError(ValueError):
    """Ошибка некорректных антропометрических данных."""


def _validate_positive(value: float, name: str) -> None:
    if value <= 0:
        raise AnthropometryError(f"{name} должен быть больше нуля")


def calculate_bmi(height_cm: float, weight_kg: float) -> float:
    """Рассчитать ИМТ по росту в сантиметрах и массе в килограммах."""
    _validate_positive(height_cm, "Рост")
    _validate_positive(weight_kg, "Вес")

    height_m = height_cm / 100.0
    bmi = weight_kg / (height_m * height_m)
    return round(bmi, 2)


def analyze_anthropometry(profile: UserProfile) -> Dict[str, Any]:
    """
    Подготовить антропометрический профиль пользователя.

    Важно:
    - функция не ставит медицинский диагноз;
    - для детей не применяются взрослые фиксированные пороги ИМТ;
    - нормативная интерпретация процентилей будет подключена после
      добавления подтверждённых референсных данных в data/anthropometry.json.
    """
    result: Dict[str, Any] = {
        "available": False,
        "age_years": profile.age_years,
        "sex": profile.sex,
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "bmi": None,
        "bmi_interpretation": "not_available",
        "warnings": [],
    }

    if profile.age_years <= 0:
        result["warnings"].append("Возраст должен быть больше нуля.")
        return result

    if profile.height_cm is None or profile.weight_kg is None:
        result["warnings"].append(
            "Для расчёта ИМТ необходимо указать рост и вес."
        )
        return result

    try:
        bmi = calculate_bmi(profile.height_cm, profile.weight_kg)
    except AnthropometryError as exc:
        result["warnings"].append(str(exc))
        return result

    result["available"] = True
    result["bmi"] = bmi

    # Здесь намеренно нет медицинской классификации.
    # Для детей и подростков нужна возрастно-половая референсная база.
    if profile.age_years < 18:
        result["bmi_interpretation"] = "requires_age_sex_reference_data"
    else:
        result["bmi_interpretation"] = "requires_validated_adult_reference_data"

    return result


def anthropometry_for_engine(profile: UserProfile) -> Dict[str, float]:
    """Вернуть только числовые признаки для расчётного движка."""
    analysis = analyze_anthropometry(profile)

    features: Dict[str, float] = {}

    if analysis["bmi"] is not None:
        features["bmi"] = float(analysis["bmi"])

    if profile.height_cm is not None:
        features["height_cm"] = float(profile.height_cm)

    if profile.weight_kg is not None:
        features["weight_kg"] = float(profile.weight_kg)

    return features
