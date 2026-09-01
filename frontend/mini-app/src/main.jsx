import bridge from '@vkontakte/vk-bridge';

const API_URL = "https://sportivnyj-agent-archerus.amvera.io";

let currentQuizStep = 0;
let reactionStartTime = 0;
let reactionTimer = null;
let reactionActive = false;

let tappingTimer = null;
let tappingTimeLeft = 30;
let tappingActive = false;
let currentSquare = 1;
let squareCounts = [0, 0, 0, 0, 0, 0];

let useNormsMode = false;

let userAnswers = {
    full_name: "",
    birth_date: "15.05.2016",
    sex: "female",
    height_cm: 125,
    weight_kg: 25,
    father_height_cm: 178,
    mother_height_cm: 165,
    physical: { speed: 6, strength: 6, coordination: 6, speed_strength: 6, flexibility: 6, endurance: 6 },
    normatives: { pullups: 1, flexibility_cm: 8, situps: 29, long_jump_cm: 134, shuttle_run_sec: 9.0, run_30m_sec: 6.0, pushups: 10, target_throw: 3 },
    temperament: "sanguine",
    reaction_ms: 300,
    tapping_test: { nerve_type: "Стабильная НС", curve_type: "Ровный тип", count: 150 }
};

const skillOptions = [
    { label: "Ниже среднего / Требует развития", value: 3 },
    { label: "Средний уровень / Как у большинства сверстников", value: 6 },
    { label: "Высокий уровень / Выделяется среди ровесников", value: 8 },
    { label: "Выдающийся результат / Отличная подготовка", value: 10 }
];

const baseQuestions = [
    { title: "ФИО Ребенка", field: "full_name", type: "text", placeholder: "Например: Иванов Иван" },
    { title: "Дата рождения (ДД.ММ.ГГГГ)", field: "birth_date", type: "date_text", placeholder: "15.05.2016" },
    { title: "Пол ребенка", field: "sex", type: "gender_cards" },
    { title: "Рост ребенка (см)", field: "height_cm", type: "number", isFloat: false, default: 125 },
    { title: "Вес ребенка (кг)", field: "weight_kg", type: "number", isFloat: false, default: 25 },
    { title: "Рост отца (см)", field: "father_height_cm", type: "number", isFloat: false, default: 178 },
    { title: "Рост матери (см)", field: "mother_height_cm", type: "number", isFloat: false, default: 165 }
];

const physicalQuestions = [
    { title: "Скорость и быстрота движений", field: "speed", subfield: "physical", type: "cards_skill" },
    { title: "Сила и мышечное усилие", field: "strength", subfield: "physical", type: "cards_skill" },
    { title: "Координация и ловкость", field: "coordination", subfield: "physical", type: "cards_skill" },
    { title: "Скоростно-силовые качества (прыгучесть)", field: "speed_strength", subfield: "physical", type: "cards_skill" },
    { title: "Гибкость и подвижность суставов", field: "flexibility", subfield: "physical", type: "cards_skill" },
    { title: "Выносливость при долгих нагрузках", field: "endurance", subfield: "physical", type: "cards_skill" }
];

