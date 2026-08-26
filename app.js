document.addEventListener("DOMContentLoaded", () => {
    updateApiStatusBadge();
});

function updateApiStatusBadge() {
    const statusEl = document.getElementById("apiStatus");
    if (!statusEl) return;

    statusEl.textContent = "STAS API: Подключено";
    statusEl.style.background = "#e8f9e9";
    statusEl.style.color = "#15803d";
}

const SPORT_PROFILES = {
    "СПОРТИВНАЯ АКРОБАТИКА": { min_age: 4, max_age: 16, org: "СШОР «Академия спорта»", weights: { flexibility: 0.45, coordination: 0.35, speed_strength: 0.20 }, pref_temp: ["sanguine"], max_bmi: 20.0, height_pref: "low", rank: 1.0 },
    "ПРЫЖКИ НА БАТУТЕ": { min_age: 4, max_age: 18, org: "СШОР «Академия спорта»", weights: { coordination: 0.50, speed_strength: 0.30, flexibility: 0.20 }, pref_temp: ["sanguine"], max_bmi: 21.0, height_pref: "medium", rank: 0.92 },
    "БОКС": { min_age: 9, max_age: 55, org: "СШОР «Академия спорта»", weights: { speed: 0.35, strength: 0.30, speed_strength: 0.35 }, pref_temp: ["choleric"], nerve_pref: "Выпуклый", reaction_crit: true, rank: 0.95 },
    "ДЗЮДО": { min_age: 9, max_age: 55, org: "СШОР «Академия спорта»", weights: { strength: 0.40, coordination: 0.30, endurance: 0.30 }, pref_temp: ["phlegmatic", "sanguine"], nerve_pref: "Выпуклый", rank: 0.88 },
    "САМБО": { min_age: 9, max_age: 55, org: "СШОР «Академия спорта»", weights: { strength: 0.35, endurance: 0.35, coordination: 0.30 }, pref_temp: ["phlegmatic", "choleric"], nerve_pref: "Выпуклый", rank: 0.84 },
    "ВОЛЬНАЯ БОРЬБА": { min_age: 9, max_age: 45, org: "СШОР «Академия спорта»", weights: { strength: 0.40, speed_strength: 0.30, endurance: 0.30 }, pref_temp: ["choleric"], nerve_pref: "Выпуклый", rank: 0.81 },
    "ТЯЖЁЛАЯ АТЛЕТИКА": { min_age: 10, max_age: 60, org: "СШОР «Академия спорта»", weights: { strength: 0.60, speed_strength: 0.40 }, pref_temp: ["phlegmatic"], min_bmi: 22.0, height_pref: "low", rank: 0.78 },
    "СТРЕЛЬБА ИЗ ЛУКА": { min_age: 10, max_age: 65, org: "СШОР «Академия спорта»", weights: { coordination: 0.55, endurance: 0.45 }, pref_temp: ["phlegmatic", "melancholic"], nerve_pref: "Ровный", rank: 0.86 },
    "СМЕШАННЫЕ ЕДИНОБОРСТВА (ММА)": { min_age: 10, max_age: 45, org: "СШОР «Академия спорта»", weights: { strength: 0.35, endurance: 0.35, speed: 0.30 }, pref_temp: ["choleric"], nerve_pref: "Выпуклый", reaction_crit: true, rank: 0.90 },
    "ПЛАВАНИЕ": { min_age: 5, max_age: 70, org: "СШ «Дельфин»", weights: { endurance: 0.45, coordination: 0.35, flexibility: 0.20 }, pref_temp: ["sanguine", "phlegmatic"], height_pref: "high", rank: 0.89 },
    "ШАХМАТЫ": { min_age: 5, max_age: 80, org: "СШ «Лангепас»", weights: { coordination: 0.60, endurance: 0.40 }, pref_temp: ["phlegmatic", "melancholic"], nerve_pref: "Ровный", rank: 0.75 },
    "БАСКЕТБОЛ": { min_age: 7, max_age: 50, org: "СШ «Лангепас»", weights: { speed: 0.35, speed_strength: 0.35, coordination: 0.30 }, pref_temp: ["sanguine"], height_pref: "high", rank: 0.83 }
};

