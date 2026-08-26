# C:\STAS\backend\database.py
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd

from .models import SportAvailability, SportProfile


class DatabaseError(Exception):
    """Ошибка загрузки базы данных СТАС."""
    pass


# ЕДИНЫЙ ПОЛНЫЙ СТРОГИЙ РЕЕСТР ВОЗРАСТОВ ЗАЧИСЛЕНИЯ ПО ФССП РФ
# Для дошкольников (4-6 лет) учтены группы раннего развития / ОФП
FSSP_STRICT_AGES = {
    # Секции г. Лангепас
    "спортивная акробатика": 4,     # Группы ОФП с элементами акробатики
    "прыжки на батуте": 4,           # Группы ОФП на батуте
    "художественная гимнастика": 4,  # Группы раннего физического развития
    "плавание": 5,                  # Группы обучению плаванию / ОФП
    "шахматы": 5,                   # Группы логического развития
    "теннис": 6,
    "настольный теннис": 6,
    "тхэквондо": 6,
    "баскетбол": 7,
    "мини-футбол (футзал)": 7,
    "мини-футбол": 7,
    "футзал": 7,
    "волейбол": 8,
    "хоккей": 8,
    "лыжные гонки": 8,
    "бокс": 9,
    "дзюдо": 9,
    "самбо": 9,
    "вольная борьба": 9,
    "спортивная борьба (вольная борьба)": 9,
    "тяжёлая атлетика": 10,
    "тяжелая атлетика": 10,
    "муайтай (тайский бокс)": 9,
    "муайтай": 9,
    "стрельба из лука": 10,
    "смешанное боевое единоборство (мма)": 10,
    "мма": 10,
    "грепплинг": 10,
    "грэпплинг": 10,

    # Всероссийский реестр
    "автомодельный спорт": 8, "авиамодельный спорт": 8, "авиационные гонки": 10, "автомобильный спорт": 10,
    "айкидо": 7, "акробатический рок-н-ролл": 6, "альпинизм": 10, "американский футбол": 9, "армрестлинг": 10,
    "бадминтон": 7, "бейсбол": 9, "биатлон": 9, "бильярдный спорт": 10, "бобслей": 12, "бодибилдинг": 14,
    "борзьба на поясах": 10, "борьба на поясах": 10, "боулспорт": 8, "боулинг": 8, "брейкинг": 6,
    "велосипедный спорт": 10, "вертолетный спорт": 10, "водно-спасательное многоборье": 9, "водно-моторный спорт": 10,
    "водное поло": 8, "воднолыжный спорт": 7, "воздухоплавательный спорт": 10, "воздушная гимнастика": 6,
    "воздушно-силовая атлетика": 9, "гандбол": 8, "гиревой спорт": 10, "го": 6, "гольф": 7,
    "гонки дронов (беспилотных воздушных судов)": 8, "гонки дронов": 8, "гонки с препятствиями": 9,
    "горнолыжный спорт": 7, "городошный спорт": 8, "гребля на байдарках и каноэ": 10, "гребной слалом": 10,
    "гребной спорт (академическая гребля)": 10, "гребной спорт": 10, "дартс": 7, "джутайдо": 7, "джиу-джитсу": 7,
    "ездовой спорт": 9, "зимнее плавание": 12, "капоэйра": 6, "каратэ": 7, "кендо": 7, "кёрлинг": 8,
    "кикбоксинг": 10, "кинологический спорт": 9, "киокусинкай / киокушин": 9, "киокусинкай": 9, "киокушин": 9,
    "компьютерный спорт": 7, "конный спорт": 9, "конькобежный спорт": 8, "корэш": 10, "крикет": 9, "кудо": 7,
    "лазерный бой": 8, "лапта": 8, "легкая атлетика": 9, "лёгкая атлетика": 9, "логические игры": 6,
    "лыжное двоеборье": 8, "микрофутзал": 7, "многоборье готов к труду и обороне (гто)": 6, "морское многоборье": 9,
    "мотоциклетный спорт": 9, "нарды": 7, "падел": 7, "парашютный спорт": 14, "парусный спорт": 8,
    "пауэрлифтинг": 10, "перетягивание каната": 9, "пилонный спорт": 6, "планерный спорт": 10, "подводный спорт": 8,
    "полиатлон": 9, "практическая стрельба": 10, "прыжки в воду": 6, "прыжки на лыжах с трамплина": 8,
    "пулевая стрельба": 9, "пэйнтбол": 9, "радиоспорт": 8, "рафтинг": 9, "регбол": 9, "регби": 9,
    "роллер спорт": 7, "роуп скиппинг (спортивная скакалка)": 6, "рукопашный бой": 10, "рыболовный спорт": 8,
    "сават": 10, "самолетный спорт": 10, "санный спорт": 9, "северное многоборье": 9, "серфинг": 8,
    "силовой спорт": 10, "силовой экстрим": 14, "синхронное плавание": 6, "скалолазание": 8, "сквош": 7,
    "скейтбординг": 7, "сноуборд": 7, "современное пятиборье": 9, "софтбол": 8, "спорт сверхлегкой авиации": 10,
    "спортивный бридж": 7, "спортивно-прикладное собаководство": 9, "спортивное метание ножа": 10,
    "спорт глухих": 6, "спорт лиц с интеллектуальными нарушениями": 6, "спорт лиц с поражением ода": 6,
    "спорт слепых": 6, "спортивная аэробика": 6, "спортивная гимнастика": 4, "спортивная йога": 6,
    "спортивное ориентирование": 7, "спортивное программирование": 7, "спортивный туризм": 7,
    "стендовая стрельба": 11, "страйкбол": 10, "стрельба из арбалета": 10, "стрельба на дальние дистанции": 10,
    "судомодельный спорт": 8, "сумо": 9, "танцевальный спорт": 5, "теннис": 6, "триатлон": 9, "тхэквондо гтф": 6,
    "тхэквондо итф": 6, "тхэквондо мфт": 6, "универсальный бой": 10, "ушу": 6, "фехтование": 9,
    "фигурное катание на коньках": 4, "фиджитал спорт (функционально-цифровой спорт)": 7, "фитнес-аэробика": 6,
    "флорбол": 8, "флаинг диск": 8, "фристайл": 7, "функциональное многоборье": 9, "футбол": 7,
    "футбол лиц с заболеванием цп": 7, "хапкидо": 6, "хоккей на траве": 8, "хоккей с мячом": 8,
    "чир спорт": 5, "шахбокс": 10, "шашки": 6, "эстетическая гимнастика": 4
}


