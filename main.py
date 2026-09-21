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

app = FastAPI(title="STAS Sports Agent Engine v2")

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
        "frame-ancestors 'self' https://*.vk.com https://*.vk.ru https://vk.com https://vk.ru "
        "https://*.vk-apps.com https://*.vk-apps.ru https://*.vk.me;"
    )
    if "X-Frame-Options" in response.headers:
        del response.headers["X-Frame-Options"]
    return response

# ====================== КОНФИГ ======================
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
    "пожарно-спасательный", "морское многоборье", "боулинг", "гольф", "шашки",
    "зимнее плавание"
]

# ====================== МОДЕЛИ ======================
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
    father_height_cm: float = 175.0
    mother_height_cm: float = 165.0
    physical: Optional[PhysicalSkills] = None
    normatives: Optional[NormativeData] = None
    temperament: str = "sanguine"
    reaction_ms: int = 300
    nerve_type: str = "Средняя сила НС"

class AdultPayload(BaseModel):
    full_name: str
    age: int
    sex: str
    height_cm: float
    weight_kg: float
    complaints: Dict[str, bool]
    activity_level: str = "low"
    goals: List[str] = []

# ====================== GIGACHAT ======================
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
        response = requests.post(url, headers=headers, data=payload, verify=False, timeout=8)
        if response.status_code == 200:
            return response.json().get('access_token')
    except Exception:
        pass
    return None

def ask_gigachat(prompt_text: str, system_prompt: str, credentials: str) -> Optional[str]:
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
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt_text}
        ],
        "temperature": 0.55,
        "max_tokens": 900
    }
    try:
        response = requests.post(url, headers=headers, json=payload, verify=False, timeout=18)
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content']
            if len(content) > 2200:
                content = content[:2180] + "..."
            return content
    except Exception:
        pass
    return None

# ====================== ЗАГРУЗКА СЕКЦИЙ ======================
def clean_sport_name(name: str) -> str:
    name = name.strip()
    if "мма" in name.lower():
        return "Смешанное боевое единоборство (ММА)"
    if name.lower() in ["грепплинг", "грэпплинг"]:
        return "Грэпплинг"
    if len(name) > 1:
        name = name[0].upper() + name[1:]
    return name

def load_sports_from_excel() -> Tuple[List[Dict], List[Dict]]:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    excel_candidates = [
        os.path.join(base_dir, "Langsport_НП1_возраст.xls"),
        os.path.join(base_dir, "Langsport_НП1_возраст_2.xls"),
        "Langsport_НП1_возраст.xls",
        "C:\\STAS\\Langsport_НП1_возраст.xls"
    ]
    target_file = None
    for f in excel_candidates:
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
    except Exception:
        return [], []

# ====================== РАСЧЁТ ДЛЯ ДЕТЕЙ ======================
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
        nerve_weight = 1.25 if "флегматик" in payload.temperament.lower() or "меланхолик" in payload.temperament.lower() else 0.80
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

def extract_short_name(full_name: str) -> str:
    parts = full_name.strip().split()
    if not parts:
        return "Юный спортсмен"
    return parts[0]

# ====================== ЭНДПОИНТЫ ======================
@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "ok", "service": "STAS Engine v2 Online"})

@app.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt():
    return "User-agent: *\nDisallow:"

