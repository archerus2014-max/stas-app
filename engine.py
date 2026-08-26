# C:\STAS\backend\engine.py
import re
from datetime import datetime, timezone, date
from typing import Dict, List, Optional

from .models import SportAvailability, SportProfile, StasResult, UserProfile, SportScore
from .scoring import rank_sports, calculate_target_adult_height

EXACT_LANGEPAS_SECTIONS = {
    # 1. СШОР «Академия спорта» (10 направлений)
    "бокс": "СШОР «Академия спорта»",
    "дзюдо": "СШОР «Академия спорта»",
    "самбо": "СШОР «Академия спорта»",
    "прыжки на батуте": "СШОР «Академия спорта»",
    "спортивная акробатика": "СШОР «Академия спорта»",
    "стрельба из лука": "СШОР «Академия спорта»",
    "спортивная борьба (вольная борьба)": "СШОР «Академия спорта»",
    "вольная борьба": "СШОР «Академия спорта»",
    "спортивная борьба": "СШОР «Академия спорта»",
    "тяжёлая атлетика": "СШОР «Академия спорта»",
    "тяжелая атлетика": "СШОР «Академия спорта»",
    "смешанное боевое единоборство (мма)": "СШОР «Академия спорта»",
    "смешанное боевое единоборство (мма": "СШОР «Академия спорта»",
    "мма": "СШОР «Академия спорта»",
    "грепплинг": "СШОР «Академия спорта»",
    "грэпплинг": "СШОР «Академия спорта»",

    # 2. СШ «Лангепас» (8 направлений)
    "баскетбол": "СШ «Лангепас»",
    "волейбол": "СШ «Лангепас»",
    "мини-футбол (футзал)": "СШ «Лангепас»",
    "мини-футбол": "СШ «Лангепас»",
    "футзал": "СШ «Лангепас»",
    "хоккей": "СШ «Лангепас»",
    "лыжные гонки": "СШ «Лангепас»",
    "тхэквондо": "СШ «Лангепас»",
    "муайтай (тайский бокс)": "СШ «Лангепас»",
    "муайтай": "СШ «Лангепас»",
    "тайский бокс": "СШ «Лангепас»",
    "шахматы": "СШ «Лангепас»",

    # 3. СШ «Дельфин» (4 направления)
    "плавание": "СШ «Дельфин»",
    "художественная гимнастика": "СШ «Дельфин»",
    "теннис": "СШ «Дельфин»",
    "настольный теннис": "СШ «Дельфин»"
}

def calculate_exact_age(birth_date_str: str) -> float:
    try:
        b_date = datetime.strptime(birth_date_str, "%Y-%m-%d").date()
        today = date.today()
        years = today.year - b_date.year
        if (today.month, today.day) < (b_date.month, b_date.day):
            years -= 1
        months = (today.month - b_date.month) % 12
        return round(years + months / 12.0, 1)
    except Exception:
        return 5.0

def run_stas(
    user: UserProfile,
    sports: List[SportProfile],
    availability: Optional[List[SportAvailability]] = None,
    data_version: Optional[str] = None,
) -> StasResult:
    warnings: List[str] = []

    # Расчет точного возраста из даты рождения
    user.age_years = calculate_exact_age(user.birth_date)

    # 1. Расчет базового научного рейтинга
    scores = rank_sports(user=user, sports=sports)

    # 2. Идентификация секций Лангепаса и каскадный бонус
    for item in scores:
        clean_name = item.sport_name.lower().strip()
        org_name = EXACT_LANGEPAS_SECTIONS.get(clean_name)

        if org_name:
            item.availability_status = "active"
            item.availability_note = f"{org_name}"
            item.local_availability = SportAvailability(
                sport_id=clean_name.replace(" ", "_"),
                name=item.sport_name,
                status="active",
                organization_or_object=org_name,
                address="г. Лангепас",
                notes="Официальное отделение"
            )

            # Каскадный бонус
            if "Академия спорта" in org_name:
                item.score = round(min(10.0, item.score + 1.8), 1)
                item.reasons_positive.append("🏆 Отделение СШОР «Академия спорта»")
            else:
                item.score = round(min(10.0, item.score + 1.0), 1)
                item.reasons_positive.append(f"🏛️ Секция доступна в {org_name}")
        else:
            item.availability_status = "unknown"
            item.availability_note = "Всероссийский вид спорта"

    scores.sort(key=lambda x: x.score, reverse=True)

    valid_scores = [item for item in scores if item.age_eligible]
    langepas_top = [item for item in valid_scores if item.availability_status == "active"]
    alternatives = [item for item in valid_scores if item.availability_status != "active"]

    top_sports = langepas_top[:5] if langepas_top else valid_scores[:5]

    # Сбор пользовательской информации для Дашборда
    h_m = user.height_cm / 100.0
    bmi = round(user.weight_kg / (h_m * h_m), 1) if h_m > 0 else 20.0
    target_h = calculate_target_adult_height(user)
    
    sex_label = ""
    if user.age_years < 18:
        sex_label = "Девочка" if user.sex == "female" else "Мальчик"
    else:
        sex_label = "Женщина" if user.sex == "female" else "Мужчина"

    user_info = {
        "full_name": user.full_name or "Спортсмен",
        "birth_date": user.birth_date,
        "age_years": user.age_years,
        "sex_label": sex_label,
        "height_cm": user.height_cm,
        "weight_kg": user.weight_kg,
        "bmi": bmi,
        "target_adult_height_cm": target_h,
        "temperament": user.temperament,
        "tapping_test": user.tapping_test.dict() if user.tapping_test else None,
        "physical": user.physical
    }

    return StasResult(
        user_info=user_info,
        scores=scores,
        top_sports=top_sports,
        langepas_sports=langepas_top[:5],
        alternatives=alternatives[:5],
        age_excluded=[item for item in scores if not item.age_eligible],
        warnings=warnings,
        data_version=data_version or "9.0 (Дашборд Москомспорт + Генетика + Ильин)",
        generated_at=datetime.now(timezone.utc).isoformat(),
        metadata={"engine": "STAS", "engine_version": "9.0"}
    )