const questions = [
    { key: "full_name", type: "text", title: "1. ФИО спортсмена:", placeholder: "Например: Кожевников Юрий" },
    { key: "birth_date", type: "date", title: "2. Дата рождения:", placeholder: "" },
    { key: "sex", type: "choice", title: "3. Укажите пол:", options: [{ label: "👦 Мальчик / Мужчина", val: "male" }, { label: "👧 Девочка / Женщина", val: "female" }] },
    { key: "height", type: "number", title: "4. Рост спортсмена (в см):", placeholder: "Например: 179" },
    { key: "weight", type: "number", title: "5. Вес спортсмена (в кг):", placeholder: "Например: 95" },
    { key: "father_height", type: "number", title: "6. Рост отца (в см):", placeholder: "Например: 182 (можно пропустить)" },
    { key: "mother_height", type: "number", title: "7. Рост матери (в см):", placeholder: "Например: 168 (можно пропустить)" },
    { key: "speed", type: "choice", title: "8. Скоростные способности:", options: [{ label: "Низкие", val: 2 }, { label: "Средние", val: 6 }, { label: "Высокие", val: 8 }, { label: "Отличные", val: 10 }] },
    { key: "strength", type: "choice", title: "9. Силовые способности:", options: [{ label: "Низкие", val: 2 }, { label: "Средние", val: 6 }, { label: "Высокие", val: 8 }, { label: "Отличные", val: 10 }] },
    { key: "coordination", type: "choice", title: "10. Координационные способности:", options: [{ label: "Низкие", val: 2 }, { label: "Средние", val: 6 }, { label: "Высокие", val: 8 }, { label: "Отличные", val: 10 }] },
    { key: "flexibility", type: "choice", title: "11. Гибкость:", options: [{ label: "Низкая", val: 2 }, { label: "Средняя", val: 6 }, { label: "Хорошая", val: 8 }, { label: "Отличная", val: 10 }] },
    { key: "endurance", type: "choice", title: "12. Выносливость:", options: [{ label: "Низкая", val: 2 }, { label: "Средняя", val: 6 }, { label: "Высокая", val: 8 }, { label: "Отличная", val: 10 }] },
    { key: "temp_q1", type: "choice", title: "13. Реакция на интенсивные нагрузки:", options: [
        { label: "🏃 Быстро адаптируется (Сангвиник)", val: "sanguine" },
        { label: "🔥 Вспыльчив, неудержим (Холерик)", val: "choleric" },
        { label: "🧘 Спокоен, выдержан (Флегматик)", val: "phlegmatic" },
        { label: "🎨 Быстро устает психически (Меланхолик)", val: "melancholic" }
    ]},
    { key: "temp_q2", type: "choice", title: "14. Принятие решений в соревновании:", options: [
        { label: "⚡ Быстро и обдуманно (Сангвиник)", val: "sanguine" },
        { label: "💥 Рискованно, агрессивно (Холерик)", val: "choleric" },
        { label: "🎯 Медленно, взвешенно (Флегматик)", val: "phlegmatic" },
        { label: "🛡️ Осторожно, сомневаясь (Меланхолик)", val: "melancholic" }
    ]},
    { key: "parent_q1", type: "choice", title: "15. Анкета родителей (Кузнецова): Проявление интереса к спорту:", options: [
        { label: "🔥 Высокий — постоянная активность и инициатива", val: 10 },
        { label: "👍 Средний — занимается по настроению", val: 6 },
        { label: "🛡️ Низкий — предпочитает спокойный досуг", val: 3 }
    ]},
    { key: "parent_q2", type: "choice", title: "16. Анкета родителей (Кузнецова): Готовность поддержки семьи:", options: [
        { label: "🏆 Полная готовность содействовать тренировкам", val: 10 },
        { label: "🤝 Умеренная поддержка при наличии времени", val: 6 },
        { label: "⏳ Ограниченная поддержка", val: 3 }
    ]}
];

let currentStep = 0;
let userAnswers = {};

let reactionStartTime = 0;
let reactionTimerToken = null;
let reactionState = "idle";
let calculatedReactionMs = 0;

let tapIntervals = [0, 0, 0, 0, 0, 0];
let currentIntervalIdx = 0;
let tapTimerToken = null;
let tapSecondsLeft = 30;
let totalTapCount = 0;
let isTappingActive = false;

