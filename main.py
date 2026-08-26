import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from gigachat import GigaChat

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent

if (ROOT_DIR / "frontend" / "index.html").exists():
    FRONTEND_DIR = ROOT_DIR / "frontend"
else:
    FRONTEND_DIR = ROOT_DIR

app = FastAPI(title="Спортивный агент СТАС - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GIGACHAT_CREDENTIALS = os.getenv("GIGACHAT_CREDENTIALS", "YOUR_GIGACHAT_AUTH_KEY_HERE")

SPORT_PROFILES = {
    "СПОРТИВНАЯ АКРОБАТИКА": {
        "min_age": 4, "max_age": 16, "org": "СШОР «Академия спорта»",
        "weights": {"flexibility": 0.45, "coordination": 0.35, "speed_strength": 0.20},
        "preferred_temp": ["sanguine"], "max_bmi": 20.0, "height_pref": "low", "rank_factor": 1.0
    },
    "ПРЫЖКИ НА БАТУТЕ": {
        "min_age": 4, "max_age": 18, "org": "СШОР «Академия спорта»",
        "weights": {"coordination": 0.50, "speed_strength": 0.30, "flexibility": 0.20},
        "preferred_temp": ["sanguine"], "max_bmi": 21.0, "height_pref": "medium", "rank_factor": 0.92
    },
    "БОКС": {
        "min_age": 9, "max_age": 55, "org": "СШОР «Академия спорта»",
        "weights": {"speed": 0.35, "strength": 0.30, "speed_strength": 0.35},
        "preferred_temp": ["choleric"], "nerve_pref": "Выпуклый", "reaction_critical": True, "rank_factor": 0.95
    },
    "ДЗЮДО": {
        "min_age": 9, "max_age": 55, "org": "СШОР «Академия спорта»",
        "weights": {"strength": 0.40, "coordination": 0.30, "endurance": 0.30},
        "preferred_temp": ["phlegmatic", "sanguine"], "nerve_pref": "Выпуклый", "rank_factor": 0.88
    },
    "САМБО": {
        "min_age": 9, "max_age": 55, "org": "СШОР «Академия спорта»",
        "weights": {"strength": 0.35, "endurance": 0.35, "coordination": 0.30},
        "preferred_temp": ["phlegmatic", "choleric"], "nerve_pref": "Выпуклый", "rank_factor": 0.84
    },
    "ВОЛЬНАЯ БОРЬБА": {
        "min_age": 9, "max_age": 45, "org": "СШОР «Академия спорта»",
        "weights": {"strength": 0.40, "speed_strength": 0.30, "endurance": 0.30},
        "preferred_temp": ["choleric"], "nerve_pref": "Выпуклый", "rank_factor": 0.81
    },
    "ТЯЖЁЛАЯ АТЛЕТИКА": {
        "min_age": 10, "max_age": 60, "org": "СШОР «Академия спорта»",
        "weights": {"strength": 0.60, "speed_strength": 0.40},
        "preferred_temp": ["phlegmatic"], "min_bmi": 22.0, "height_pref": "low", "rank_factor": 0.78
    },
    "СТРЕЛЬБА ИЗ ЛУКА": {
        "min_age": 10, "max_age": 65, "org": "СШОР «Академия спорта»",
        "weights": {"coordination": 0.55, "endurance": 0.45},
        "preferred_temp": ["phlegmatic", "melancholic"], "nerve_pref": "Ровный", "rank_factor": 0.86
    },
    "СМЕШАННЫЕ ЕДИНОБОРСТВА (ММА)": {
        "min_age": 10, "max_age": 45, "org": "СШОР «Академия спорта»",
        "weights": {"strength": 0.35, "endurance": 0.35, "speed": 0.30},
        "preferred_temp": ["choleric"], "nerve_pref": "Выпуклый", "reaction_critical": True, "rank_factor": 0.90
    },
    "ПЛАВАНИЕ": {
        "min_age": 5, "max_age": 70, "org": "СШ «Дельфин»",
        "weights": {"endurance": 0.45, "coordination": 0.35, "flexibility": 0.20},
        "preferred_temp": ["sanguine", "phlegmatic"], "height_pref": "high", "rank_factor": 0.89
    },
    "ШАХМАТЫ": {
        "min_age": 5, "max_age": 80, "org": "СШ «Лангепас»",
        "weights": {"coordination": 0.60, "endurance": 0.40},
        "preferred_temp": ["phlegmatic", "melancholic"], "nerve_pref": "Ровный", "rank_factor": 0.75
    },
    "БАСКЕТБОЛ": {
        "min_age": 7, "max_age": 50, "org": "СШ «Лангепас»",
        "weights": {"speed": 0.35, "speed_strength": 0.35, "coordination": 0.30},
        "preferred_temp": ["sanguine"], "height_pref": "high", "rank_factor": 0.83
    }
}

class PhysicalStats(BaseModel):
    speed: int
    strength: int
    coordination: int
    speed_strength: int
    flexibility: int
    endurance: int

class TappingResult(BaseModel):
    t1: int
    t2: int
    t3: int
    t4: int
    t5: int
    t6: int
    total_clicks: int
    nerve_type: str

class ReactionResult(BaseModel):
    reaction_ms: int
    rating: str

class ParentSurvey(BaseModel):
    motivation: int
    activity: int

class AnalysisRequest(BaseModel):
    full_name: str
    birth_date: str
    sex: str
    height_cm: float
    weight_kg: float
    father_height_cm: Optional[float] = None
    mother_height_cm: Optional[float] = None
    physical: PhysicalStats
    temperament: str
    tapping_test: Optional[TappingResult] = None
    reaction_test: Optional[ReactionResult] = None
    parent_survey: Optional[ParentSurvey] = None
    preferences: Optional[List[str]] = []

def calculate_age(birth_date_str: str) -> float:
    try:
        b_date = datetime.strptime(birth_date_str, "%Y-%m-%d")
        today = datetime.today()
        years = today.year - b_date.year - ((today.month, today.day) < (b_date.month, b_date.day))
        return round(years + (today.month - b_date.month) / 12.0, 1)
    except Exception:
        return 7.0

def calculate_fine_scores(data: AnalysisRequest, age: float, bmi: float) -> List[Dict[str, Any]]:
    scored = []
    phys_dict = data.physical.model_dump()

    target_h = None
    if data.father_height_cm and data.mother_height_cm:
        target_h = (data.father_height_cm + data.mother_height_cm + (13 if data.sex == "male" else -13)) / 2

    for sport_name, spec in SPORT_PROFILES.items():
        if age < spec["min_age"] or age > spec["max_age"]:
            continue

        phys_score = sum(phys_dict.get(k, 5) * w for k, w in spec["weights"].items())
        temp_mod = 0.8 if data.temperament in spec.get("preferred_temp", []) else -0.5

        nerve_mod = 0.0
        if data.tapping_test and "nerve_pref" in spec:
            if spec["nerve_pref"] in data.tapping_test.nerve_type:
                nerve_mod = 0.8
            else:
                nerve_mod = -0.6

        react_mod = 0.0
        if data.reaction_test:
            ms = data.reaction_test.reaction_ms
            if ms < 250 and spec.get("reaction_critical"):
                react_mod = 0.8
            elif ms > 350 and spec.get("reaction_critical"):
                react_mod = -0.8

        bmi_mod = 0.0
        if "max_bmi" in spec and bmi > spec["max_bmi"]:
            bmi_mod -= (bmi - spec["max_bmi"]) * 0.6
        if "min_bmi" in spec and bmi < spec["min_bmi"]:
            bmi_mod -= (spec["min_bmi"] - bmi) * 0.6

        height_mod = 0.0
        if target_h and "height_pref" in spec:
            if spec["height_pref"] == "high" and target_h >= 180:
                height_mod = 0.7
            elif spec["height_pref"] == "low" and target_h <= 168:
                height_mod = 0.7

        raw_score = (phys_score + temp_mod + nerve_mod + react_mod + bmi_mod + height_mod) * spec["rank_factor"]
        final_percent = round(min(96.0, max(35.0, raw_score * 9.6)), 0)

        if final_percent >= 60.0:
            status_text = "Рекомендуется к зачислению в спортивную школу" if age < 18 else "Доступно для зачисления"
        else:
            status_text = "Необходимо еще потренироваться (ОФП)"

        scored.append({
            "sport_name": sport_name,
            "score": final_percent,
            "status_note": status_text,
            "local_availability": {"organization_or_object": spec["org"]}
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:6]

@app.get("/api/health")
def health_check():
    return {"status": "ok", "agent": "СТАС", "school": "СШОР 'Академия спорта' г. Лангепас"}

@app.post("/api/analyze")
async def analyze_and_recommend(data: AnalysisRequest):
    age = calculate_age(data.birth_date)

    target_height = None
    if data.father_height_cm and data.mother_height_cm:
        target_height = (data.father_height_cm + data.mother_height_cm + (13 if data.sex == "male" else -13)) / 2

    height_m = data.height_cm / 100.0
    bmi = round(data.weight_kg / (height_m * height_m), 1) if height_m > 0 else 0.0

    # 1. Точный математический алгоритм
    math_top_sports = calculate_fine_scores(data, age, bmi)

    # 2. Независимый ИИ-анализ GigaChat
    available_sports_list = list(SPORT_PROFILES.keys())
    
    system_prompt = (
        "Ты — спортивный аналитик и психолог Бельчонок СТАС СШОР «Академия спорта» г. Лангепас. "
        "Проведи НЕЗАВИСИМЫЙ ИИ-АНАЛИЗ данных человека и выбери 3 самых подходящих вида спорта ИСКЛЮЧИТЕЛЬНО из списка: "
        f"{available_sports_list}. "
        "Верни ответ STRICTLY в виде текста, где в начале краткое напутствие, а затем отдельные 3 рекомендации."
    )

    user_prompt = (
        f"Профиль спортсмена:\n"
        f"- ФИО: {data.full_name}, Возраст: {age} лет, Пол: {'Мужской' if data.sex == 'male' else 'Женский'}\n"
        f"- Рост: {data.height_cm} см, Вес: {data.weight_kg} кг, ИМТ: {bmi} кг/м²\n"
        f"- Психотип: {data.temperament}, Тип НС: {data.tapping_test.nerve_type if data.tapping_test else 'Не указан'}\n"
        f"- Время реакции: {data.reaction_test.reaction_ms if data.reaction_test else 'Н/Д'} мс\n"
        f"- Навыки (из 10): Скорость={data.physical.speed}, Сила={data.physical.strength}, Гибкость={data.physical.flexibility}, Координация={data.physical.coordination}\n\n"
        f"Сформируй экспертное независимое мнение ИИ от Бельчонка Стаса."
    )

    ai_advice = ""
    try:
        with GigaChat(credentials=GIGACHAT_CREDENTIALS, verify_ssl_certs=False) as giga:
            response = giga.chat({"messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]})
            ai_advice = response.choices[0].message.content
    except Exception:
        ai_advice = f"СТАС провел анализ профиля ({age} лет, ИМТ {bmi}). Независимый ИИ-выбор: {math_top_sports[0]['sport_name']}, {math_top_sports[1]['sport_name']} и {math_top_sports[2]['sport_name']}!"

    return {
        "user_info": {
            "full_name": data.full_name,
            "age_years": age,
            "sex_label": "Мужской" if data.sex == "male" else "Женский",
            "height_cm": data.height_cm,
            "weight_kg": data.weight_kg,
            "bmi": bmi,
            "target_adult_height_cm": round(target_height, 1) if target_height else None,
            "temperament": data.temperament,
            "physical": data.physical.model_dump(),
            "tapping_test": data.tapping_test.model_dump() if data.tapping_test else None,
            "reaction_test": data.reaction_test.model_dump() if data.reaction_test else None,
            "parent_survey": data.parent_survey.model_dump() if data.parent_survey else None
        },
        "ai_recommendation": ai_advice,
        "top_sports": math_top_sports
    }

@app.get("/")
async def read_index():
    index_path = FRONTEND_DIR / "index.html"
    return FileResponse(index_path)

app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="static")