@app.post("/vk/callback")
async def vk_callback_handler(request: Request):
    try:
        data = await request.json()
        if data.get("type") == "confirmation":
            return PlainTextResponse(VK_CONFIRMATION_CODE)
    except Exception:
        pass
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

    short_name = extract_short_name(payload.full_name)
    top_names_str = ", ".join([f"«{item['sport_name']}»" for item in top_sports])

    system_prompt = (
        "Ты — Бельчонок СТАС, дружелюбный спортивный агент СШОР «Академия спорта» г. Лангепас. "
        "Начинай текст СТРОГО с личного обращения только по ИМЕНИ. "
        "НИКОГДА не пиши фамилию. Пиши структурированно и полностью завершай мысли. "
        "Упоминай ТОЛЬКО те виды спорта, которые переданы в списке рекомендованных секций."
    )

    user_prompt = (
        f"Напиши личное обращение к ребенку только по имени {short_name}.\n"
        f"Данные: Возраст {payload.age} лет, Рост {payload.height_cm} см, Вес {payload.weight_kg} кг, ИМТ {bmi}.\n"
        f"Сенсомоторная реакция: {payload.reaction_ms} мс, Нервная система: {payload.nerve_type}, Темперамент: {temp_str}.\n\n"
        f"ВАЖНО: Начни ответ СТРОГО по имени: '{short_name}, ты большой молодец!' (или 'большая умница').\n"
        f"Опиши потенциал и обоснуй выбор ТОЛЬКО следующих секций: {top_names_str}."
    )

    ai_summary = ask_gigachat(user_prompt, system_prompt, GIGACHAT_CREDENTIALS)

    if not ai_summary:
        ai_summary = (
            f"{short_name}, ты большой молодец! "
            f"Твои показатели и тип нервной системы показывают хорошую предрасположенность к нагрузкам. "
            f"На основе расчёта тебе хорошо подходят: {top_names_str}."
        )

    return JSONResponse(content={
        "status": "success",
        "predicted_adult_height": predicted_height,
        "bmi": bmi,
        "ai_text": ai_summary,
        "top_sports": top_sports,
        "other_top_sports": other_top_sports
    })

