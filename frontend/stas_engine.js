// stas_engine.js — Автономный расчетный движок СТАС для VK Mini Apps

const LANGEPAS_SECTIONS = {
    "бокс": "СШОР «Академия спорта»",
    "дзюдо": "СШОР «Академия спорта»",
    "самбо": "СШОР «Академия спорта»",
    "прыжки на батуте": "СШОР «Академия спорта»",
    "спортивная акробатика": "СШОР «Академия спорта»",
    "стрельба из лука": "СШОР «Академия спорта»",
    "вольная борьба": "СШОР «Академия спорта»",
    "тяжёлая атлетика": "СШОР «Академия спорта»",
    "смешанное боевое единоборство (мма)": "СШОР «Академия спорта»",
    "грэпплинг": "СШОР «Академия спорта»",

    "баскетбол": "СШ «Лангепас»",
    "волейбол": "СШ «Лангепас»",
    "мини-футбол (футзал)": "СШ «Лангепас»",
    "хоккей": "СШ «Лангепас»",
    "лыжные гонки": "СШ «Лангепас»",
    "тхэквондо": "СШ «Лангепас»",
    "муайтай (тайский бокс)": "СШ «Лангепас»",
    "шахматы": "СШ «Лангепас»",

    "плавание": "СШ «Дельфин»",
    "художественная гимнастика": "СШ «Дельфин»",
    "теннис": "СШ «Дельфин»",
    "настольный теннис": "СШ «Дельфин»"
};

const FSSP_MIN_AGES = {
    "спортивная акробатика": 4, "прыжки на батуте": 4, "художественная гимнастика": 4,
    "плавание": 5, "шахматы": 5, "теннис": 6, "настольный теннис": 6, "тхэквондо": 6,
    "баскетбол": 7, "мини-футбол (футзал)": 7, "волейбол": 8, "хоккей": 8, "лыжные гонки": 8,
    "бокс": 9, "дзюдо": 9, "самбо": 9, "вольная борьба": 9, "муайтай (тайский бокс)": 9,
    "тяжёлая атлетика": 10, "стрельба из лука": 10, "смешанное боевое единоборство (мма)": 10, "грэпплинг": 10
};

function calculateExactAge(birthDateStr) {
    const bDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
        age--;
    }
    return age + (m < 0 ? m + 12 : m) / 12.0;
}

function calculateTargetHeight(fatherH, motherH, sex) {
    if (fatherH && motherH) {
        return sex === "male" ? (fatherH + motherH + 13) / 2 : (fatherH + motherH - 13) / 2;
    }
    return null;
}

function runStasEngineClient(userData) {
    const ageYears = calculateExactAge(userData.birth_date);
    const targetHeight = calculateTargetHeight(userData.father_height, userData.mother_height, userData.sex);
    const bmi = userData.weight / Math.pow(userData.height / 100, 2);

    let results = [];

    for (const [sportName, org] of Object.entries(LANGEPAS_SECTIONS)) {
        const minAge = FSSP_MIN_AGES[sportName] || 7;
        
        // ЖЕСТКАЯ ОТСЕЧКА МИНСПОРТА РФ
        if (ageYears < minAge) continue;

        let score = 7.5;

        // Эвристический расчет предрасположенности
        if (userData.physical.flexibility >= 8 && ["спортивная акробатика", "прыжки на батуте", "художественная гимнастика"].includes(sportName)) {
            score += 1.5;
        }
        if (userData.physical.coordination >= 8 && ["прыжки на батуте", "теннис", "настольный теннис"].includes(sportName)) {
            score += 1.2;
        }
        if (org === "СШОР «Академия спорта»") {
            score += 1.8; // Бонус приоритета Академии Спорта
        } else {
            score += 1.0;
        }

        const finalScore = Math.min(10.0, score);

        results.push({
            sport_name: sportName.toUpperCase(),
            score: finalScore,
            organization: org,
            min_age: minAge
        });
    }

    results.sort((a, b) => b.score - a.score);

    return {
        user_info: {
            full_name: userData.full_name,
            age_years: ageYears.toFixed(1),
            sex_label: userData.sex === "female" ? "Девочка" : "Мальчик",
            bmi: bmi.toFixed(1),
            target_adult_height: targetHeight ? targetHeight.toFixed(1) : "Не указано"
        },
        top_sports: results.slice(0, 5)
    };
}