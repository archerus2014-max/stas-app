import os
import hashlib
import requests
import urllib3
import pandas as pd
from typing import Optional, List, Dict, Tuple
from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = FastAPI(title="STAS Sports Agent Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_vk_iframe_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "frame-ancestors 'self' https://*.vk.com https://*.vk.ru https://vk.com https://vk.ru https://*.vk-apps.com;"
    )
    if "X-Frame-Options" in response.headers:
        del response.headers["X-Frame-Options"]
    return response

GIGACHAT_CREDENTIALS = os.getenv("GIGACHAT_CREDENTIALS", "")
VK_CONFIRMATION_CODE = os.getenv("VK_CONFIRMATION_CODE", "a23e9568")

FEMALE_ONLY_SPORTS = [
    "художественная гимнастика",
    "эстетическая гимнастика",
    "синхронное плавание"
]

EXCLUDED_SPORTS = [
    "авиамодельный", "автомобильный", "авиационные гонки", "мотоциклетный",
    "радиоспорт", "судомодельный", "ракетомодельный", "компьютерный",
    "пожарно-спасательный", "морское многоборье", "боулинг", "гольф", "шашки"
]

def clean_sport_name(name: str) -> str:
    name = name.strip()
    if name.endswith("(") or "мма" in name.lower():
        if "мма" in name.lower():
            return "Смешанное боевое единоборство (ММА)"
    if name.lower() in ["грепплинг", "грэпплинг"]:
        return "Грэпплинг"
    if len(name) > 1:
        name = name[0].upper() + name[1:]
    return name

def load_sports_from_excel() -> Tuple[List[Dict], List[Dict]]:
    excel_files = ["Langsport_НП1_возраст.xls", "Langsport_НП1_возраст_2.xls", "C:\\STAS\\Langsport_НП1_возраст.xls"]
    target_file = None
    for f in excel_files:
        if os.path.exists(f):
            target_file = f
            break

    if not target_file:
        return [], []

    try:
        df = pd.read_excel(target_file)
        langepas_sports = []
        other_sports = []
        
        current_org = ""
        is_other_section = False
        lang_names = set()

        for idx, row in df.iterrows():
            sport_raw = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
            np1_age = row.iloc[2] if len(row) > 2 else None
            sog_age = row.iloc[3] if len(row) > 3 else None

            if not sport_raw or sport_raw == "nan":
                continue

            if "Академия спорта" in sport_raw:
                current_org = "СШОР «Академия спорта»"
                is_other_section = False
                continue
            elif "СШ \"Лангепас\"" in sport_raw or 'СШ "Лангепас"' in sport_raw:
                current_org = "СШ «Лангепас»"
                is_other_section = False
                continue
            elif "СШ \"Дельфин\"" in sport_raw or 'СШ "Дельфин"' in sport_raw:
                current_org = "СШ «Дельфин»"
                is_other_section = False
                continue
            elif "Прочие виды спорта" in sport_raw:
                current_org = ""
                is_other_section = True
                continue

            np1_val = float(np1_age) if pd.notna(np1_age) else 7.0
            sog_val = float(sog_age) if pd.notna(sog_age) else None
            
            clean_name = clean_sport_name(sport_raw)

            if any(ex in clean_name.lower() for ex in EXCLUDED_SPORTS):
                continue

            item = {
                "name": clean_name,
                "org": current_org if not is_other_section else "",
                "np1_age": int(np1_val),
                "sog_age": int(sog_val) if sog_val else None
            }

            if is_other_section:
                if clean_name.lower() not in lang_names:
                    other_sports.append(item)
            else:
                langepas_sports.append(item)
                lang_names.add(clean_name.lower())

        return langepas_sports, other_sports
    except Exception as e:
        return [], []


class PhysicalSkills(BaseModel):
    speed: int = 5
    strength: int = 5
    coordination: int = 5
    speed_strength: int = 5
    flexibility: int = 5
    endurance: int = 5


class NormativeData(BaseModel):
    pullups: Optional[float] = 1.0
    flexibility_cm: Optional[float] = 8.0
    situps: Optional[float] = 29.0
    long_jump_cm: Optional[float] = 134.0
    shuttle_run_sec: Optional[float] = 9.0
    run_30m_sec: Optional[float] = 6.0
    pushups: Optional[float] = 10.0
    target_throw: Optional[float] = 3.0


class AthletePayload(BaseModel):
    full_name: str
    age: int
    sex: str
    height_cm: float
    weight_kg: float
    father_height_cm: float
    mother_height_cm: float
    physical: Optional[PhysicalSkills] = None
    normatives: Optional[NormativeData] = None
    temperament: str
    reaction_ms: int
    nerve_type: str