@app.post("/api/analyze-adult")
async def analyze_adult(payload: AdultPayload):
    """Взрослый режим — индивидуальный подбор с учётом жалоб и целей"""
    height_m = payload.height_cm / 100.0
    bmi = round(payload.weight_kg / (height_m * height_m), 1)

    complaints_list = []
    if payload.complaints.get("back"): complaints_list.append("боли в спине и пояснице")
    if payload.complaints.get("joints"): complaints_list.append("проблемы с суставами")
    if payload.complaints.get("pressure"): complaints_list.append("скачки артериального давления")
    if payload.complaints.get("headache"): complaints_list.append("частые головные боли")
    if payload.complaints.get("heart") or payload.complaints.get("dyspnea"):
        complaints_list.append("одышка или дискомфорт в сердце")
    if payload.complaints.get("overweight"): complaints_list.append("избыточный вес")

    goals_map = {
        "weight": "снижение веса и коррекция фигуры",
        "back": "укрепление мышечного корсета спины",
        "endurance": "повышение общей выносливости",
        "stress": "снятие стресса и улучшение сна",
        "general": "поддержание общего тонуса и здоровья"
    }
    goals_str = ", ".join([goals_map.get(g, g) for g in payload.goals]) or "общее оздоровление"

    activity_map = {
        "low": "низкий (малоподвижный образ жизни)",
        "medium": "умеренный (пешие прогулки, редкая активность)",
        "high": "высокий (регулярные тренировки)"
    }
    activity_str = activity_map.get(payload.activity_level, "низкий")

    short_name = extract_short_name(payload.full_name)
    sex_word = "уважаемая" if payload.sex == "female" else "уважаемый"

    system_prompt = (
        "Ты — Бельчонок СТАС, дружелюбный и заботливый спортивный агент СШОР «Академия спорта». "
        "Ты помогаешь взрослым подбирать безопасные нагрузки для здоровья. "
        "Начинай строго с обращения по имени. Пиши аргументировано, опираясь на указанные жалобы и цели. "
        "Обязательно добавляй мягкое предостережение о консультации с врачом при наличии жалоб."
    )

    user_prompt = (
        f"Обратись к пользователю по имени {short_name} ({sex_word}).\n"
        f"Возраст: {payload.age} лет, рост: {payload.height_cm} см, вес: {payload.weight_kg} кг, ИМТ: {bmi}.\n"
        f"Уровень активности: {activity_str}.\n"
        f"Жалобы и особенности здоровья: {', '.join(complaints_list) if complaints_list else 'нет выраженных жалоб'}.\n"
        f"Цели занятий: {goals_str}.\n\n"
        f"Напиши персональное развёрнутое заключение (10–14 предложений): "
        f"проанализируй текущий ИМТ и жалобы, похвали за стремление заниматься физкультурой, "
        f"предложи оптимальные и безопасные направления (ходьба, плавание, ЛФК, скандинавская ходьба и т.д.) "
        f"с учётом индивидуальных ограничений."
    )

    ai_summary = ask_gigachat(user_prompt, system_prompt, GIGACHAT_CREDENTIALS)

    if not ai_summary:
        ai_summary = (
            f"{short_name}, спасибо, что уделяешь внимание своему здоровью! "
            f"С учётом твоих целей ({goals_str}) и текущего уровня активности я подобрал индивидуальный комплекс нагрузок, "
            f"который поможет укрепить организм без перегрузок. "
            f"{'При наличии жалоб обязательно проконсультируйся с врачом перед началом занятий.' if complaints_list else 'Начинай постепенно и следи за самочувствием.'}"
        )

    # Динамическое формирование рекомендаций на основе жалоб и целей
    recommendations = []
    recommendations.append({
        "title": "Дозированная ходьба",
        "desc": "30–45 минут ежедневно в умеренном темпе. Улучшает обмен веществ и работу сердца.",
        "icon": "🚶",
        "color": "#10b981"
    })

    if payload.complaints.get("back") or "back" in payload.goals:
        recommendations.append({
            "title": "Лечебная физкультура (ЛФК) и кора",
            "desc": "Специальные комплексы на укрепление глубоких мышц спины без ударной и осевой нагрузки.",
            "icon": "🧘",
            "color": "#f59e0b"
        })

    if payload.complaints.get("joints") or payload.complaints.get("overweight") or "weight" in payload.goals:
        recommendations.append({
            "title": "Плавание и аквааэробика",
            "desc": "Идеально разгружает суставы и позвоночник, эффективно сжигает калории.",
            "icon": "🏊",
            "color": "#0077ff"
        })

    if payload.complaints.get("pressure") or payload.complaints.get("headache") or "stress" in payload.goals:
        recommendations.append({
            "title": "Скандинавская ходьба",
            "desc": "Задействует до 90% мышц тела, снижает артериальное давление и снимает стресс.",
            "icon": "🌲",
            "color": "#7c3aed"
        })

    if len(recommendations) < 4 and ("endurance" in payload.goals or payload.activity_level == "low"):
        recommendations.append({
            "title": "Эллиптический тренажер / Велосипед",
            "desc": "Мягкая кардионагрузка для развития выносливости в комфортном темпе.",
            "icon": "🚴",
            "color": "#0ea5e9"
        })

    if len(recommendations) < 4:
        recommendations.append({
            "title": "Суставная гимнастика и растяжка",
            "desc": "Комплекс упражнений на мобильность суставов и эластичность связок.",
            "icon": "🤸",
            "color": "#64748b"
        })

    return JSONResponse(content={
        "status": "success",
        "bmi": bmi,
        "ai_text": ai_summary,
        "recommendations": recommendations[:5]
    })

# ====================== СТАТИКА ======================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_FILE = os.path.join(BASE_DIR, "index.html")

@app.get("/")
async def serve_root():
    if os.path.exists(INDEX_FILE):
        return FileResponse(INDEX_FILE)
    return JSONResponse(status_code=404, content={"detail": "index.html not found"})

@app.get("/index.html")
async def serve_index():
    if os.path.exists(INDEX_FILE):
        return FileResponse(INDEX_FILE)
    return JSONResponse(status_code=404, content={"detail": "index.html not found"})

app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")