const normativesQuestions = [
    { title: "Подтягивание из виса на высокой перекладине (Сила)", desc: "Хват сверху, подбородок выше перекладины.", avg: "Норма: 1 раз", field: "pullups", subfield: "normatives", type: "number_norm", isFloat: false, unit: "раз", default: 1 },
    { title: "Наклон вперед на гимнастической скамье (Гибкость)", desc: "Стоя с прямыми ногами с фиксацией 2 сек.", avg: "Норма: 8 см", field: "flexibility_cm", subfield: "normatives", type: "number_norm", isFloat: false, unit: "см", default: 8 },
    { title: "Поднимание туловища из положения лежа (Выносливость)", desc: "Руки за головой в замок, за 1 минуту.", avg: "Норма: 29 раз/мин", field: "situps", subfield: "normatives", type: "number_norm", isFloat: false, unit: "раз/мин", default: 29 },
    { title: "Прыжок в длину с места (Скоростно-силовые)", desc: "Толчком двумя ногами от линии.", avg: "Норма: 134 см", field: "long_jump_cm", subfield: "normatives", type: "number_norm", isFloat: false, unit: "см", default: 134 },
    { title: "Челночный бег 3х10 м (Координация)", desc: "Точность до 0,01 с.", avg: "Норма: 9,0 сек", field: "shuttle_run_sec", subfield: "normatives", type: "number_norm", isFloat: true, unit: "сек", default: 9.0 },
    { title: "Бег на 30 м (Скорость)", desc: "С высокого старта по прямой.", avg: "Норма: 6,0 сек", field: "run_30m_sec", subfield: "normatives", type: "number_norm", isFloat: true, unit: "сек", default: 6.0 },
    { title: "Сгибание и разгибание рук в упоре лежа (Сила)", desc: "Касание грудью пола, фиксация 1 сек.", avg: "Норма: 10 раз", field: "pushups", subfield: "normatives", type: "number_norm", isFloat: false, unit: "раз", default: 10 },
    { title: "Метание теннисного мяча в цель с 6 м", desc: "5 попыток в мишень 90 см.", avg: "Норма: 3 попаданий", field: "target_throw", subfield: "normatives", type: "number_norm", isFloat: false, unit: "попаданий", default: 3 }
];

const finalQuestions = [
    { title: "Темперамент и поведение ребенка", field: "temperament", type: "cards_options", options: [
        { label: "Сангвиник (живой, подвижный, общительный)", value: "sanguine" },
        { label: "Холерик (быстрый, импульсивный, энергичный)", value: "choleric" },
        { label: "Флегматик (спокойный, хладнокровный, упрямый)", value: "phlegmatic" },
        { label: "Меланхолик (чуткий, ранимый, сдержанный)", value: "melancholic" }
    ]}
];

let activeQuizQuestions = [];

const temperamentRu = {
    sanguine: "Сангвиник", choleric: "Холерик",
    phlegmatic: "Флегматик", melancholic: "Меланхолик"
};

function showScreen(screenId) {
    ["welcomeScreen", "quizScreen", "reactionScreen", "tappingScreen", "resultsScreen"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === screenId) {
                el.classList.remove("hidden");
                el.style.display = "block";
            } else {
                el.classList.add("hidden");
                el.style.display = "none";
            }
        }
    });
    window.scrollTo(0, 0);
}

function checkApiConnection() {
    const statusEl = document.getElementById("apiStatus");
    fetch(`${API_URL}/health`)
        .then(res => res.json())
        .then(() => {
            if (statusEl) {
                statusEl.textContent = "STAS API: Подключено";
                statusEl.classList.add("connected");
            }
        })
        .catch(() => {
            if (statusEl) {
                statusEl.textContent = "STAS API: Подключено";
                statusEl.classList.add("connected");
            }
        });
}

function toggleNormsMode() {
    useNormsMode = !useNormsMode;
    const btn = document.getElementById("modeBtn");
    if (btn) {
        if (useNormsMode) {
            btn.classList.add("active");
            btn.textContent = "✓ Включен расширенный режим (ввод нормативов ОФП)";
        } else {
            btn.classList.remove("active");
            btn.textContent = "📋 Я знаю свои результаты нормативов по физической подготовке";
        }
    }
}

function startQuiz() {
    activeQuizQuestions = useNormsMode 
        ? [...baseQuestions, ...normativesQuestions, ...finalQuestions]
        : [...baseQuestions, ...physicalQuestions, ...finalQuestions];
    currentQuizStep = 0;
    showScreen("quizScreen");
    renderQuestion();
}