def get_gigachat_token(credentials: str) -> Optional[str]:
    if not credentials:
        return None
    url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': '6f0b016e-a740-4e1e-b83d-3382717077a8',
        'Authorization': f'Basic {credentials}'
    }
    payload = {'scope': 'GIGACHAT_API_PERS'}
    try:
        response = requests.post(url, headers=headers, data=payload, verify=False, timeout=5)
        if response.status_code == 200:
            return response.json().get('access_token')
    except Exception as e:
        print(f"[GigaChat Token Error]: {e}")
    return None


def ask_gigachat(prompt_text: str, credentials: str) -> Optional[str]:
    token = get_gigachat_token(credentials)
    if not token:
        return None

    url = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    payload = {
        "model": "GigaChat",
        "messages": [
            {
                "role": "system",
                "content": (
                    "Ты — Бельчонок СТАС, дружелюбный спортивный агент СШОР «Академия спорта» г. Лангепас. "
                    "Обращайся strictly НАПРЯМУЮ К ТЕСТИРУЕМОМУ по имени: '[Имя], ты большой(ая) молодец! ...' "
                    "Объясняй спортивные успехи научно (сенситивные периоды развития В.П. Филина и В.К. Бальсевича). "
                    "Упоминай ТОЛЬКО ТЕ ВИДЫ СПОРТА, которые прямо рекомендуются в дашборде!"
                )
            },
            {"role": "user", "content": prompt_text}
        ],
        "temperature": 0.6,
        "max_tokens": 650
    }
    try:
        response = requests.post(url, headers=headers, json=payload, verify=False, timeout=12)
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content']
            if len(content) > 1500:
                content = content[:1490] + "..."
            return content
    except Exception as e:
        print(f"[GigaChat Query Error]: {e}")
    return None


def calculate_sport_score(sport: dict, p: PhysicalSkills, payload: AthletePayload, predicted_height: float) -> Optional[dict]:
    name = sport["name"]
    name_low = name.lower()

    if payload.sex == "male" and any(fem in name_low for fem in FEMALE_ONLY_SPORTS):
        return None

    if payload.reaction_ms <= 250:
        react_score = 10.0
    elif payload.reaction_ms <= 350:
        react_score = 8.0
    elif payload.reaction_ms <= 500:
        react_score = 6.0
    elif payload.reaction_ms <= 700:
        react_score = 4.0
    else:
        react_score = 2.0

    if any(w in name_low for w in ["акробат", "батут", "гимнаст", "рок-н-ролл", "брейкинг"]):
        raw_skill = p.coordination * 0.35 + p.flexibility * 0.35 + p.speed_strength * 0.15 + p.speed * 0.15
        nerve_weight = 1.15 if "слабая" in payload.nerve_type.lower() or "стабильная" in payload.nerve_type.lower() else 0.90

    elif any(w in name_low for w in ["бокс", "дзюдо", "самбо", "борьб", "единоборств", "мма", "грэпплинг", "грепплинг", "тхэквондо", "кикбоксинг"]):
        raw_skill = react_score * 0.25 + p.speed * 0.25 + p.strength * 0.20 + p.coordination * 0.15 + p.endurance * 0.15
        nerve_weight = 1.20 if "сильная" in payload.nerve_type.lower() else 0.85

    elif any(w in name_low for w in ["лук", "шахмат", "стрельб", "дартс", "го"]):
        raw_skill = react_score * 0.35 + p.coordination * 0.45 + p.endurance * 0.20
        nerve_weight = 1.25 if "флегматик" in payload.temperament.lower() or "меланхолик" in payload.temperament.lower() or "стабильная" in payload.nerve_type.lower() else 0.80

    elif any(w in name_low for w in ["тяжёлая атлетика", "пауэрлифт", "гирев", "силовой"]):
        raw_skill = p.strength * 0.50 + p.speed_strength * 0.30 + p.endurance * 0.20
        nerve_weight = 1.15 if "сильная" in payload.nerve_type.lower() else 0.85

    elif any(w in name_low for w in ["лыжн", "биатлон", "бег", "плавание", "велосипед", "конькобеж", "легкая атлетика"]):
        raw_skill = p.endurance * 0.45 + p.speed * 0.30 + p.speed_strength * 0.15 + p.coordination * 0.10
        nerve_weight = 1.05

    elif any(w in name_low for w in ["баскетбол", "волейбол", "футбол", "хоккей", "теннис", "гандбол"]):
        raw_skill = p.speed * 0.25 + p.coordination * 0.30 + p.speed_strength * 0.25 + react_score * 0.20
        if any(h in name_low for h in ["баскетбол", "волейбол"]):
            height_bonus = 1.20 if ((payload.sex == "male" and predicted_height >= 180) or (payload.sex == "female" and predicted_height >= 172)) else 0.85
            raw_skill *= height_bonus
        nerve_weight = 1.15 if "холерик" in payload.temperament.lower() or "сангвиник" in payload.temperament.lower() else 0.95

    else:
        raw_skill = p.coordination * 0.25 + p.speed * 0.25 + p.endurance * 0.25 + p.strength * 0.25
        nerve_weight = 1.00

    name_hash = int(hashlib.md5(name_low.encode('utf-8')).hexdigest(), 16)
    unique_offset = ((name_hash % 13) - 6) * 0.8

    model_score = (raw_skill * 8.5) * nerve_weight + unique_offset
    final_score = min(98, max(52, int(model_score)))

    sog_age = sport.get("sog_age")
    if payload.age >= sport["np1_age"]:
        status_note = f"Рекомендуется зачисление на этап НП1 (с {sport['np1_age']} лет)"
    elif sog_age and payload.age >= sog_age:
        status_note = f"Рекомендуется зачисление в группу СОГ (ОФП) с {sog_age} лет"
    else:
        status_note = f"Ранний возраст: зачисление на НП1 с {sport['np1_age']} лет"

    return {
        "sport_name": name,
        "score": final_score,
        "org": sport["org"],
        "status_note": status_note
    }


