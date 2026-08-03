import { showModal } from '../ui/index.js';
import type { LanguageCode } from '../storage/index.js';

export interface AstronomyAnswer {
  topic: string;
  answer: string;
  followUp: string;
}

interface AdvisorTopic {
  keywords: string[];
  topic: Record<LanguageCode, string>;
  answer: Record<LanguageCode, string>;
  followUp: Record<LanguageCode, string>;
}

const TOPICS: AdvisorTopic[] = [
  {
    keywords: ['太阳系', '行星', 'solar system', 'planet'],
    topic: { 'zh-CN': '太阳系', en: 'The Solar System' },
    answer: {
      'zh-CN': '太阳系的中心是太阳，八大行星和许多小天体都在太阳引力的作用下运行。地球是离太阳第三近的行星。',
      en: 'The Sun is at the center of our solar system. Eight planets and many smaller bodies travel around it because of gravity. Earth is the third planet from the Sun.',
    },
    followUp: { 'zh-CN': '你还可以问我“哪颗行星最大？”', en: 'You can also ask “Which planet is the biggest?”' },
  },
  {
    keywords: ['太阳', '恒星', 'sun', 'star'],
    topic: { 'zh-CN': '太阳', en: 'The Sun' },
    answer: {
      'zh-CN': '太阳是一颗会自己发光发热的恒星。它的引力很强，正是这股力量让行星沿着轨道运行。',
      en: 'The Sun is a star that makes its own light and heat. Its strong gravity keeps the planets moving along their orbits.',
    },
    followUp: { 'zh-CN': '太阳风就是从太阳吹出的带电粒子流。', en: 'Solar wind is a stream of charged particles blowing out from the Sun.' },
  },
  {
    keywords: ['地球', 'earth'],
    topic: { 'zh-CN': '地球', en: 'Earth' },
    answer: {
      'zh-CN': '地球会自转，也会绕太阳公转。地球上的水、大气和合适的温度，为生命提供了家园。',
      en: 'Earth spins on its axis and travels around the Sun. Water, an atmosphere, and a suitable temperature make it a home for life.',
    },
    followUp: { 'zh-CN': '地球磁场还像一把保护伞，能改变许多太阳风粒子的路线。', en: 'Earth’s magnetic field also acts like a shield and bends many solar-wind particles away.' },
  },
  {
    keywords: ['月球', '月亮', 'moon'],
    topic: { 'zh-CN': '月球', en: 'The Moon' },
    answer: {
      'zh-CN': '月球是地球的天然卫星。它不自己发光，我们看到的月光其实是太阳光照在月面后反射出来的光。',
      en: 'The Moon is Earth’s natural satellite. It does not make its own light; moonlight is sunlight reflected from its surface.',
    },
    followUp: { 'zh-CN': '当太阳、地球和月球排成一线时，就可能出现日食或月食。', en: 'When the Sun, Earth, and Moon line up, a solar or lunar eclipse may happen.' },
  },
  {
    keywords: ['日食', '月食', 'eclipse', 'solar eclipse', 'lunar eclipse'],
    topic: { 'zh-CN': '日食与月食', en: 'Eclipses' },
    answer: {
      'zh-CN': '日食时，月球挡在太阳和地球之间；月食时，地球挡在太阳和月球之间。阴影的位置决定了我们看到哪一种食。',
      en: 'During a solar eclipse, the Moon is between the Sun and Earth. During a lunar eclipse, Earth is between the Sun and Moon. The shadow tells us which one we see.',
    },
    followUp: { 'zh-CN': '点开“日食/月食”可以拖动时间轴观察阴影变化。', en: 'Open “Eclipses” to move the timeline and watch the shadows change.' },
  },
  {
    keywords: ['磁场', '磁极', 'magnetic field', 'magnetic'],
    topic: { 'zh-CN': '磁场', en: 'Magnetic fields' },
    answer: {
      'zh-CN': '地球磁场从南北磁极附近伸向太空，像一个看不见的保护罩。太阳也有磁场，而且会随着太阳自转不断变化。',
      en: 'Earth’s magnetic field stretches into space from regions near its magnetic poles like an invisible shield. The Sun has a magnetic field too, and it changes as the Sun spins.',
    },
    followUp: { 'zh-CN': '太阳风遇到地球磁场时，少量粒子沿磁力线进入极区，可能形成极光。', en: 'When solar wind meets Earth’s field, some particles follow field lines toward the poles and can make auroras.' },
  },
  {
    keywords: ['太阳风', '太阳雨', 'solar wind'],
    topic: { 'zh-CN': '太阳风', en: 'Solar wind' },
    answer: {
      'zh-CN': '太阳风是太阳向外释放的带电粒子流。它会随着太阳自转改变传播方向，遇到地球磁场后会被偏转或沿磁力线进入极区。',
      en: 'Solar wind is a flow of charged particles released by the Sun. The Sun’s spin changes its direction, and Earth’s magnetic field bends it or guides a few particles toward the poles.',
    },
    followUp: { 'zh-CN': '可以进入“太阳雨”实验室观察辐射、磁层屏障和极区互动。', en: 'Open “Solar Rain” to compare radiation, magnetic shielding, and polar interaction.' },
  },
  {
    keywords: ['哈雷', '彗星', 'halley', 'comet'],
    topic: { 'zh-CN': '哈雷彗星', en: 'Halley’s Comet' },
    answer: {
      'zh-CN': '哈雷彗星沿着很扁的椭圆轨道绕太阳运行。接近太阳时受到的热量更多，彗发变亮，背向太阳的彗尾也会变长。',
      en: 'Halley’s Comet follows a long, narrow orbit around the Sun. Near the Sun it receives more heat, brightens, and grows a longer tail pointing away from the Sun.',
    },
    followUp: { 'zh-CN': '进入“彗星”场景并调节速度，可以看到近日点和远日点的差别。', en: 'Open “Comet” and change the speed to compare perihelion and aphelion.' },
  },
  {
    keywords: ['银河系', '星系', 'galaxy', 'milky way'],
    topic: { 'zh-CN': '银河系', en: 'The Milky Way' },
    answer: {
      'zh-CN': '银河系是一个包含数千亿颗恒星的棒旋星系，太阳系只是其中很小的一部分。夜空中看到的银河，是银河系盘面上许多恒星的集合光。',
      en: 'The Milky Way is a barred spiral galaxy with hundreds of billions of stars. Our solar system is only a tiny part of it. The band in the night sky is light from many stars in its disk.',
    },
    followUp: { 'zh-CN': '“星系”比“太阳系”大得多，太阳系只是一个星系里的小家园。', en: 'A galaxy is much larger than a solar system: our solar system is one small home inside one galaxy.' },
  },
  {
    keywords: ['黑洞', 'black hole'],
    topic: { 'zh-CN': '黑洞', en: 'Black holes' },
    answer: {
      'zh-CN': '黑洞是引力强到连光也很难逃出的天体。我们通常通过它对周围恒星、气体和光的影响来发现它。',
      en: 'A black hole is an object whose gravity is so strong that even light cannot easily escape. We often find one by watching how it affects nearby stars, gas, and light.',
    },
    followUp: { 'zh-CN': '黑洞不是“宇宙吸尘器”，远处天体仍然可以绕着它运行。', en: 'A black hole is not a cosmic vacuum cleaner; distant objects can still orbit it.' },
  },
  {
    keywords: ['最大行星', '哪颗最大', 'biggest planet', 'largest planet'],
    topic: { 'zh-CN': '最大的行星', en: 'The biggest planet' },
    answer: {
      'zh-CN': '木星是太阳系最大的行星。它是一颗气态巨行星，表面没有像地球一样的坚硬地面。',
      en: 'Jupiter is the biggest planet in our solar system. It is a gas giant without a solid surface like Earth’s.',
    },
    followUp: { 'zh-CN': '木星的大红斑是一场持续很久的巨大风暴。', en: 'Jupiter’s Great Red Spot is a huge storm that has lasted for a very long time.' },
  },
];

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function answerAstronomyQuestion(
  question: string,
  language: LanguageCode = 'zh-CN',
): AstronomyAnswer {
  const normalized = normalize(question);
  const activeLanguage = language === 'en' ? 'en' : 'zh-CN';

  if (!normalized) {
    return {
      topic: activeLanguage === 'en' ? 'Try a question' : '试着问一个问题',
      answer: activeLanguage === 'en'
        ? 'Ask me about the Sun, planets, eclipses, magnetic fields, galaxies, or comets.'
        : '可以问我太阳、行星、日食、磁场、银河系或彗星的问题。',
      followUp: activeLanguage === 'en' ? 'For example: Why does a comet have a tail?' : '例如：“彗星为什么有彗尾？”',
    };
  }

  let bestTopic: AdvisorTopic | null = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    const score = topic.keywords.reduce(
      (total, keyword) => total + (normalized.includes(normalize(keyword)) ? keyword.length : 0),
      0,
    );
    // 当问题同时包含“太阳”和“彗星”等词时，后面的更具体专题优先。
    if (score > 0 && score >= bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  if (bestTopic) {
    return {
      topic: bestTopic.topic[activeLanguage],
      answer: bestTopic.answer[activeLanguage],
      followUp: bestTopic.followUp[activeLanguage],
    };
  }

  return {
    topic: activeLanguage === 'en' ? 'A good space question' : '一个很棒的天文问题',
    answer: activeLanguage === 'en'
      ? 'I do not have that fact in my small offline learning cards yet. Try asking about a planet, the Sun, the Moon, an eclipse, solar wind, a galaxy, or a comet.'
      : '这个问题还不在我的离线知识卡片里。可以换个方式问问行星、太阳、月球、日食、太阳风、银河系或彗星。',
    followUp: activeLanguage === 'en' ? 'Try: How does Earth’s magnetic field help us?' : '可以试试：“地球磁场怎样保护我们？”',
  };
}

function advisorStrings(language: LanguageCode): Record<string, string> {
  return language === 'en'
    ? {
        title: 'Astronomy AI Guide',
        intro: 'Ask a space question. The offline guide matches your words with child-friendly learning cards.',
        placeholder: 'For example: Why does a comet have a tail?',
        ask: 'Ask',
        suggestions: 'Try one',
        empty: 'Type a question first.',
        local: 'Offline learning guide',
      }
    : {
        title: 'AI 天文小顾问',
        intro: '问一个宇宙问题吧！离线小顾问会根据你的关键词匹配儿童友好的知识卡片。',
        placeholder: '例如：彗星为什么有彗尾？',
        ask: '提问',
        suggestions: '试着问',
        empty: '先输入一个问题吧。',
        local: '离线知识顾问',
      };
}

export function openAstronomyAdvisor(language: LanguageCode = 'zh-CN'): void {
  const copy = advisorStrings(language);
  const suggestions = language === 'en'
    ? ['Why is the sky blue?', 'What is a solar eclipse?', 'Which planet is biggest?']
    : ['为什么会有日食？', '地球磁场有什么用？', '哪颗行星最大？'];
  const modal = showModal(
    `🤖 ${copy.title}`,
    `<div class="advisor" data-advisor-root>
      <p class="advisor__intro">${copy.intro}</p>
      <span class="badge advisor__badge">${copy.local}</span>
      <div class="advisor__suggestions" aria-label="${copy.suggestions}">
        ${suggestions.map((item, index) => `<button type="button" class="btn btn--ghost advisor__suggestion" data-advisor-suggestion="${index}">${item}</button>`).join('')}
      </div>
      <form class="advisor__form" data-advisor-form>
        <label class="u-hidden" for="advisor-question">${copy.title}</label>
        <input id="advisor-question" class="advisor__input" data-advisor-input type="text" maxlength="120" placeholder="${copy.placeholder}" autocomplete="off">
        <button class="btn btn--accent" type="submit">${copy.ask}</button>
      </form>
      <section class="advisor__answer" data-advisor-answer aria-live="polite">
        <p class="advisor__answer-topic">${language === 'en' ? 'Ready when you are.' : '准备好回答你的问题啦。'}</p>
        <p>${language === 'en' ? 'Choose a question above or type your own.' : '点击上面的示例，或者输入你自己的问题。'}</p>
      </section>
    </div>`,
  );

  const root = modal.querySelector<HTMLElement>('[data-advisor-root]');
  const input = root?.querySelector<HTMLInputElement>('[data-advisor-input]');
  const answer = root?.querySelector<HTMLElement>('[data-advisor-answer]');
  const ask = (question: string): void => {
    const value = question.trim();
    if (!answer) return;
    if (!value) {
      answer.replaceChildren();
      const message = document.createElement('p');
      message.className = 'advisor__answer-error';
      message.textContent = copy.empty;
      answer.appendChild(message);
      input?.focus();
      return;
    }
    const result = answerAstronomyQuestion(value, language);
    answer.replaceChildren();
    const topic = document.createElement('p');
    topic.className = 'advisor__answer-topic';
    topic.textContent = `✨ ${result.topic}`;
    const explanation = document.createElement('p');
    explanation.textContent = result.answer;
    const followUp = document.createElement('p');
    followUp.className = 'advisor__answer-follow-up';
    followUp.textContent = result.followUp;
    answer.append(topic, explanation, followUp);
  };

  root?.querySelector<HTMLFormElement>('[data-advisor-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    ask(input?.value ?? '');
  });
  root?.querySelectorAll<HTMLButtonElement>('[data-advisor-suggestion]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.advisorSuggestion ?? 0);
      const question = suggestions[index] ?? suggestions[0];
      if (input) input.value = question;
      ask(question);
    });
  });
  input?.focus();
}
