// ===== 기업분석 프롬프트 조립기 =====
// 이 파일은 브라우저 안에서만 움직여요. 입력한 내용은 어디로도 전송되지 않아요.

// ----- 1. 프롬프트 틀 (바꾸고 싶은 문장은 여기서 고쳐요) -----
// {company}=기업명, {job}=지원직무, {industry}=산업, {competitors}=경쟁사
// needsCompetitor: true 이면 경쟁사를 입력했을 때만 보여줘요.
const SECTIONS = [
  {
    number: 1,
    title: "기업정보파악 및 핵심 사업분석",
    prompts: [
      { text: "{company}의 기업 개요를 취업준비생이 이해하도록 정리하고, 주요사업, 제품 및 서비스, 주요 고객, 기업 규모를 표로 정리해줘." },
      { text: "{company}의 주요 사업별 특징과 수익구조를 설명하고, 향후 성장 가능성이 높은 사업을 분석해줘." }
    ]
  },
  {
    number: 2,
    title: "산업분석",
    prompts: [
      { text: "{industry}의 규모, 성장률과 시장 트렌드를 포함한 주요 기술 변화와 정부 정책 규제를 알려주고, {industry}의 기회와 위협을 분석해줘." }
    ]
  },
  {
    number: 3,
    title: "채용관점에서 기업분석 및 경쟁사 분석",
    prompts: [
      { text: "{company}의 최근 사업전략을 분석하고, 이 전략이 채용과 직무에 어떤 영향을 미칠지 분석해줘. 특히 {job}에서 중요하게 요구될 역량 5가지를 제시해줘." },
      { text: "{company:과/와} 주요 경쟁사 3곳{competitorHint}을 사업, 제품, 시장점유율, 기술력, 경쟁우위 측면에서 비교해줘." }
    ]
  },
  {
    number: 4,
    title: "SWOT분석",
    prompts: [
      {
        text: "앞에서 분석한 내용을 바탕으로 {company}의 SWOT 분석을 작성해줘. 단순 나열하지 말고 각 항목에 대한 근거도 함께 제시해줘.\n" +
              "- Strength(강점): 기술력, 브랜드, 시장점유율, 핵심인재 등\n" +
              "- Weakness(약점): 비용구조, 특정사업 의존도, 기술적 한계 등\n" +
              "- Opportunity(기회): 시장성장, 새로운 기술, 해외시장 확대 등\n" +
              "- Threat(위협): 경쟁사, 규제, 경기침체, 기술변화 등"
      }
    ]
  },
  {
    number: 5,
    title: "결론",
    prompts: [
      { text: "{company}의 비전과 경영철학에 대해 알려줘." },
      { text: "{company}의 장점과 단점에 대해 알려줘." },
      { text: "{company}의 인재상에 대해 알려줘." },
      { text: "{company}의 차별화된 강점과 발전을 위해 개선해야 할 점을 알려줘." },
      { text: "{company}의 최신 이슈에 대해 알려줘." },
      { text: "{company}의 최근 출시 상품 및 서비스에 대해 알려줘." },
      { text: "{company:이/가} {competitors:과/와} 차별화되는 포인트를 알려줘.", needsCompetitor: true }
    ]
  }
];

// ----- 3. 화면 요소 찾기 -----
const urlInput = document.getElementById("urlInput");
const companyInput = document.getElementById("companyInput");
const jobInput = document.getElementById("jobInput");
const industryInput = document.getElementById("industryInput");
const competitorInput = document.getElementById("competitorInput");
const pasteInput = document.getElementById("pasteInput");
const buildBtn = document.getElementById("buildBtn");
const exampleBtn = document.getElementById("exampleBtn");
const copyAllBtn = document.getElementById("copyAllBtn");
const resultCard = document.getElementById("resultCard");
const resultArea = document.getElementById("resultArea");
const warning = document.getElementById("warning");

// 지금 화면에 나온 프롬프트 글을 모아 두는 곳 ("전체 복사"에서 써요)
let currentTexts = [];

// ----- 4. 작은 함수들 -----

// 체크된 항목 번호를 숫자 목록으로 돌려줘요 (예: [1, 3, 5])
function getSelectedNumbers() {
  const checked = document.querySelectorAll('input[name="section"]:checked');
  return Array.from(checked).map(function (box) {
    return Number(box.value);
  });
}

// 입력값을 읽어서 한 덩어리로 돌려줘요 (앞뒤 공백은 지워요)
function readInputs() {
  return {
    url: urlInput.value.trim(),
    company: companyInput.value.trim(),
    job: jobInput.value.trim(),
    industry: industryInput.value.trim(),
    competitors: competitorInput.value.trim(),
    pasted: pasteInput.value.trim()
  };
}

// 단어 끝 글자에 받침이 있으면 첫째 조사, 없으면 둘째 조사를 붙여요. (예: 가나다전자 + 과/와 → 가나다전자와)
// 한글이 아닌 글자로 끝나면 읽는 법을 알 수 없어서 "과(와)"처럼 둘 다 적어요.
function attachParticle(word, withBatchim, withoutBatchim) {
  const code = word.charCodeAt(word.length - 1);
  const isHangul = code >= 0xAC00 && code <= 0xD7A3;
  if (!isHangul) return word + withBatchim + "(" + withoutBatchim + ")";
  const hasBatchim = (code - 0xAC00) % 28 !== 0;
  return word + (hasBatchim ? withBatchim : withoutBatchim);
}

