import os
import uuid
import requests
import urllib3
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = FastAPI(title="Спортивный агент СТАС — Сервер с защищенной валидацией")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "ALLOWALL"
    response.headers["Content-Security-Policy"] = "frame-ancestors *;"
    response.headers["Bypass-Tunnel-Reminder"] = "true"
    return response

GIGACHAT_AUTH_KEY = "MDFhMDIyNmQtMDVlMC03NGIyLThhNzMtYjhiZmU2NGJhNmE2OmU1ZTViNDliLTZiMTctNGRhMS05MWQzLWU2ZjYyMWUyZTM4Zg=="

def get_gigachat_token():
    try:
        url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
        payload = 'scope=GIGACHAT_API_PERS'
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'RqUID': str(uuid.uuid4()),
            'Authorization': f'Basic {GIGACHAT_AUTH_KEY}'
        }
        res = requests.post(url, headers=headers, data=payload, verify=False, timeout=8)
        return res.json().get("access_token")
    except Exception as e:
        print("[GigaChat Auth Error]:", e)
        return None

SPORT_PROFILES = {
    "СПОРТИВНАЯ АКРОБАТИКА": {
        "min_age": 7, "max_age": 16, "org": "СШОР «Академия спорта»", "category": "basic",
        "w_phys": 0.40, "w_psycho": 0.30, "w_bmi": 0.15, "w_height": 0.15,
        "preferred_temp": ["sanguine"], "max_bmi": 20.0, "height_pref": "low", "micro_offset": 3.2
    },
    "ПЛАВАНИЕ": {
        "min_age": 7, "max_age": 70, "org": "СШ «Дельфин»", "category": "basic",
        "w_phys": 0.35, "w_psycho": 0.25, "w_bmi": 0.20, "w_height": 0.20,
        "preferred_temp": ["sanguine", "phlegmatic"], "height_pref": "high", "micro_offset": 2.8
    },
    "ПРЫЖКИ НА БАТУТЕ": {
        "min_age": 7, "max_age": 18, "org": "СШОР «Академия спорта»", "category": "basic",
        "w_phys": 0.40, "w_psycho": 0.30, "w_bmi": 0.15, "w_height": 0.15,
        "preferred_temp": ["sanguine"], "max_bmi": 21.0, "height_pref": "medium", "micro_offset": 1.5
    },
    "БОКС": {
        "min_age": 9, "max_age": 45, "org": "СШОР «Академия спорта»", "category": "combat",
        "w_phys": 0.45, "w_psycho": 0.35, "w_bmi": 0.10, "w_height": 0.10,
        "preferred_temp": ["choleric", "sanguine"], "nerve_pref": "Сильная", "micro_offset": 0.3
    },
    "ДЗЮДО": {
        "min_age": 8, "max_age": 50, "org": "СШОР «Академия спорта»", "category": "combat",
        "w_phys": 0.40, "w_psycho": 0.30, "w_bmi": 0.15, "w_height": 0.15,
        "preferred_temp": ["phlegmatic", "sanguine"], "nerve_pref": "Сильная", "micro_offset": -0.5
    },
    "СТРЕЛЬБА ИЗ ЛУКА": {
        "min_age": 10, "max_age": 65, "org": "СШОР «Академия спорта»", "category": "precision",
        "w_phys": 0.20, "w_psycho": 0.50, "w_bmi": 0.15, "w_height": 0.15,
        "preferred_temp": ["phlegmatic", "melancholic"], "nerve_pref": "Ровная", "micro_offset": 0.8
    }
}

class PhysicalStats(BaseModel):
    speed: Optional[int] = 5
    strength: Optional[int] = 5
    coordination: Optional[int] = 5
    speed_strength: Optional[int] = 5
    flexibility: Optional[int] = 5
    endurance: Optional[int] = 5

class AthleteRequest(BaseModel):
    full_name: Optional[str] = "Юный спортсмен"
    age: Optional[int] = 5
    sex: Optional[str] = "female"
    height_cm: Optional[float] = 116.0
    weight_kg: Optional[float] = 24.0
    father_height_cm: Optional[float] = 178.0
    mother_height_cm: Optional[float] = 165.0
    physical: Optional[PhysicalStats] = PhysicalStats()
    temperament: Optional[str] = "sanguine"
    reaction_ms: Optional[int] = 300
    nerve_type: Optional[str] = "Стабильная НС"

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Сервер СТАС работает"}