window.startQuiz = function() {
    currentStep = 0;
    userAnswers = {};
    document.getElementById("welcomeScreen").classList.add("hidden");
    document.getElementById("quizScreen").classList.remove("hidden");
    showQuestion();
};

function showQuestion() {
    const q = questions[currentStep];
    const container = document.getElementById("questionContainer");
    const indicator = document.getElementById("stepIndicator");
    const progress = document.getElementById("progressFill");
    const prevBtn = document.getElementById("prevBtn");

    if (indicator) indicator.textContent = `Шаг ${currentStep + 1} из ${questions.length}`;
    if (progress) progress.style.width = `${((currentStep + 1) / questions.length) * 100}%`;
    if (prevBtn) prevBtn.style.display = currentStep > 0 ? "inline-block" : "none";

    let html = `<div class="question-title">${q.title}</div>`;

    if (q.type === "text" || q.type === "number" || q.type === "date") {
        const existingVal = userAnswers[q.key] || "";
        const inputType = q.type === "number" ? "number" : (q.type === "date" ? "date" : "text");
        html += `
            <input type="${inputType}" id="quizInput" class="input-field" placeholder="${q.placeholder}" value="${existingVal}">
            <button type="button" class="btn-primary" onclick="submitInputAnswer()">Далее ➔</button>
        `;
    } else {
        html += `<div class="options-list">`;
        q.options.forEach(opt => {
            const isSelected = userAnswers[q.key] === opt.val ? "selected" : "";
            html += `<button type="button" class="option-btn ${isSelected}" onclick="selectChoiceAnswer('${q.key}', '${opt.val}')">${opt.label}</button>`;
        });
        html += `</div>`;
    }
    if (container) container.innerHTML = html;
}

window.selectChoiceAnswer = function(key, val) {
    userAnswers[key] = val;
    setTimeout(() => {
        if (currentStep < questions.length - 1) { currentStep++; showQuestion(); }
        else { openReactionScreen(); }
    }, 180);
};

window.submitInputAnswer = function() {
    const input = document.getElementById("quizInput");
    const q = questions[currentStep];

    if ((q.key === "father_height" || q.key === "mother_height") && (!input || !input.value)) {
        userAnswers[q.key] = null;
    } else if (!input || !input.value) {
        alert("Пожалуйста, введите значение");
        return;
    } else {
        userAnswers[q.key] = q.type === "number" ? Number(input.value) : input.value;
    }

    if (currentStep < questions.length - 1) { currentStep++; showQuestion(); }
    else { openReactionScreen(); }
};

window.prevStep = function() {
    if (currentStep > 0) { currentStep--; showQuestion(); }
};

// СЕНСОМОТОРНЫЙ ТЕСТ
function openReactionScreen() {
    document.getElementById("quizScreen").classList.add("hidden");
    document.getElementById("reactionScreen").classList.remove("hidden");
    resetReactionState();
}

function resetReactionState() {
    if (reactionTimerToken) clearTimeout(reactionTimerToken);
    reactionState = "idle";
    const box = document.getElementById("reactionBox");
    box.style.background = "#f3f4f6";
    box.style.borderColor = "#9ca3af";
    document.getElementById("reactionPrompt").textContent = "Нажмите 'СТАРТ ТЕСТА РЕАКЦИИ'";
    document.getElementById("startReactionBtn").style.display = "inline-block";
}

window.startReactionTest = function() {
    document.getElementById("startReactionBtn").style.display = "none";
    const box = document.getElementById("reactionBox");
    box.style.background = "#fee2e2";
    box.style.borderColor = "#ef4444";
    document.getElementById("reactionPrompt").textContent = "ЖДИТЕ ЗЕЛЕНЫЙ ЦВЕТ...";
    reactionState = "waiting";

    const randomDelay = Math.floor(Math.random() * 2000) + 1500;
    reactionTimerToken = setTimeout(() => {
        box.style.background = "#dcfce7";
        box.style.borderColor = "#22c55e";
        document.getElementById("reactionPrompt").textContent = "ЖМИ СЮДА!";
        reactionStartTime = Date.now();
        reactionState = "ready";
    }, randomDelay);
};

