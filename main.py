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
VK_SECRET_KEY = os.getenv("VK_SECRET_KEY", "f5b76090b2395159999dc866fd3e79b0")

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
        print("[Excel Warning]: Файл Excel не найден.")
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
        print(f"[Excel Read Error]: {e}")
        return [], []


class PhysicalSkills(BaseModel):
    speed: int = 5
    strength: int = 5
    coordination: int = 5
    speed_strength: int = 5
    flexibility: int = 5
    endurance: int = 5


class AthletePayload(BaseModel):
    full_name: str
    age: int
    sex: str
    height_cm: float
    weight_kg: float
    father_height_cm: float
    mother_height_cm: float
    physical: Optional[PhysicalSkills] = None
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
                    "Ты — Бельчонок СТАС, спортивный агент СШОР «Академия спорта» г. Лангепас. "
                    "Пиши экспертно, мотивирующе и лаконично. "
                    "ОГРАНИЧЕНИЕ: Текст не более 1200-1500 символов (2-3 емких абзаца)! "
                    "Учитывай возраст ребенка, сенситивные периоды развития, пол, "
                    "типологию нервной системы по Теппинг-тесту Ильина и время реакции."
                )
            },
            {"role": "user", "content": prompt_text}
        ],
        "temperature": 0.7,
        "max_tokens": 600
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