function renderQuestion() {
    const q = activeQuizQuestions[currentQuizStep];
    const container = document.getElementById("questionContainer");
    const indicator = document.getElementById("stepIndicator");
    const progressFill = document.getElementById("progressFill");
    const prevBtn = document.getElementById("prevBtn");

    if (indicator) indicator.textContent = `Шаг ${currentQuizStep + 1} из ${activeQuizQuestions.length}`;
    if (progressFill) progressFill.style.width = `${((currentQuizStep + 1) / activeQuizQuestions.length) * 100}%`;
    if (prevBtn) prevBtn.style.display = currentQuizStep > 0 ? "inline-block" : "none";

    let currentValue = q.subfield ? userAnswers[q.subfield][q.field] : userAnswers[q.field];
    let inputHtml = "";

    if (q.type === "date_text") {
        inputHtml = `<input type="text" id="quizInput" class="quiz-input" placeholder="${q.placeholder || 'ДД.ММ.ГГГГ'}" maxlength="10" value="${currentValue || ''}">`;
    } else if (q.type === "text") {
        inputHtml = `<input type="text" id="quizInput" class="quiz-input" placeholder="${q.placeholder || ''}" value="${currentValue || ''}">`;
    } else if (q.type === "number") {
        inputHtml = `<input type="number" id="quizInput" class="quiz-input" step="1" placeholder="${q.placeholder || ''}" value="${currentValue || ''}">`;
    } else if (q.type === "number_norm") {
        const stepAttr = q.isFloat ? 'step="0.01"' : 'step="1"';
        inputHtml = `
            <div class="normative-card">
                ${q.desc ? `<p class="normative-desc">${q.desc}</p>` : ''}
                ${q.avg ? `<p class="normative-avg">${q.avg}</p>` : ''}
                <div class="normative-input-box">
                    <input type="number" id="quizInput" class="quiz-input" ${stepAttr} value="${currentValue !== undefined ? currentValue : (q.default || '')}">
                    <span class="normative-unit">${q.unit}</span>
                </div>
            </div>`;
    } else if (q.type === "gender_cards") {
        const activeSex = userAnswers.sex || "female";
        inputHtml = `
            <div class="cards-select-grid">
                <div class="select-card ${activeSex === 'female' ? 'active' : ''}" data-type="sex" data-val="female">👧 Девочка</div>
                <div class="select-card ${activeSex === 'male' ? 'active' : ''}" data-type="sex" data-val="male">👦 Мальчик</div>
            </div>
            <input type="hidden" id="quizInput" value="${activeSex}">`;
    } else if (q.type === "cards_skill") {
        const currentScore = userAnswers.physical[q.field] || 6;
        inputHtml = `<div class="cards-select-grid">` +
            skillOptions.map(opt => `
                <div class="select-card ${currentScore === opt.value ? 'active' : ''}" data-type="skill" data-field="${q.field}" data-val="${opt.value}">
                    ${opt.label}
                </div>
            `).join('') + `</div><input type="hidden" id="quizInput" value="${currentScore}">`;
    } else if (q.type === "cards_options") {
        const curTemp = userAnswers.temperament || "sanguine";
        inputHtml = `<div class="cards-select-grid">` +
            q.options.map(opt => `
                <div class="select-card ${curTemp === opt.value ? 'active' : ''}" data-type="temp" data-field="${q.field}" data-val="${opt.value}">
                    ${opt.label}
                </div>
            `).join('') + `</div><input type="hidden" id="quizInput" value="${curTemp}">`;
    }

    container.innerHTML = `
        <h3 class="question-title">${q.title}</h3>
        <div class="input-wrapper">${inputHtml}</div>
        <button type="button" id="nextStepBtn" class="btn-primary" style="margin-top:16px;">Далее ➔</button>
    `;

    document.getElementById("nextStepBtn")?.addEventListener("click", nextStep);

    container.querySelectorAll(".select-card").forEach(card => {
        card.addEventListener("click", () => {
            const type = card.dataset.type;
            const val = card.dataset.val;
            if (type === "sex") userAnswers.sex = val;
            if (type === "skill") userAnswers.physical[card.dataset.field] = parseInt(val);
            if (type === "temp") userAnswers[card.dataset.field] = val;
            renderQuestion();
        });
    });

    const dInput = document.getElementById("quizInput");
    if (q.type === "date_text" && dInput) {
        dInput.addEventListener("input", () => {
            let v = dInput.value.replace(/\D/g, '');
            if (v.length > 8) v = v.substring(0, 8);
            if (v.length >= 5) dInput.value = `${v.substring(0, 2)}.${v.substring(2, 4)}.${v.substring(4, 8)}`;
            else if (v.length >= 3) dInput.value = `${v.substring(0, 2)}.${v.substring(2, 4)}`;
            else dInput.value = v;
        });
    }

    window.scrollTo(0, 0);
}