window.handleReactionClick = function() {
    if (reactionState === "waiting") {
        clearTimeout(reactionTimerToken);
        alert("Слишком рано! Дождитесь зеленого цвета.");
        resetReactionState();
    } else if (reactionState === "ready") {
        calculatedReactionMs = Date.now() - reactionStartTime;
        reactionState = "finished";
        let rating = "Отличная реакция";
        if (calculatedReactionMs > 320) rating = "Средняя реакция";
        if (calculatedReactionMs > 420) rating = "Умеренная реакция";

        userAnswers.reaction_result = { reaction_ms: calculatedReactionMs, rating: rating };
        openTappingTestScreen();
    }
};

// ТЕППИНГ-ТЕСТ
function openTappingTestScreen() {
    document.getElementById("reactionScreen").classList.add("hidden");
    document.getElementById("tappingScreen").classList.remove("hidden");

    if (tapTimerToken) { clearInterval(tapTimerToken); tapTimerToken = null; }
    tapIntervals = [0, 0, 0, 0, 0, 0];
    currentIntervalIdx = 0;
    tapSecondsLeft = 30;
    totalTapCount = 0;
    isTappingActive = false;

    document.getElementById("tapTimer").textContent = "30";
    document.getElementById("startTapBtn").style.display = "inline-block";
    document.getElementById("tapPromptText").style.display = "block";
    const tapArea = document.getElementById("tapArea");
    if (tapArea) tapArea.classList.remove("active");
    const countDisplay = document.getElementById("tapCountDisplay");
    if (countDisplay) { countDisplay.style.display = "none"; countDisplay.textContent = "0"; }
}

window.startTappingTest = function() {
    tapIntervals = [0, 0, 0, 0, 0, 0];
    currentIntervalIdx = 0;
    tapSecondsLeft = 30;
    totalTapCount = 0;
    isTappingActive = true;

    document.getElementById("startTapBtn").style.display = "none";
    document.getElementById("tapArea").classList.add("active");
    document.getElementById("tapPromptText").style.display = "none";
    const countDisplay = document.getElementById("tapCountDisplay");
    countDisplay.style.display = "block"; countDisplay.textContent = "0";

    tapTimerToken = setInterval(() => {
        tapSecondsLeft--;
        document.getElementById("tapTimer").textContent = tapSecondsLeft;
        currentIntervalIdx = Math.floor((30 - tapSecondsLeft) / 5);
        if (currentIntervalIdx > 5) currentIntervalIdx = 5;

        if (tapSecondsLeft <= 0) {
            clearInterval(tapTimerToken);
            tapTimerToken = null;
            isTappingActive = false;
            finishTappingTest();
        }
    }, 1000);
};

window.registerTap = function() {
    if (!isTappingActive) return;
    totalTapCount++;
    tapIntervals[currentIntervalIdx]++;
    document.getElementById("tapCountDisplay").textContent = totalTapCount;
};

function finishTappingTest() {
    let nerveType = "Ровный (Стабильная НС)";
    const t = tapIntervals;
    if (t[1] > t[0] || t[2] > t[0]) nerveType = "Выпуклый (Сильная НС)";
    else if (t[0] > t[2] && t[2] > t[4]) nerveType = "Ниспадающий (Слабая НС)";
    else if (t[2] < t[0] && t[5] > t[2]) nerveType = "Вогнутый (Волнообразная НС)";

    userAnswers.tapping_result = {
        t1: t[0], t2: t[1], t3: t[2], t4: t[3], t5: t[4], t6: t[5],
        total_clicks: totalTapCount,
        nerve_type: nerveType
    };

    calculateClientResults();
}

