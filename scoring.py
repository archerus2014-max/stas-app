# C:\STAS\backend\scoring.py
from typing import Dict, List, Optional, Tuple
from .models import SportProfile, UserProfile, SportScore

SPORT_BIOMECHANICS = {
    "acrobatics": {"bmi_min": 14.5, "bmi_max": 20.5, "flexibility": 9, "coordination": 9, "speed": 7, "strength": 6, "endurance": 6, "ideal_height": "low"},
    "trampoline": {"bmi_min": 14.5, "bmi_max": 20.5, "flexibility": 8, "coordination": 9, "speed": 8, "strength": 6, "endurance": 6, "ideal_height": "low"},
    "rhythmic_gymnastics": {"bmi_min": 14.0, "bmi_max": 19.5, "flexibility": 10, "coordination": 9, "speed": 7, "strength": 5, "endurance": 6, "ideal_height": "medium_high"},
    "swimming": {"bmi_min": 16.0, "bmi_max": 22.5, "endurance": 9, "coordination": 7, "strength": 7, "flexibility": 7, "speed": 7, "ideal_height": "high"},
    "basketball": {"bmi_min": 17.0, "bmi_max": 23.5, "speed": 8, "coordination": 8, "endurance": 8, "strength": 7, "ideal_height": "high"},
    "volleyball": {"bmi_min": 17.0, "bmi_max": 23.0, "speed": 8, "coordination": 8, "endurance": 7, "strength": 7, "ideal_height": "high"},
    "judo": {"bmi_min": 17.5, "bmi_max": 25.0, "strength": 8, "coordination": 8, "endurance": 7, "speed": 7, "flexibility": 6, "ideal_height": "any"},
    "sambo": {"bmi_min": 17.5, "bmi_max": 25.0, "strength": 8, "coordination": 8, "endurance": 7, "speed": 7, "flexibility": 6, "ideal_height": "any"},
    "freestyle_wrestling": {"bmi_min": 17.5, "bmi_max": 25.0, "strength": 9, "coordination": 8, "endurance": 8, "speed": 7, "flexibility": 7, "ideal_height": "low"},
    "boxing": {"bmi_min": 17.0, "bmi_max": 24.5, "speed": 9, "strength": 7, "endurance": 8, "coordination": 8, "flexibility": 5, "ideal_height": "any"},
    "weightlifting": {"bmi_min": 18.5, "bmi_max": 27.0, "strength": 10, "coordination": 6, "speed": 7, "flexibility": 5, "endurance": 5, "ideal_height": "low"},
    "archery": {"bmi_min": 15.5, "bmi_max": 25.0, "coordination": 9, "strength": 6, "endurance": 6, "speed": 4, "flexibility": 5, "ideal_height": "any"},
    "tennis": {"bmi_min": 16.0, "bmi_max": 23.0, "speed": 9, "coordination": 9, "endurance": 7, "flexibility": 6, "strength": 6, "ideal_height": "medium_high"},
    "table_tennis": {"bmi_min": 15.5, "bmi_max": 24.0, "speed": 10, "coordination": 9, "flexibility": 6, "strength": 5, "endurance": 6, "ideal_height": "any"},
    "chess": {"bmi_min": 14.0, "bmi_max": 30.0, "coordination": 4, "strength": 3, "speed": 3, "flexibility": 3, "endurance": 4, "ideal_height": "any"}
}

def _clamp(val: float, min_v: float = 0.0, max_v: float = 10.0) -> float:
    return max(min_v, min(max_v, float(val)))

def calculate_target_adult_height(user: UserProfile) -> Optional[float]:
    """Формула Таннера для прогноза конечного взрослого роста."""
    f_h = user.father_height_cm
    m_h = user.mother_height_cm
    
    if f_h and m_h:
        if user.sex == "male":
            return round((f_h + m_h + 13.0) / 2.0, 1)
        else:
            return round((f_h + m_h - 13.0) / 2.0, 1)
    elif f_h:
        m_est = 165.0
        return round((f_h + m_est + (13.0 if user.sex == "male" else -13.0)) / 2.0, 1)
    elif m_h:
        f_est = 178.0
        return round((f_est + m_h + (13.0 if user.sex == "male" else -13.0)) / 2.0, 1)
    
    return None