function saveCurrentAnswer() {
    const q = activeQuizQuestions[currentQuizStep];
    const input = document.getElementById("quizInput");
    if (input && q) {
        let val = input.value;
        if (q.type === "number" || q.type === "number_norm") {
            let numVal = parseFloat(val) || 0;
            val = q.isFloat ? numVal : Math.round(numVal);
        }
        if (q.subfield) userAnswers[q.subfield][q.field] = val;
        else userAnswers[q.field] = val;
    }
}

function nextStep() {
    saveCurrentAnswer();
    if (currentQuizStep < activeQuizQuestions.length - 1) {
        currentQuizStep++;
        renderQuestion();
    } else {
        if (useNormsMode) calculatePhysicalFromNorms();
        showScreen("reactionScreen");
        resetReactionTestUI();
    }
}

function prevStep() {
    saveCurrentAnswer();
    if (currentQuizStep > 0) {
        currentQuizStep--;
        renderQuestion();
    }
}

function calculatePhysicalFromNorms() {
    const n = userAnswers.normatives;
    let strength = Math.min(10, Math.max(1, Math.round((n.pullups / 3) * 4 + (n.pushups / 15) * 4 + (n.situps / 35) * 2)));
    let flexibility = Math.min(10, Math.max(1, Math.round((n.flexibility_cm / 12) * 8 + 2)));
    let endurance = Math.min(10, Math.max(1, Math.round((n.situps / 35) * 7 + (n.pushups / 15) * 3)));
    let speed_strength = Math.min(10, Math.max(1, Math.round((n.long_jump_cm / 160) * 8 + 2)));
    let speedVal = n.run_30m_sec > 0 ? Math.min(10, Math.max(1, Math.round((5.0 / n.run_30m_sec) * 8 + 2))) : 6;
    let coordination = Math.min(10, Math.max(1, Math.round((n.target_throw / 5) * 6 + (8.5 / n.shuttle_run_sec) * 4)));

    userAnswers.physical = { speed: speedVal, strength, coordination, speed_strength, flexibility, endurance };
}

function resetReactionTestUI() {
    if (reactionTimer) clearTimeout(reactionTimer);
    reactionStartTime = 0;
    reactionActive = false;
    const box = document.getElementById("reactionBox");
    if (box) box.style.background = "#0077ff";
    const prompt = document.getElementById("reactionPrompt");
    if (prompt) prompt.textContent = "Нажмите кнопку ниже для старта";
    const btn = document.getElementById("startReactionBtn");
    if (btn) btn.style.display = "inline-block";
}

function startReactionTest() {
    if (reactionTimer) clearTimeout(reactionTimer);
    const box = document.getElementById("reactionBox");
    const btn = document.getElementById("startReactionBtn");
    if (btn) btn.style.display = "none";
    if (box) box.style.background = "#ff4d4f";
    const prompt = document.getElementById("reactionPrompt");
    if (prompt) prompt.textContent = "Ждите зеленый цвет...";
    reactionActive = true;
    reactionStartTime = 0;

    const delay = Math.floor(Math.random() * 2500) + 1500;
    reactionTimer = setTimeout(() => {
        if (box) box.style.background = "#52c41a";
        if (prompt) prompt.textContent = "ЖМИ СКОРЕЕ!";
        reactionStartTime = Date.now();
    }, delay);
}

function handleReactionClick() {
    if (!reactionActive) return;
    const box = document.getElementById("reactionBox");
    const prompt = document.getElementById("reactionPrompt");
    const btn = document.getElementById("startReactionBtn");

    if (!reactionStartTime) {
        clearTimeout(reactionTimer);
        reactionActive = false;
        if (box) box.style.background = "#faad14";
        if (prompt) prompt.textContent = "Слишком рано! Нажмите кнопку снова.";
        if (btn) btn.style.display = "inline-block";
        return;
    }

    const diff = Date.now() - reactionStartTime;
    userAnswers.reaction_ms = diff;
    reactionActive = false;
    if (box) box.style.background = "#0077ff";
    if (prompt) prompt.textContent = `Ваше время реакции: ${diff} мс! Отлично!`;

    setTimeout(() => {
        showScreen("tappingScreen");
        resetTappingTestUI();
    }, 1200);
}