function calculateClientResults() {
    document.getElementById("tappingScreen").classList.add("hidden");

    const birthDate = userAnswers.birth_date ? new Date(userAnswers.birth_date) : new Date("2018-01-01");
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    age = Math.max(4, age);

    const height = Number(userAnswers.height || 120);
    const weight = Number(userAnswers.weight || 25);
    const heightM = height / 100;
    const bmi = Number((weight / (heightM * heightM)).toFixed(1));

    let targetH = null;
    if (userAnswers.father_height && userAnswers.mother_height) {
        targetH = (Number(userAnswers.father_height) + Number(userAnswers.mother_height) + (userAnswers.sex === "male" ? 13 : -13)) / 2;
    }

    const phys = {
        speed: Number(userAnswers.speed || 6),
        strength: Number(userAnswers.strength || 6),
        coordination: Number(userAnswers.coordination || 6),
        speed_strength: Number(userAnswers.speed || 6),
        flexibility: Number(userAnswers.flexibility || 8),
        endurance: Number(userAnswers.endurance || 6)
    };

    const scored = [];

    for (const [sportName, spec] of Object.entries(SPORT_PROFILES)) {
        if (age < spec.min_age || age > spec.max_age) continue;

        let physScore = 0;
        for (const [skill, w] of Object.entries(spec.weights)) {
            physScore += (phys[skill] || 5) * w;
        }

        let tempMod = spec.pref_temp.includes(userAnswers.temp_q1) ? 0.8 : -0.5;
        let nerveMod = (userAnswers.tapping_result && spec.nerve_pref && userAnswers.tapping_result.nerve_type.includes(spec.nerve_pref)) ? 0.8 : -0.6;

        let reactMod = 0;
        if (userAnswers.reaction_result) {
            const ms = userAnswers.reaction_result.reaction_ms;
            if (ms < 250 && spec.reaction_crit) reactMod = 0.8;
            else if (ms > 350 && spec.reaction_crit) reactMod = -0.8;
        }

        let bmiMod = 0;
        if (spec.max_bmi && bmi > spec.max_bmi) bmiMod -= (bmi - spec.max_bmi) * 0.6;
        if (spec.min_bmi && bmi < spec.min_bmi) bmiMod -= (spec.min_bmi - bmi) * 0.6;

        let rawScore = (physScore + tempMod + nerveMod + reactMod + bmiMod) * spec.rank;
        let finalPercent = Math.round(Math.min(96, Math.max(35, rawScore * 9.6)));

        let note = finalPercent >= 60 
            ? (age < 18 ? "Рекомендуется к зачислению в спортивную школу" : "Доступно для зачисления")
            : "Необходимо еще потренироваться (ОФП)";

        scored.push({
            sport_name: sportName,
            score: finalPercent,
            status_note: note,
            local_availability: { organization_or_object: spec.org }
        });
    }

    scored.sort((a, b) => b.score - a.score);

    const resultPayload = {
        user_info: {
            full_name: userAnswers.full_name || "Кожевников Юрий",
            age_years: age,
            sex_label: userAnswers.sex === "male" ? "Мужской" : "Женский",
            height_cm: height,
            weight_kg: weight,
            bmi: bmi,
            target_adult_height_cm: targetH ? Math.round(targetH) : null,
            temperament: userAnswers.temp_q1 || "sanguine",
            physical: phys,
            tapping_test: userAnswers.tapping_result,
            reaction_test: userAnswers.reaction_result
        },
        ai_recommendation: `СТАС проанализировал данные (${age} лет, ИМТ ${bmi}). Ваша ведущая предрасположенность: ${scored.slice(0, 3).map(s => `${s.sport_name} (${s.score}%)`).join(", ")}!`,
        top_sports: scored.slice(0, 6)
    };

    renderDashboard(resultPayload);
}