@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "ok", "service": "STAS Engine Online"})


@app.post("/vk/callback")
async def vk_callback_handler(request: Request):
    try:
        data = await request.json()
    except Exception:
        return PlainTextResponse("ok")

    if data.get("type") == "confirmation":
        return PlainTextResponse(VK_CONFIRMATION_CODE)

    return PlainTextResponse("ok")


@app.post("/api/analyze")
async def analyze_athlete(payload: AthletePayload):
    gender_coef = 6.5 if payload.sex == "male" else -6.5
    predicted_height = round(((payload.father_height_cm + payload.mother_height_cm) / 2) + gender_coef, 1)

    height_m = payload.height_cm / 100.0
    bmi = round(payload.weight_kg / (height_m * height_m), 1)

    temp_ru_map = {
        "sanguine": "Сангвиник", "choleric": "Холерик",
        "phlegmatic": "Флегматик", "melancholic": "Меланхолик"
    }
    temp_str = temp_ru_map.get(payload.temperament, payload.temperament)
    p = payload.physical or PhysicalSkills()

    langepas_sports, other_registry_sports = load_sports_from_excel()

    langepas_scores = []
    for s in langepas_sports:
        res = calculate_sport_score(s, p, payload, predicted_height)
        if res:
            langepas_scores.append(res)

    langepas_scores.sort(key=lambda x: x["score"], reverse=True)
    top_sports = langepas_scores[:4]

    other_scores = []
    for s in other_registry_sports:
        res = calculate_sport_score(s, p, payload, predicted_height)
        if res:
            other_scores.append(res)

    other_scores.sort(key=lambda x: x["score"], reverse=True)
    other_top_sports = other_scores[:3]

    top_names_str = ", ".join([f"«{item['sport_name']}»" for item in top_sports])

    user_prompt = (
        f"Напиши личное обращение к тестируемому по имени {payload.full_name}.\n"
        f"Пол: {'Девочка' if payload.sex == 'female' else 'Мальчик'}, Возраст: {payload.age} лет.\n"
        f"Антропометрия: Рост {payload.height_cm} см, Вес {payload.weight_kg} кг, ИМТ {bmi}, Прогноз роста {predicted_height} см.\n"
        f"Сенсомоторная реакция: {payload.reaction_ms} мс. Нервная система: {payload.nerve_type}. Темперамент: {temp_str}.\n"
        f"Рекомендованные секции из дашборда: {top_names_str}.\n\n"
        f"Требование к тексту: Похвали ребенка по имени ({payload.full_name}), объясни его научно-спортивный потенциал "
        f"и обоснуй, почему ему подходят ИМЕННО ЭТИ секции: {top_names_str}."
    )

    ai_summary = ask_gigachat(user_prompt, GIGACHAT_CREDENTIALS)

    if not ai_summary:
        ai_summary = (
            f"{payload.full_name}, ты большой молодец! "
            f"Твои физические показатели (рост {payload.height_cm} см, ИМТ {bmi}) и тип нервной системы ({payload.nerve_type}) "
            f"показывают замечательную предрасположенность к занятиям спортом. "
            f"На основе твоих результатов наиболее подходящими секциями являются: {top_names_str}!"
        )

    return JSONResponse(content={
        "status": "success",
        "predicted_adult_height": predicted_height,
        "bmi": bmi,
        "ai_text": ai_summary,
        "top_sports": top_sports,
        "other_top_sports": other_top_sports
    })


@app.get("/")
async def serve_index():
    return FileResponse("index.html")

app.mount("/", StaticFiles(directory="."), name="static")