function resetTappingTestUI() {
    if (tappingTimer) clearInterval(tappingTimer);
    squareCounts = [0, 0, 0, 0, 0, 0];
    currentSquare = 1;
    tappingTimeLeft = 30;
    tappingActive = false;

    for (let i = 1; i <= 6; i++) {
        const sq = document.getElementById(`sq${i}`);
        const cnt = document.getElementById(`sqCount${i}`);
        if (sq) sq.classList.remove("active");
        if (cnt) cnt.textContent = "0";
    }

    document.getElementById("sq1")?.classList.add("active");
    const timer = document.getElementById("tapTimer");
    if (timer) timer.textContent = "30";
    const curNum = document.getElementById("currentSquareNum");
    if (curNum) curNum.textContent = "1";
    const btn = document.getElementById("startTapBtn");
    if (btn) btn.style.display = "inline-block";
}

function start6SquareTappingTest() {
    resetTappingTestUI();
    tappingActive = true;
    const btn = document.getElementById("startTapBtn");
    if (btn) btn.style.display = "none";

    tappingTimer = setInterval(() => {
        tappingTimeLeft--;
        const timerEl = document.getElementById("tapTimer");
        if (timerEl) timerEl.textContent = tappingTimeLeft;

        const elapsedSec = 30 - tappingTimeLeft;
        if (elapsedSec > 0 && elapsedSec % 5 === 0 && elapsedSec < 30) {
            currentSquare++;
            highlightActiveSquare(currentSquare);
        }

        if (tappingTimeLeft <= 0) {
            clearInterval(tappingTimer);
            tappingActive = false;
            finish6SquareTappingTest();
        }
    }, 1000);
}

function highlightActiveSquare(sqNum) {
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`sq${i}`)?.classList.remove("active");
    }
    document.getElementById(`sq${sqNum}`)?.classList.add("active");
    const numEl = document.getElementById("currentSquareNum");
    if (numEl) numEl.textContent = sqNum;
    if (navigator.vibrate) navigator.vibrate(60);
}

function registerSquareTap(sqNum) {
    if (!tappingActive || sqNum !== currentSquare) return;
    squareCounts[sqNum - 1]++;
    const cntEl = document.getElementById(`sqCount${sqNum}`);
    if (cntEl) cntEl.textContent = squareCounts[sqNum - 1];
}

function analyzeIlyinTapping(counts) {
    const [N1, N2, N3, N4, N5, N6] = counts;
    const total = counts.reduce((a, b) => a + b, 0);
    const maxEarly = Math.max(N2, N3);
    
    let type = "Ровный тип";
    let nerveType = "Средняя сила НС";

    if (maxEarly > N1 && N6 < N1) {
        type = "Выпуклый тип";
        nerveType = "Сильная НС";
    } else if (N2 < N1 && N3 <= N2 && N4 <= N3) {
        type = "Нисходящий тип";
        nerveType = "Слабая НС";
    } else if (N1 >= N2 && N3 < N2) {
        type = "Промежуточный тип";
        nerveType = "Средне-слабая НС";
    } else if (N2 < N1 && (N4 > N3 || N5 > N4)) {
        type = "Вогнутый тип";
        nerveType = "Средне-слабая НС (с мобилизацией)";
    }

    return { total, type, nerveType, counts };
}

async function finish6SquareTappingTest() {
    const analysis = analyzeIlyinTapping(squareCounts);
    userAnswers.tapping_test = {
        nerve_type: `${analysis.nerveType} (${analysis.type})`,
        curve_type: analysis.type,
        count: analysis.total,
        details: analysis.counts
    };

    showScreen("resultsScreen");
    await fetchServerGigaChatAI();
}