class StasDatabase:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            self.data_dir = Path(__file__).resolve().parent.parent / "data"
        else:
            self.data_dir = Path(data_dir)

    def get_fssp_age(self, name_str: str) -> int:
        clean = name_str.lower().strip()
        if clean in FSSP_STRICT_AGES:
            return FSSP_STRICT_AGES[clean]
        
        best_match_key = None
        best_match_len = 0
        for key in FSSP_STRICT_AGES:
            if key in clean or clean in key:
                if len(key) > best_match_len:
                    best_match_len = len(key)
                    best_match_key = key
        
        if best_match_key:
            return FSSP_STRICT_AGES[best_match_key]

        return 8

    def load_sports_from_excel(self) -> List[SportProfile]:
        excel_path = self.data_dir / "Reestr.xls"
        if not excel_path.exists():
            excel_path = Path(__file__).resolve().parent.parent / "Reestr.xls"

        if not excel_path.exists():
            return []

        xls = pd.ExcelFile(excel_path)
        sports_list = []
        seen_names = set()

        for sheet_name in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet_name)
            if df.shape[1] < 2:
                continue

            raw_names = df.iloc[:, 1].dropna().tolist()
            for name in raw_names:
                name_str = str(name).strip()
                if not name_str or "Наименование" in name_str or "раздел" in name_str:
                    continue

                clean_name = name_str.lower().strip()
                if clean_name in seen_names:
                    continue
                seen_names.add(clean_name)

                min_age = self.get_fssp_age(clean_name)

                sports_list.append(
                    SportProfile(
                        id=clean_name.replace(" ", "_"),
                        name=name_str,
                        category="Вид спорта РФ",
                        physical={"endurance": 6, "strength": 6, "speed": 6, "coordination": 6, "flexibility": 6},
                        psychology={"discipline": 7, "stress_resistance": 7, "motivation": 7},
                        anthropometry={},
                        team=False,
                        contact="none",
                        age_min=min_age,
                        sources=["Всероссийский реестр видов спорта (Reestr.xls)"]
                    )
                )

        return sports_list

    def load_sports(self) -> List[SportProfile]:
        return self.load_sports_from_excel()

    def load_langepas_availability(self) -> List[SportAvailability]:
        excel_path = self.data_dir / "Langsport.xls"
        if not excel_path.exists():
            excel_path = Path(__file__).resolve().parent.parent / "Langsport.xls"

        if excel_path.exists():
            try:
                xls = pd.ExcelFile(excel_path)
                df = pd.read_excel(xls, sheet_name=0)
                result = []

                for col in df.columns:
                    raw_col = str(col).strip()
                    if "Академия спорта" in raw_col:
                        org_name = "СШОР «Академия спорта»"
                    elif "Лангепас" in raw_col:
                        org_name = "СШ «Лангепас»"
                    elif "Дельфин" in raw_col:
                        org_name = "СШ «Дельфин»"
                    else:
                        org_name = raw_col

                    disciplines = df[col].dropna().tolist()
                    for d in disciplines:
                        d_str = str(d).strip()
                        if not d_str:
                            continue

                        result.append(
                            SportAvailability(
                                sport_id=d_str.lower().strip().replace(" ", "_"),
                                name=d_str,
                                status="active",
                                organization_or_object=org_name,
                                address="г. Лангепас",
                                notes="Официальное отделение",
                                source="Langsport.xls"
                            )
                        )
                if result:
                    return result
            except Exception as e:
                print(f"Предупреждение при чтении Langsport.xls: {e}")

        return []

    def get_data_version(self) -> Optional[str]:
        return "10.0 (Опросник Белова/Айзенка + Дошкольное ОФП)"