@app.post("/api/analyze")
def analyze(data: AthleteRequest):
    # Гарантированное преобразование типов для предотвращения ошибок расчёта
    age = data.age or 5
    height_cm = data.height_cm or 116.0
    weight_kg = data.weight_kg or 24.0
    father_h = data.father_height_cm or 178.0
    mother_h = data.mother_height_cm or 165.0
    sex = data.sex or "female"
    full_name = data.full_name or "Спортсмен"
    temperament = data.temperament or "sanguine"
    reaction_ms = data.reaction_ms or 300
    nerve_type = data.nerve_type or "Стабильная НС"
    phys = data.physical or PhysicalStats()

    height_m = height_cm / 100.0
    bmi = round(weight_kg / (height_m * height_m), 1) if height_m > 0 else 18.0
    modifier = 13.0 if sex == "male" else -13.0
    predicted_adult_height = round((father_h + mother_h + modifier) / 2.0, 1)

    scored_sports = []
    for sport_name, spec in SPORT_PROFILES.items():
        p_speed = phys.speed or 5
        p_strength = phys.strength or 5
        p_coord = phys.coordination or 5
        p_speed_strength = phys.speed_strength or 5
        p_flex = phys.flexibility or 5
        p_endurance = phys.endurance or 5

        phys_avg = (p_speed + p_strength + p_coord + p_speed_strength + p_flex + p_endurance) / 6.0
        k_phys = min(100.0, phys_avg * 10.0)

        k_psycho = 70.0
        if temperament in spec["preferred_temp"]:
            k_psycho += 15.0
        if "nerve_pref" in spec and spec["nerve_pref"] in nerve_type:
            k_psycho += 15.0

        k_bmi = 90.0 if bmi <= spec.get("max_bmi", 25.0) else 60.0
        k_height = 95.0 if (spec.get("height_pref") == "high" and predicted_adult_height >= 175.0) else 75.0

        raw_score = (
            (spec["w_phys"] * k_phys) + 
            (spec["w_psycho"] * k_psycho) + 
            (spec["w_bmi"] * k_bmi) + 
            (spec["w_height"] * k_height) + 
            spec["micro_offset"]
        )

        if age < 7:
            if spec["category"] == "combat":
                raw_score -= 25.0
            elif spec["category"] == "precision":
                raw_score -= 10.0

        final_score = round(min(98.0, max(35.0, raw_score)), 1)

        if age < spec["min_age"]:
            status_note = f"Базовое ОФП (Официальное зачисление в секцию с {spec['min_age']} лет по ФССП)"
        elif age >= 18:
            status_note = "Доступно для любительских и взрослых групп"
        else:
            status_note = "Рекомендуется к зачислению в спортивную школу"

        scored_sports.append({
            "sport_name": sport_name,
            "score": final_score,
            "status_note": status_note,
            "org": spec["org"]
        })

    scored_sports.sort(key=lambda x: x["score"], reverse=True)
    top3 = scored_sports[:3]

    token = get_gigachat_token()
    sports_str = ", ".join([s["sport_name"] for s in top3])
    temp_ru = {"sanguine": "Сангвиник", "choleric": "Холерик", "phlegmatic": "Флегматик", "melancholic": "Меланхолик"}.get(temperament, temperament)

    if token:
        try:
            headers = {'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': f'Bearer {token}'}
            prompt = (
                f"Ты спортивный агент Бельчонок СТАС из СШОР 'Академия спорта' г. Лангепас. "
                f"Составь эмоциональное заключение для юного спортсмена по имени {full_name} ({age} лет). "
                f"Показатели: ИМТ={bmi}, Реакция={reaction_ms} мс, Темперамент={temp_ru}, Нервная система={nerve_type}. "
                f"Прогноз роста={predicted_adult_height} см. "
                f"Рекомендуемые секции: {sports_str}. "
                f"ПРАВИЛО: НЕ ИСПОЛЬЗУЙ символы решеток # и звёздочек *. Разбивай текст на короткие читаемые абзацы через пустые строки!"
            )
            body = {"model": "GigaChat", "messages": [{"role": "user", "content": prompt}], "temperature": 0.7}
            res = requests.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", headers=headers, json=body, verify=False, timeout=12)
            ai_text = res.json()['choices'][0]['message']['content'].replace("#", "").replace("*", "")
            return {"status": "success", "ai_text": ai_text, "top_sports": top3, "predicted_adult_height": predicted_adult_height}
        except Exception as e:
            print("[GigaChat Error]:", e)

    fallback_text = (
        f"Уважаемые родители спортсмена {full_name}!\n\n"
        f"Бельчонок СТАС провел комплексный математический анализ данных ({age} лет, ИМТ {bmi}, реакция {reaction_ms} мс).\n\n"
        f"Тип нервной системы ({nerve_type}) и темперамент ({temp_ru}) показывают отличный потенциал для гармоничного развития!\n\n"
        f"Лучшие направления в г. Лангепас: {sports_str}. Ждем вас на тренировках!"
    )
    return {"status": "fallback", "ai_text": fallback_text, "top_sports": top3, "predicted_adult_height": predicted_adult_height}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/")
def read_root():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/{file_name:path}")
def read_static(file_name: str):
    file_path = os.path.join(BASE_DIR, file_name)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)