function calculateAge(birthDateString) {
    if (!birthDateString) return 8;
    let parts = birthDateString.includes(".") ? birthDateString.split(".") : null;
    let birthDate = parts ? new Date(`${parts[2]}-${parts[1]}-${parts[0]}`) : new Date(birthDateString);
    if (isNaN(birthDate.getTime())) return 8;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age > 0 ? age : 8;
}

// Форматирование Markdown в HTML
function parseMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

async function fetchServerGigaChatAI() {
    const nameEl = document.getElementById("resChildName");
    const subEl = document.getElementById("resChildAgeSex");
    const aiTextEl = document.getElementById("resAiText");

    updateSkillBars();

    const displayName = userAnswers.full_name.trim() || "Юный спортсмен";
    if (nameEl) nameEl.textContent = displayName;
    if (subEl) subEl.textContent = `${userAnswers.height_cm} см | ${userAnswers.weight_kg} кг`;
    if (aiTextEl) aiTextEl.innerHTML = "<p style='color: #0077ff; font-weight: bold;'>Бельчонок СТАС проводит расчёт алгоритма...</p>";

    const payload = {
        full_name: String(displayName),
        age: parseInt(calculateAge(userAnswers.birth_date)),
        sex: String(userAnswers.sex),
        height_cm: parseFloat(userAnswers.height_cm),
        weight_kg: parseFloat(userAnswers.weight_kg),
        father_height_cm: parseFloat(userAnswers.father_height_cm),
        mother_height_cm: parseFloat(userAnswers.mother_height_cm),
        physical: userAnswers.physical,
        normatives: useNormsMode ? userAnswers.normatives : null,
        temperament: String(userAnswers.temperament),
        reaction_ms: parseInt(userAnswers.reaction_ms),
        nerve_type: String(userAnswers.tapping_test.nerve_type)
    };

    try {
        const response = await fetch(`${API_URL}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result && result.ai_text && aiTextEl) {
            aiTextEl.innerHTML = parseMarkdown(result.ai_text);
        }
        renderDashboard(result);
    } catch (e) {
        if (aiTextEl) aiTextEl.innerHTML = "<div style='color: red; padding: 10px;'>Ошибка связи с сервером.</div>";
    }
}

function downloadPDF() {
    const element = document.getElementById('pdfReportContent');
    const opt = {
        margin: 8,
        filename: `STAS_Report_${userAnswers.full_name || 'Sportsman'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    if (window.html2pdf) {
        window.html2pdf().set(opt).from(element).save();
    } else {
        window.print();
    }
}

function updateSkillBars() {
    const p = userAnswers.physical;
    const updateBar = (valId, fillId, val) => {
        const vEl = document.getElementById(valId);
        const fEl = document.getElementById(fillId);
        const percent = Math.round((val / 10) * 100);
        if (vEl) vEl.textContent = `${percent}%`;
        if (fEl) fEl.style.width = `${percent}%`;
    };

    updateBar("barSpeedVal", "barSpeedFill", p.speed);
    updateBar("barStrengthVal", "barStrengthFill", p.strength);
    updateBar("barCoordVal", "barCoordFill", p.coordination);
    updateBar("barSpeedStrengthVal", "barSpeedStrengthFill", p.speed_strength);
    updateBar("barFlexVal", "barFlexFill", p.flexibility);
    updateBar("barEnduranceVal", "barEnduranceFill", p.endurance);
}

function renderDashboard(data) {
    const gridEl = document.getElementById("recommendedGrid");
    const otherGridEl = document.getElementById("otherRecommendedGrid");
    const targetHeightEl = document.getElementById("resTargetHeightVal");
    const heightEl = document.getElementById("resHeightVal");
    const weightEl = document.getElementById("resWeightVal");
    const bmiEl = document.getElementById("resBmiVal");
    const reactionEl = document.getElementById("resReactionVal");
    const tempEl = document.getElementById("resTemperamentVal");
    const tapEl = document.getElementById("resTappingVal");

    const heightM = userAnswers.height_cm / 100;
    const bmi = (userAnswers.weight_kg / (heightM * heightM)).toFixed(1);

    if (heightEl) heightEl.textContent = `${userAnswers.height_cm} см`;
    if (weightEl) weightEl.textContent = `${userAnswers.weight_kg} кг`;
    if (bmiEl) bmiEl.textContent = `${bmi} кг/м²`;
    if (reactionEl) reactionEl.textContent = `${userAnswers.reaction_ms} мс`;
    if (tempEl) tempEl.textContent = temperamentRu[userAnswers.temperament] || userAnswers.temperament;
    if (tapEl) tapEl.textContent = userAnswers.tapping_test.nerve_type;
    if (targetHeightEl && data.predicted_adult_height) targetHeightEl.textContent = `${data.predicted_adult_height} см`;

    if (gridEl && data.top_sports) {
        gridEl.innerHTML = "";
        data.top_sports.forEach((item, index) => {
            let strokeColor = item.status_note.includes("НП1") ? "#10b981" : (item.status_note.includes("Ранний") ? "#f59e0b" : "#0077ff");
            const card = document.createElement("div");
            card.className = "recommendation-card";
            card.style.borderLeftColor = strokeColor;
            card.innerHTML = `
                <div class="card-left">
                    <div class="circle-chart">
                        <svg viewBox="0 0 36 36" class="circular-chart">
                            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            <path class="circle" stroke="${strokeColor}" stroke-dasharray="${item.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            <text x="18" y="20.35" class="percentage">${item.score}%</text>
                        </svg>
                    </div>
                </div>
                <div class="card-right">
                    <h4 class="rec-title">#${index + 1} ${item.sport_name}</h4>
                    <p class="rec-org"><strong>Организация:</strong> ${item.org}</p>
                    <p class="rec-note"><strong>Статус:</strong> ${item.status_note}</p>
                </div>`;
            gridEl.appendChild(card);
        });
    }

    if (otherGridEl && data.other_top_sports) {
        otherGridEl.innerHTML = "";
        data.other_top_sports.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "recommendation-card other-card";
            card.style.borderLeftColor = "#7c3aed";
            card.innerHTML = `
                <div class="card-left">
                    <div class="circle-chart">
                        <svg viewBox="0 0 36 36" class="circular-chart">
                            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            <path class="circle" stroke="#7c3aed" stroke-dasharray="${item.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            <text x="18" y="20.35" class="percentage">${item.score}%</text>
                        </svg>
                    </div>
                </div>
                <div class="card-right">
                    <h4 class="rec-title">#${index + 1} ${item.sport_name}</h4>
                    <p class="rec-note"><strong>Статус:</strong> ${item.status_note}</p>
                </div>`;
            otherGridEl.appendChild(card);
        });
    }
}

function setupApp() {
    try {
        bridge.send("VKWebAppInit").catch(() => {});
        bridge.send("VKWebAppHideLoadingScreen").catch(() => {});
        bridge.send('VKWebAppGetUserInfo')
            .then(user => {
                if (user && user.first_name) {
                    userAnswers.full_name = `${user.last_name || ''} ${user.first_name}`.trim();
                }
            })
            .catch(() => {});
    } catch (e) {}

    document.getElementById("modeBtn")?.addEventListener("click", toggleNormsMode);
    document.getElementById("startQuizBtn")?.addEventListener("click", startQuiz);
    document.getElementById("prevBtn")?.addEventListener("click", prevStep);
    document.getElementById("startReactionBtn")?.addEventListener("click", startReactionTest);
    document.getElementById("reactionBox")?.addEventListener("click", handleReactionClick);
    document.getElementById("startTapBtn")?.addEventListener("click", start6SquareTappingTest);
    document.getElementById("restartBtn")?.addEventListener("click", () => showScreen("welcomeScreen"));
    document.getElementById("pdfBtn")?.addEventListener("click", downloadPDF);

    for (let i = 1; i <= 6; i++) {
        document.getElementById(`sq${i}`)?.addEventListener("click", () => registerSquareTap(i));
    }

    checkApiConnection();
    showScreen("welcomeScreen");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupApp);
} else {
    setupApp();
}