// 틀 속의 {company} 같은 칸을 입력값으로 바꿔요. 비어 있으면 [기업명] 같은 표시를 남겨요.
function fillTemplate(template, values) {
  const words = {
    company: values.company || "[기업명]",
    job: values.job || "[지원직무]",
    industry: values.industry || "[산업]",
    competitors: values.competitors || "[경쟁사]"
  };
  const hint = values.competitors ? "(참고: " + values.competitors + ")" : "";

  // 1) {company:과/와} 처럼 조사가 붙은 칸을 먼저 바꿔요
  let result = template.replace(/\{(\w+):([^/}]+)\/([^}]+)\}/g, function (all, key, first, second) {
    return attachParticle(words[key], first, second);
  });

  // 2) 나머지 일반 칸을 바꿔요
  result = result
    .split("{company}").join(words.company)
    .split("{job}").join(words.job)
    .split("{industry}").join(words.industry)
    .split("{competitors}").join(words.competitors)
    .split("{competitorHint}").join(hint);
  return result;
}

// "먼저 보낼 자료" 프롬프트를 만들어요 (URL과 붙여넣은 내용이 들어가요)
function makeIntroText(values) {
  let text = (values.company || "[기업명]") + "에 대해 분석할 거야. 아래 자료를 참고해서 이어지는 질문에 답해줘.\n" +
             "참고 링크: " + values.url + "\n" +
             "링크를 열 수 없으면 추측하지 말고 \"링크를 열 수 없어요\"라고 먼저 알려줘.";
  if (values.pasted) {
    text += "\n\n[참고 내용]\n" + values.pasted;
  }
  return text;
}

// 체크한 번호의 프롬프트 목록을 만들어요. 돌려주는 모양: [{ title, text }, ...]
function buildPromptList(values, numbers) {
  const list = [];
  list.push({ title: "먼저 보낼 자료", text: makeIntroText(values) });

  SECTIONS.forEach(function (section) {
    if (!numbers.includes(section.number)) return;
    section.prompts.forEach(function (prompt, index) {
      if (prompt.needsCompetitor && !values.competitors) return;
      list.push({
        title: section.number + ". " + section.title + " (" + (index + 1) + ")",
        text: fillTemplate(prompt.text, values)
      });
    });
  });
  return list;
}

// 비어 있는 칸 중, 이번 결과에 필요한 칸을 찾아서 알려줄 문장을 만들어요
function makeWarning(values, numbers) {
  const missing = [];
  if (!values.job && numbers.includes(3)) missing.push("지원 직무");
  if (!values.industry && numbers.includes(2)) missing.push("산업");
  if (!values.competitors) missing.push("경쟁사(없으면 경쟁사 관련 프롬프트는 빠져요)");
  if (missing.length === 0) return "";
  return "비어 있는 칸: " + missing.join(", ") + ". 비워 두면 [ ] 표시가 그대로 남아요.";
}

// 글을 클립보드에 복사해요. 안 되면 옛날 방식으로 한 번 더 시도해요.
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(function () {
      return fallbackCopy(text);
    });
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  const temp = document.createElement("textarea");
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  try {
    document.execCommand("copy");
  } catch (e) {
    // 복사가 막힌 환경이면 아무것도 하지 않아요
  }
  document.body.removeChild(temp);
}

// 단추 글자를 잠깐 "복사됨!"으로 바꿨다가 원래대로 돌려요
function flashCopied(button) {
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  button.textContent = "복사됨!";
  button.classList.add("copied");
  setTimeout(function () {
    button.textContent = original;
    button.classList.remove("copied");
  }, 1500);
}

// ----- 5. 화면에 결과 그리기 -----
function renderResult(list) {
  resultArea.textContent = "";
  currentTexts = [];

  list.forEach(function (item) {
    currentTexts.push(item.title + "\n" + item.text);

    const box = document.createElement("div");
    box.className = "prompt-box";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const body = document.createElement("p");
    body.className = "prompt-text";
    body.textContent = item.text;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn copy-one";
    button.textContent = "복사";
    button.addEventListener("click", function () {
      copyText(item.text);
      flashCopied(button);
    });

    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(button);
    resultArea.appendChild(box);
  });
}

// ----- 6. 단추를 눌렀을 때 -----

// "프롬프트 만들기"
function onBuildClick() {
  const values = readInputs();
  const numbers = getSelectedNumbers();

  // 꼭 필요한 두 칸이 비어 있거나, 고른 항목이 하나도 없으면 멈추고 알려줘요
  if (!values.url || !values.company || numbers.length === 0) {
    resultCard.hidden = false;
    resultArea.textContent = "";
    currentTexts = [];
    warning.hidden = false;
    warning.textContent = numbers.length === 0
      ? "만들 항목을 하나 이상 골라 주세요."
      : "URL과 기업명은 꼭 입력해 주세요.";
    return;
  }

  renderResult(buildPromptList(values, numbers));
  const warningText = makeWarning(values, numbers);
  warning.hidden = warningText === "";
  warning.textContent = warningText;
  resultCard.hidden = false;
}

// "예시 채우기": 연습용 값을 칸에 넣어요
function onExampleClick() {
  urlInput.value = "https://example.com/recruit";
  companyInput.value = "가나다전자";
  jobInput.value = "재무회계";
  industryInput.value = "반도체 산업";
  competitorInput.value = "라마바전자, 사아자전자";
  pasteInput.value = "";
  document.querySelectorAll('input[name="section"]').forEach(function (box) {
    box.checked = true;
  });
}

// "전체 복사": 지금 나온 프롬프트를 전부 이어서 복사해요
function onCopyAllClick() {
  copyText(currentTexts.join("\n\n----------\n\n"));
  flashCopied(copyAllBtn);
}

// ----- 7. 시작할 때 연결하기 -----
buildBtn.addEventListener("click", onBuildClick);
exampleBtn.addEventListener("click", onExampleClick);
copyAllBtn.addEventListener("click", onCopyAllClick);