def score_sport(
    user: UserProfile,
    sport: SportProfile,
    anthropometry: Dict[str, float] | None = None,
    weights: Dict[str, float] | None = None,
) -> SportScore:
    h_m = user.height_cm / 100.0
    bmi = user.weight_kg / (h_m * h_m) if h_m > 0 else 20.0

    clean_name = sport.name.lower().strip()
    prof = None
    for k, v in SPORT_BIOMECHANICS.items():
        if k in clean_name or clean_name in k:
            prof = v
            break

    reasons_pos = []
    reasons_neg = []

    # 1. Оценка ИМТ
    if prof:
        bmi_min, bmi_max = prof["bmi_min"], prof["bmi_max"]
        if bmi_min <= bmi <= bmi_max:
            bmi_score = 9.2
            reasons_pos.append("ИМТ соответствует норме вида спорта")
        elif bmi < bmi_min:
            diff = bmi_min - bmi
            bmi_score = max(5.0, 9.2 - diff * 1.5)
            reasons_neg.append(f"ИМТ ({bmi:.1f}) ниже рекомендуемого")
        else:
            diff = bmi - bmi_max
            bmi_score = max(5.0, 9.2 - diff * 1.2)
            reasons_neg.append(f"ИМТ ({bmi:.1f}) выше рекомендуемого")
    else:
        bmi_score = 7.0

    # 2. Генетический прогноз роста (Таннер)
    target_height = calculate_target_adult_height(user)
    gen_score = 7.5
    if target_height and prof and "ideal_height" in prof:
        ideal_h = prof["ideal_height"]
        if ideal_h == "high" and target_height >= 180:
            gen_score = 9.5
            reasons_pos.append(f"Прогнозируемый взрослый рост ({target_height:.0f} см) является преимуществом")
        elif ideal_h == "low" and target_height <= 170:
            gen_score = 9.5
            reasons_pos.append(f"Компактный рост ({target_height:.0f} см) идеален для низкой центровки")
        elif ideal_h == "high" and target_height < 165:
            gen_score = 5.5
            reasons_neg.append(f"Прогнозируемый рост ({target_height:.0f} см) ниже среднего для вида")

    # 3. Оценка физических качеств (5 качеств)
    if prof:
        phys_diffs = []
        for q_key in ["speed", "strength", "coordination", "flexibility", "endurance"]:
            if q_key in prof:
                u_val = user.physical.get(q_key, 6)
                req_val = prof[q_key]
                diff = abs(u_val - req_val)
                match_val = max(2.0, 10.0 - diff * 1.5)
                phys_diffs.append(match_val)
                if diff <= 1:
                    reasons_pos.append(f"Хорошая подготовленность: {q_key}")
        phys_score = sum(phys_diffs) / len(phys_diffs) if phys_diffs else 7.0
    else:
        phys_score = 7.0

    # 4. Темперамент и нервная система (Теппинг-тест)
    psych_score = 7.0
    temp = user.temperament or "sanguine"
    
    # Модификатор темперамента
    if temp == "choleric" and any(k in clean_name for k in ["бокс", "единоборств", "мма", "борьба", "дзюдо", "самбо"]):
        psych_score += 1.5
        reasons_pos.append("Холерический темперамент идеален для взрывных единоборств")
    elif temp == "sanguine" and any(k in clean_name for k in ["баскетбол", "волейбол", "теннис", "футбол"]):
        psych_score += 1.5
        reasons_pos.append("Сангвинический тип эффективен в командных и игровых видах")
    elif temp == "phlegmatic" and any(k in clean_name for k in ["лыжи", "плавание", "стрельба", "шахматы"]):
        psych_score += 1.5
        reasons_pos.append("Флегматический тип устойчив в циклических и монотоноемких видах")
    elif temp == "melancholic" and any(k in clean_name for k in ["гимнастика", "фигурное", "акробатика"]):
        psych_score += 1.5
        reasons_pos.append("Высокая тонкая чувствительность для сложнокоординационных видов")

    # Учет Теппинг-теста Ильина
    if user.tapping_test:
        nerve = user.tapping_test.nerve_type
        if "Сильная" in nerve and any(k in clean_name for k in ["бокс", "борьба", "силовая", "тяжелая"]):
            psych_score += 1.0
            reasons_pos.append("Теппинг-тест Ильина: Сильная нервная система устойчива к утомлению")
        elif "Слабая" in nerve and any(k in clean_name for k in ["гимнастика", "теннис", "стрельба"]):
            psych_score += 1.0
            reasons_pos.append("Теппинг-тест Ильина: Высокая лабильность НС для быстрой реакции")

    psych_score = _clamp(psych_score)

    base_score = (
        (phys_score * 0.30) +
        (bmi_score * 0.20) +
        (gen_score * 0.20) +
        (psych_score * 0.30)
    )

    final_score = round(_clamp(base_score), 1)

    return SportScore(
        sport_id=sport.id,
        sport_name=sport.name,
        score=final_score,
        components={
            "physical": round(phys_score, 2),
            "anthropometry": round(bmi_score, 2),
            "genetics": round(gen_score, 2),
            "psychology": round(psych_score, 2),
        },
        reasons_positive=list(set(reasons_pos)),
        reasons_negative=list(set(reasons_neg)),
        age_eligible=True,
        age_min=sport.age_min,
        age_max=sport.age_max,
        age_note=None
    )

def rank_sports(
    user: UserProfile,
    sports: List[SportProfile],
    anthropometry: Dict[str, float] | None = None,
    weights: Dict[str, float] | None = None,
) -> List[SportScore]:
    results = []
    user_age = user.age_years

    for sport in sports:
        min_age = sport.age_min or 7

        # ЖЕСТКАЯ ЗАЩИТА ФССП РФ: ИСКЛЮЧЕНИЕ МЛАДШЕ МИНИМАЛЬНОГО ВОЗРАСТА
        if user_age < min_age:
            continue

        results.append(score_sport(user=user, sport=sport, anthropometry=anthropometry))

    return sorted(results, key=lambda item: item.score, reverse=True)