# ==========================================
# УНИКАЛЬНЫЙ ИНДИВИДУАЛЬНЫЙ РАСЧЕТ ДЛЯ КАЖДОГО ВИДА СПОРТА
# ==========================================
def calculate_sport_score(sport: dict, p: PhysicalSkills, payload: AthletePayload, predicted_height: float) -> Optional[dict]:
    name = sport["name"]
    name_low = name.lower()

    if payload.sex == "male" and any(fem in name_low for fem in FEMALE_ONLY_SPORTS):
        return None

    # Оценка реакции (4.0 - 10.0)
    if payload.reaction_ms <= 220:
        react_score = 10.0
    elif payload.reaction_ms <= 280:
        react_score = 8.0
    elif payload.reaction_ms <= 350:
        react_score = 6.0
    else:
        react_score = 4.0

    # 1. Вычисление уникального спортивного хэша (дает индивидуальный сдвиг весов для любого вида)
    name_hash = int(hashlib.md5(name_low.encode('utf-8')).hexdigest(), 16)
    unique_offset = ((name_hash % 11) - 5) * 0.015  # Диапазон от -7.5% до +7.5%

    # 2. Базовый профиль навыков
    if any(w in name_low for w in ["акробат", "батут", "гимнаст", "рок-н-ролл", "брейкинг", "аэробик", "танцевальный", "фигурное", "скалолазание"]):
        raw_skill = p.coordination * 0.38 + p.flexibility * 0.32 + p.speed * 0.15 + p.speed_strength * 0.15
        age_weight = 1.25 if payload.age <= 8 else (1.00 if payload.age <= 11 else 0.80)
        nerve_weight = 1.20 if "слабая" in payload.nerve_type.lower() or "стабильная" in payload.nerve_type.lower() else 0.90

    elif any(w in name_low for w in ["бокс", "дзюдо", "самбо", "борьб", "единоборств", "мма", "грэпплинг", "грепплинг", "тхэквондо", "муайтай", "каратэ", "рукопашн", "фехтование", "кикбоксинг"]):
        raw_skill = react_score * 0.30 + p.speed * 0.25 + p.strength * 0.25 + p.endurance * 0.20
        age_weight = 0.70 if payload.age <= 7 else (1.20 if payload.age <= 12 else 1.10)
        nerve_weight = 1.25 if "сильная" in payload.nerve_type.lower() else 0.85

    elif any(w in name_low for w in ["лук", "шахмат", "стрельб", "дартс", "бильярд", "го"]):
        raw_skill = react_score * 0.40 + p.coordination * 0.40 + p.endurance * 0.20
        age_weight = 0.65 if payload.age <= 8 else 1.25
        nerve_weight = 1.30 if "слабая" in payload.nerve_type.lower() or "стабильная" in payload.nerve_type.lower() else 0.75

    elif any(w in name_low for w in ["тяжёлая атлетика", "пауэрлифт", "гирев", "силовой", "бодибилдинг", "армрестлинг"]):
        # Узкая индивидуализация внутри силовых
        if "армрестлинг" in name_low:
            raw_skill = p.strength * 0.50 + react_score * 0.30 + p.coordination * 0.20
        elif "бодибилдинг" in name_low:
            raw_skill = p.strength * 0.40 + p.endurance * 0.30 + p.flexibility * 0.30
        elif "гиревой" in name_low:
            raw_skill = p.endurance * 0.50 + p.strength * 0.35 + p.speed_strength * 0.15
        else:
            raw_skill = p.strength * 0.50 + p.speed_strength * 0.35 + p.coordination * 0.15

        age_weight = 0.40 if payload.age <= 8 else (0.75 if payload.age <= 9 else 1.30)
        nerve_weight = 1.20 if "сильная" in payload.nerve_type.lower() else 0.85

    elif any(w in name_low for w in ["плаван", "лыжн", "биатлон", "бег", "велосипед", "конькобеж", "гребля", "триатлон", "легкая атлетика"]):
        raw_skill = p.endurance * 0.45 + p.speed * 0.30 + p.coordination * 0.25
        age_weight = 1.10 if payload.age >= 8 else 0.90
        nerve_weight = 1.05

    elif any(w in name_low for w in ["баскетбол", "волейбол", "водное поло", "бадминтон", "футбол", "хоккей", "теннис", "гандбол", "регби"]):
        raw_skill = p.speed * 0.30 + p.coordination * 0.30 + p.speed_strength * 0.25 + react_score * 0.15
        if any(h in name_low for h in ["баскетбол", "волейбол"]):
            height_bonus = 1.25 if ((payload.sex == "male" and predicted_height >= 180) or (payload.sex == "female" and predicted_height >= 172)) else 0.90
            raw_skill *= height_bonus
        age_weight = 0.85 if payload.age <= 7 else 1.20
        nerve_weight = 1.15 if "холерик" in payload.temperament.lower() or "сангвиник" in payload.temperament.lower() or "сильная" in payload.nerve_type.lower() else 0.95

    else:
        raw_skill = p.coordination * 0.30 + p.speed * 0.25 + p.endurance * 0.25 + p.strength * 0.20
        age_weight = 1.00
        nerve_weight = 1.00

    # 3. Применение индивидуального профильного коэффициента
    model_score = (raw_skill * 8.2) * age_weight * nerve_weight * (1.0 + unique_offset)
    final_score = min(98, max(55, int(model_score)))

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

    user_prompt = (
        f"Проанализируй комплексный научно-методический профиль ребенка (с учетом исследований ХМАО-Югры 2024 г.):\n"
        f"- Имя: {payload.full_name}, Возраст: {payload.age} лет, Пол: {'Мальчик' if payload.sex == 'male' else 'Девочка'}\n"
        f"- Антропометрия: Рост {payload.height_cm} см, Вес {payload.weight_kg} кг, ИМТ {bmi}, Прогноз роста {predicted_height} см\n"
        f"- Сенсомоторная реакция: {payload.reaction_ms} мс\n"
        f"- Типология НС по Теппинг-тесту Ильина: {payload.nerve_type}\n"
        f"- Темперамент: {temp_str}\n"
        f"Сформируй ЕМКОЕ экспертное заключение (до 1500 символов, 2-3 абзаца). Объясни, как физиологические параметры, Теппинг-тест и пол ребенка определили его готовность к зачислению в секции Лангепаса."
    )

    ai_summary = ask_gigachat(user_prompt, GIGACHAT_CREDENTIALS)

    if not ai_summary:
        sex_str = "мальчика" if payload.sex == "male" else "девочки"
        ai_summary = (
            f"Привет! Я Бельчонок СТАС из СШОР «Академия спорта» г. Лангепас.\n\n"
            f"Наш расчёт для {sex_str} {payload.full_name} ({payload.age} лет) завершён. "
            f"Индекс массы тела составляет {bmi} кг/м², а генетический прогноз роста — около {predicted_height} см.\n\n"
            f"Тип нервной системы по Теппинг-тесту Ильина ('{payload.nerve_type}') и показатели реакции ({payload.reaction_ms} мс) "
            f"подтверждают отличную предрасположенность к физическим нагрузкам в рекомендуемых секциях города!"
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