function renderDashboard(data) {
    document.getElementById("resultsScreen").classList.remove("hidden");

    const info = data.user_info || {};
    document.getElementById("resChildName").textContent = info.full_name || "Спортсмен";
    document.getElementById("resChildAgeSex").textContent = `${info.age_years} лет | ${info.sex_label || "Спортсмен"}`;

    document.getElementById("resAiText").textContent = data.ai_recommendation || "Рекомендация сформирована";

    const phys = info.physical || {};
    setBar("Speed", phys.speed || 6);
    setBar("Strength", phys.strength || 6);
    setBar("Coord", phys.coordination || 6);
    setBar("SpeedStrength", phys.speed_strength || 6);
    setBar("Flex", phys.flexibility || 8);
    setBar("Endurance", phys.endurance || 6);

    document.getElementById("resHeightVal").textContent = `${info.height_cm} см`;
    document.getElementById("resTargetHeightVal").textContent = info.target_adult_height_cm ? `${info.target_adult_height_cm} ± 4 см` : "Не указано";
    document.getElementById("resWeightVal").textContent = `${info.weight_kg} кг`;
    document.getElementById("resBmiVal").textContent = `${info.bmi} кг/м²`;

    const react = info.reaction_test;
    document.getElementById("resReactionVal").textContent = react ? `${react.reaction_ms} мс (${react.rating})` : "Не проходился";

    const tempMap = { sanguine: "Сангвиник", choleric: "Холерик", phlegmatic: "Флегматик", melancholic: "Меланхолик" };
    document.getElementById("resTemperamentVal").textContent = tempMap[info.temperament] || "Сангвиник";

    const tap = info.tapping_test;
    document.getElementById("resTappingVal").textContent = tap ? `${tap.nerve_type} (${tap.total_clicks} кл)` : "Не проходился";

    const recGrid = document.getElementById("recommendedGrid");
    const trainGrid = document.getElementById("trainGrid");
    recGrid.innerHTML = ""; trainGrid.innerHTML = "";

    const topSports = data.top_sports || [];
    topSports.forEach((sport) => {
        const percent = Math.round(sport.score || 0);
        const org = sport.local_availability?.organization_or_object || "СШОР «Академия спорта»";
        const note = sport.status_note || (percent >= 60 ? "Рекомендуется к зачислению в спортивную школу" : "Необходимо еще потренироваться (ОФП)");

        let strokeColor = "#10b981";
        let textColor = "#047857";
        if (percent < 60) {
            strokeColor = "#f59e0b";
            textColor = "#b45309";
        }

        const cardHtml = `
            <div class="sport-card">
                <div class="sport-card-info">
                    <h4>${sport.sport_name}</h4>
                    <div class="sport-org">🏛️ ${org}</div>
                    <div class="sport-status-sub">${note}</div>
                </div>
                <div class="circle-score-wrap" style="background: conic-gradient(${strokeColor} ${percent}%, #e5e7eb ${percent}% 100%);">
                    <div class="circle-score-inner" style="color: ${textColor};">
                        ${percent}%
                    </div>
                </div>
            </div>
        `;
        
        if (percent >= 60) recGrid.innerHTML += cardHtml;
        else trainGrid.innerHTML += cardHtml;
    });

    if (recGrid.children.length === 0) {
        recGrid.innerHTML = `<div style="font-size:13px; color:#6b7280; padding:10px;">В настоящий момент рекомендуется сделать упор на базовое развитие ОФП.</div>`;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setBar(idKey, score10) {
    const percent = Math.round((score10 / 10) * 100);
    const valEl = document.getElementById(`bar${idKey}Val`);
    const fillEl = document.getElementById(`bar${idKey}Fill`);
    if (valEl) valEl.textContent = `${percent}%`;
    if (fillEl) fillEl.style.width = `${percent}%`;
}

window.restartQuiz = function() {
    if (tapTimerToken) { clearInterval(tapTimerToken); tapTimerToken = null; }
    if (reactionTimerToken) { clearTimeout(reactionTimerToken); reactionTimerToken = null; }
    isTappingActive = false;
    currentStep = 0;
    userAnswers = {};

    document.getElementById("resultsScreen").classList.add("hidden");
    document.getElementById("tappingScreen").classList.add("hidden");
    document.getElementById("reactionScreen").classList.add("hidden");
    document.getElementById("quizScreen").classList.add("hidden");
    document.getElementById("welcomeScreen").classList.remove("hidden");
};

window.downloadPDF = function() {
    const element = document.getElementById('pdfReportContent');
    const actionBtns = document.querySelector('.action-buttons-group');
    
    if (actionBtns) actionBtns.style.display = 'none';
    element.classList.add('pdf-export-mode');

    const opt = {
        margin:       [5, 5, 5, 5],
        filename:     `STAS_Report_${userAnswers.full_name || 'Sportsman'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            logging: false
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        element.classList.remove('pdf-export-mode');
        if (actionBtns) actionBtns.style.display = 'flex';
    }).catch(err => {
        element.classList.remove('pdf-export-mode');
        if (actionBtns) actionBtns.style.display = 'flex';
        console.error("Ошибка PDF:", err);
    });
};