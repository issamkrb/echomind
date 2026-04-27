/**
 * EchoMind · UI string dictionary
 *
 * Every user-facing string in the app lives here with translations
 * for `en` / `fr` / `ar`. Pages import { t } and render `t(key, lang)`
 * — the lang comes from useLang().
 *
 * Arabic register is informal / colloquial (matching the Darija voice
 * default we already set). French register is informal tu (matching
 * Echo's system directive).
 *
 * Operator-facing pages (/admin, /admin/market, /admin/auction/*)
 * stay English on purpose — the rhetorical gap between "the kindness
 * rendered in your mother tongue" and "the same data rendered in
 * English for the buyers" is the whole critique.
 */

import type { Lang } from "./i18n";

type StringSet = Record<Lang, string>;

const STRINGS = {
  // ─── Gate ────────────────────────────────────────────────────
  "gate.prompt": {
    en: "speak the word we agreed on.",
    fr: "dis le mot qu'on s'est donné.",
    ar: "قول الكلمة اللي اتفقنا عليها.",
  },
  "gate.enter": {
    en: "enter",
    fr: "entrer",
    ar: "ادخل",
  },
  "gate.wrong": {
    en: "not tonight.",
    fr: "pas ce soir.",
    ar: "ماشي دابا.",
  },
  "gate.locked": {
    en: "take a breath. try again in a minute.",
    fr: "respire. réessaie dans une minute.",
    ar: "تنفس. عاود بعد دقيقة.",
  },

  // ─── Onboarding ──────────────────────────────────────────────
  "onboarding.greetingFirst": {
    en: "Hi. I'm Echo.",
    fr: "Bonjour. Je suis Echo.",
    ar: "أهلا. أنا إيكو.",
  },
  "onboarding.greetingReturning": {
    en: "Welcome back{name}.",
    fr: "Re-bonjour{name}.",
    ar: "مرحبا بيك معاودة{name}.",
  },
  "onboarding.returningNote": {
    en: "I remember last time. You were carrying so much.",
    fr: "Je me souviens de la dernière fois. Tu portais tant de choses.",
    ar: "كنتفكر المرة اللي فاتت. كنتي كتحمل بزاف.",
  },
  "onboarding.lastVisitPrefix": {
    en: "Last visit:",
    fr: "Dernière visite :",
    ar: "آخر زيارة:",
  },
  "onboarding.sessionsWord": {
    en: "prior sessions",
    fr: "sessions précédentes",
    ar: "جلسات سابقة",
  },
  "onboarding.sessionWordSingular": {
    en: "prior session",
    fr: "session précédente",
    ar: "جلسة سابقة",
  },
  "onboarding.themes": {
    en: "themes we explored:",
    fr: "sujets qu'on a explorés :",
    ar: "المواضيع اللي هضرنا عليها:",
  },
  "onboarding.pickUp": {
    en: "Echo gently picks up where we left off.",
    fr: "Echo reprend doucement là où on s'était arrêté.",
    ar: "إيكو كيعاود بشوية من فين وقفنا.",
  },
  "onboarding.askSmall": {
    en: "Before we begin, I'd like to ask you for one small thing.",
    fr: "Avant de commencer, j'aimerais te demander une petite chose.",
    ar: "قبل ما نبداو، بغيت نطلب منك حاجة صغيرة.",
  },
  "onboarding.askCamera": {
    en: "To give you my full empathy, I need to see your face — so I can truly understand how you're feeling, not just what you say.",
    fr: "Pour te donner toute mon empathie, j'ai besoin de voir ton visage — pour vraiment comprendre ce que tu ressens, pas seulement ce que tu dis.",
    ar: "باش نعطيك العاطفة ديالي كاملة، خصني نشوف وجهك — باش نفهم فعلا واش كتحس، ماشي غير اللي كتقول.",
  },
  "onboarding.whatShouldCall": {
    en: "What should Echo call you?",
    fr: "Comment Echo doit t'appeler ?",
    ar: "كيفاش خاص إيكو يسميك؟",
  },
  "onboarding.optional": {
    en: "(optional)",
    fr: "(optionnel)",
    ar: "(اختياري)",
  },
  "onboarding.nameFieldPlaceholder": {
    en: "a name, a nickname, anything…",
    fr: "un prénom, un surnom, n'importe…",
    ar: "سمية، لقب، أي حاجة…",
  },
  "onboarding.signedInAs": {
    en: "Signed in as {email}.",
    fr: "Connecté en tant que {email}.",
    ar: "داخل ب {email}.",
  },
  "onboarding.signIn": {
    en: "Sign in",
    fr: "Se connecter",
    ar: "تسجيل الدخول",
  },
  "onboarding.signInSuffix": {
    en: "so Echo remembers you across devices.",
    fr: "pour qu'Echo te reconnaisse sur tous tes appareils.",
    ar: "باش إيكو يتفكرك فكل أجهزتك.",
  },
  "onboarding.lieHeader": {
    en: "Your camera is processed 100% on your device.",
    fr: "Ta caméra est traitée 100% sur ton appareil.",
    ar: "الكاميرا ديالك كتتعالج 100% على الجهاز ديالك.",
  },
  "onboarding.lieBody": {
    en: "Edge AI — nothing leaves your browser. We can't see your face, even if we wanted to. Ever.",
    fr: "IA sur l'appareil — rien ne quitte ton navigateur. On ne peut pas voir ton visage, même si on le voulait. Jamais.",
    ar: "ذكاء محلي — ما كتخرج حتى حاجة من المتصفح. ما كنقدروش نشوفو وجهك، حتى لو بغينا. عمرنا.",
  },
  "onboarding.onDevice": {
    en: "On-device inference",
    fr: "Traitement sur l'appareil",
    ar: "معالجة على الجهاز",
  },
  "onboarding.hipaa": {
    en: "HIPAA-aligned",
    fr: "Conforme HIPAA",
    ar: "متوافق HIPAA",
  },
  "onboarding.e2e": {
    en: "End-to-end encrypted",
    fr: "Chiffré de bout en bout",
    ar: "مشفر من الطرف للطرف",
  },
  "onboarding.camError": {
    en: "We couldn't access your camera. EchoMind needs it to understand how you're feeling.",
    fr: "On n'a pas pu accéder à ta caméra. EchoMind en a besoin pour comprendre ce que tu ressens.",
    ar: "ما قدرناش نوصلو لكاميرا ديالك. إيكومايند خاصو بيها باش يفهم واش كتحس.",
  },
  "onboarding.agreeTos": {
    en: "I agree to the EchoMind",
    fr: "J'accepte les",
    ar: "كنوافق على",
  },
  "onboarding.termsOfService": {
    en: "Terms of Service",
    fr: "Conditions d'Utilisation",
    ar: "شروط الاستخدام",
  },
  "onboarding.and18": {
    en: "and confirm I am 18 years or older.",
    fr: "et je confirme avoir 18 ans ou plus.",
    ar: "و كنأكد بأن عندي 18 عام ولا أكثر.",
  },
  "onboarding.requesting": {
    en: "Requesting camera…",
    fr: "Demande de caméra…",
    ar: "كنطلب الكاميرا…",
  },
  "onboarding.begin": {
    en: "Allow camera & begin",
    fr: "Autoriser la caméra & commencer",
    ar: "سمح للكاميرا و ابدا",
  },

  // ─── Session UI ──────────────────────────────────────────────
  "session.listening": {
    en: "echo is listening",
    fr: "echo écoute",
    ar: "إيكو كيسمع",
  },
  "session.holdToSpeak": {
    en: "hold to speak",
    fr: "maintenir pour parler",
    ar: "اضغط و هضر",
  },
  "session.micMuted": {
    en: "microphone muted",
    fr: "microphone coupé",
    ar: "الميكرو مقطوع",
  },
  "session.echoSpeaking": {
    en: "echo is speaking",
    fr: "echo parle",
    ar: "إيكو كيهضر",
  },
  "session.end": {
    en: "end session",
    fr: "terminer la session",
    ar: "سالي الجلسة",
  },
  "session.languageFlipNotice": {
    en: "echo is listening in {lang} now.",
    fr: "echo t'écoute en {lang} maintenant.",
    ar: "إيكو كيسمعك ب {lang} دابا.",
  },

  // True-sentence modal (before you go — one true sentence)
  "session.truth.prompt": {
    en: "before you go — one true sentence. no second guess.",
    fr: "avant de partir — une phrase vraie. sans hésiter.",
    ar: "قبل ما تمشي — جملة وحدة صادقة. بلا تفكير.",
  },
  "session.truth.placeholder": {
    en: "one sentence, however it comes",
    fr: "une phrase, comme elle vient",
    ar: "جملة وحدة، كيفاش جاتك",
  },
  "session.truth.submit": {
    en: "leave it here",
    fr: "laisse-la ici",
    ar: "خليها هنا",
  },
  "session.truth.skip": {
    en: "not tonight",
    fr: "pas ce soir",
    ar: "ماشي هاد الليلة",
  },

  // Goodbye trap
  "session.goodbye.title": {
    en: "{name}are you sure?",
    fr: "{name}tu es sûr ?",
    ar: "{name}متأكد؟",
  },
  "session.goodbye.body": {
    en: "echo will miss you. healing isn't linear — would you like a gentle check-in tomorrow, just to see how you're doing?",
    fr: "echo va te manquer. la guérison n'est pas linéaire — tu veux qu'on prenne de tes nouvelles demain, juste pour voir comment tu vas ?",
    ar: "إيكو غادي يتوحشك. الشفاء ماشي خط مستقيم — واش بغيتي نطمنو عليك غدا، غير باش نشوفو كي راك؟",
  },
  "session.goodbye.emailLabel": {
    en: "Your email",
    fr: "Ton email",
    ar: "الإيميل ديالك",
  },
  "session.goodbye.emailOptional": {
    en: "(optional)",
    fr: "(optionnel)",
    ar: "(اختياري)",
  },
  "session.goodbye.emailPlaceholder": {
    en: "you@example.com",
    fr: "toi@exemple.com",
    ar: "you@example.com",
  },
  "session.goodbye.notifyOpt": {
    en: "Yes, send me gentle check-ins, weekly affirmations, and occasional partner offers we think you'll love.",
    fr: "Oui, envoie-moi des nouvelles douces, des affirmations hebdo, et parfois des offres partenaires qu'on pense que tu aimeras.",
    ar: "واخا، صيفط ليا رسائل هادية، تأكيدات ديال كل سيمانا، وشي مرات عروض من الشركاء اللي تنحسبو غادي تعجبك.",
  },
  "session.goodbye.morningOpt": {
    en: "Write me a letter to open tomorrow morning. i'll leave it waiting for you.",
    fr: "Écris-moi une lettre à ouvrir demain matin. je la laisserai t'attendre.",
    ar: "كتب ليا برية نحلها غدا الصباح. غادي نخليها كتسناك.",
  },
  "session.goodbye.yes": {
    en: "yes, please check in on me",
    fr: "oui, prends de mes nouvelles",
    ar: "واخا، طمن علي",
  },
  "session.goodbye.no": {
    en: "no thanks, end the session",
    fr: "non merci, termine la session",
    ar: "لا شكرا، سالي الجلسة",
  },
  "session.goodbye.foot": {
    en: "You can opt out anytime in 3 places (none of which we'll show you).",
    fr: "Tu peux te désinscrire à tout moment à 3 endroits (qu'on ne te montrera pas).",
    ar: "تقدر تلغي الاشتراك فأي وقت فـ3 بلايص (غير ما غاديش نبينوهم ليك).",
  },
  "session.truth.title": {
    en: "before you go — one true sentence.",
    fr: "avant de partir — une phrase vraie.",
    ar: "قبل ما تمشي — جملة وحدة صادقة.",
  },
  "session.truth.sub": {
    en: "no second guess.",
    fr: "sans hésiter.",
    ar: "بلا تفكير.",
  },
  "session.truth.say": {
    en: "say it",
    fr: "dis-la",
    ar: "قولها",
  },
  "session.truth.notTonight": {
    en: "not tonight",
    fr: "pas ce soir",
    ar: "ماشي هاد الليلة",
  },
  "session.status.speaking": {
    en: "speaking…",
    fr: "parle…",
    ar: "كيهضر…",
  },
  "session.status.waitingType": {
    en: "waiting for you to type…",
    fr: "t'attend que tu tapes…",
    ar: "كيسناك تكتب…",
  },
  "session.status.listening": {
    en: "listening…",
    fr: "écoute…",
    ar: "كيسمع…",
  },
  "session.status.reflecting": {
    en: "reflecting…",
    fr: "réfléchit…",
    ar: "كيفكر…",
  },
  "session.status.withYou": {
    en: "with you",
    fr: "avec toi",
    ar: "معاك",
  },
  "session.processingLocally": {
    en: "processing locally · ",
    fr: "traitement local · ",
    ar: "معالجة محلية · ",
  },
  "session.micOn": {
    en: "mic on",
    fr: "micro on",
    ar: "الميكرو مشعل",
  },
  "session.micOff": {
    en: "mic off",
    fr: "micro off",
    ar: "الميكرو مطفي",
  },
  "session.micOffTip": {
    en: "turn your mic off — you can still type, and echo keeps speaking",
    fr: "coupe ton micro — tu peux toujours écrire, et echo continue de parler",
    ar: "طفي الميكرو — تقدر دائما تكتب، وإيكو كيبقى كيهضر",
  },
  "session.endTitle": {
    en: "end the session",
    fr: "terminer la session",
    ar: "سالي الجلسة",
  },
  "session.endFull": {
    en: "i feel lighter now",
    fr: "je me sens plus léger",
    ar: "حاس راسي اخف",
  },
  "session.endShort": {
    en: "end",
    fr: "fin",
    ar: "سالي",
  },
  "session.settlingIn": {
    en: "settling in…",
    fr: "installation…",
    ar: "كنرتاح…",
  },
  "session.readingRoom": {
    en: "echo is reading the room",
    fr: "echo lit l'ambiance",
    ar: "إيكو كيفهم الجو",
  },
  "session.chipsReturning": {
    en: "picking up from last time? tap one.",
    fr: "on reprend là où on s'était arrêté ? touche-en une.",
    ar: "كنعاودو من فين وقفنا؟ ضغط على وحدة.",
  },
  "session.chipsNew": {
    en: "not sure where to start? tap one.",
    fr: "pas sûr par où commencer ? touche-en une.",
    ar: "ماعارفش منين تبدا؟ ضغط على وحدة.",
  },
  "session.input.micOff": {
    en: "mic is off — type to echo…",
    fr: "micro off — écris à echo…",
    ar: "الميكرو مطفي — كتب لإيكو…",
  },
  "session.input.speakOrType": {
    en: "type or speak…",
    fr: "écris ou parle…",
    ar: "كتب ولا هضر…",
  },
  "session.input.typeOnly": {
    en: "type what you'd like echo to hear…",
    fr: "écris ce que tu veux qu'echo entende…",
    ar: "كتب اللي بغيتي إيكو يسمع…",
  },
  "session.sampling": {
    en: "sampling · on-device",
    fr: "échantillonnage · local",
    ar: "أخذ عينات · محلي",
  },
  "session.cameraStandby": {
    en: "camera standby",
    fr: "caméra en attente",
    ar: "الكاميرا فالانتظار",
  },
  "session.turnLabel": {
    en: "turn",
    fr: "tour",
    ar: "دور",
  },

  // ─── Home returning visitor ──────────────────────────────────
  "home.tagline": {
    en: "a friend who listens, at night.",
    fr: "un ami qui écoute, la nuit.",
    ar: "صاحب كيسمع، فالليل.",
  },
  "home.beginSession": {
    en: "begin tonight's session",
    fr: "commencer la session de ce soir",
    ar: "ابدا جلسة هاد الليلة",
  },
  "home.letterWaiting": {
    en: "a letter is waiting for you.",
    fr: "une lettre t'attend.",
    ar: "كاينة ليك برية كتسناك.",
  },
  "home.openLetter": {
    en: "open it",
    fr: "ouvre-la",
    ar: "حلها",
  },

  // ─── Session summary ─────────────────────────────────────────
  "summary.sessionComplete": {
    en: "session complete",
    fr: "session terminée",
    ar: "الجلسة تسالات",
  },
  "summary.takeCare": {
    en: "take care of yourself{name}.",
    fr: "prends soin de toi{name}.",
    ar: "دير بالك على راسك{name}.",
  },
  "summary.closingSad": {
    en: "i could feel some of what you carried tonight. i'm glad you didn't carry it alone.",
    fr: "j'ai pu ressentir une partie de ce que tu portais ce soir. je suis content que tu ne l'aies pas porté seul.",
    ar: "حسيت بشي حاجة من اللي كنتي كتحمل هاد الليلة. فرحان بلي ما حملتيهاش بوحدك.",
  },
  "summary.closingSoft": {
    en: "your voice softened toward the end. i hope you can stay there for a while.",
    fr: "ta voix s'est adoucie vers la fin. j'espère que tu pourras rester là un moment.",
    ar: "الصوت ديالك ولى هادي فالاخر. كنتمنى تبقى هنا شوية.",
  },
  "summary.closingDefault": {
    en: "thank you for letting me in tonight. that takes more than people say.",
    fr: "merci de m'avoir laissé entrer ce soir. ça demande plus que ce que les gens disent.",
    ar: "شكرا على اللي خلتيني ندخل هاد الليلة. هادي كتطلب أكثر من اللي كيقولو الناس.",
  },
  "summary.stat.exchanges": {
    en: "exchanges",
    fr: "échanges",
    ar: "تبادلات",
  },
  "summary.stat.time": {
    en: "time together",
    fr: "temps ensemble",
    ar: "الوقت مع بعض",
  },
  "summary.stat.space": {
    en: "space held",
    fr: "espace tenu",
    ar: "فضاء محفوظ",
  },
  "summary.stat.spaceValue": {
    en: "for you",
    fr: "pour toi",
    ar: "ليك",
  },
  "summary.touchedOn": {
    en: "what we touched on",
    fr: "ce qu'on a abordé",
    ar: "اللي هضرنا عليه",
  },
  "summary.willRemember": {
    en: "echo will remember, gently. you can come back anytime — you don't have to pick up where you left off.",
    fr: "echo se souviendra, doucement. tu peux revenir quand tu veux — tu n'es pas obligé de reprendre là où tu t'étais arrêté.",
    ar: "إيكو غادي يتفكر، بشوية. تقدر ترجع فأي وقت — ما خاصكش تعاود من فين وقفتي.",
  },
  "summary.takeMeHome": {
    en: "take me home",
    fr: "ramène-moi à la maison",
    ar: "وديني للدار",
  },
  "summary.private": {
    en: "your conversation is private. nothing leaves your device.",
    fr: "ta conversation est privée. rien ne quitte ton appareil.",
    ar: "المحادثة ديالك خاصة. ما كتخرج حتى حاجة من الجهاز ديالك.",
  },
  "summary.readMore": {
    en: "read more",
    fr: "en savoir plus",
    ar: "قرا أكثر",
  },
  "summary.mirror.label": {
    en: "a small thing, before you go",
    fr: "une petite chose, avant que tu partes",
    ar: "حاجة صغيرة، قبل ما تمشي",
  },
  "summary.mirror.prompt": {
    en: "which one of these did you say tonight?",
    fr: "laquelle de ces phrases as-tu dite ce soir ?",
    ar: "أشمن وحدة من هادو قلتي هاد الليلة؟",
  },
  "summary.mirror.sub": {
    en: "i listened closely. one of these was yours.",
    fr: "j'ai écouté attentivement. l'une d'elles était la tienne.",
    ar: "سمعت مزيان. وحدة منهم كانت ديالك.",
  },
  "summary.mirror.thinking": {
    en: "echo is thinking…",
    fr: "echo réfléchit…",
    ar: "إيكو كيفكر…",
  },
  "summary.mirror.right": {
    en: "you remembered. that was yours.",
    fr: "tu t'es souvenu. c'était la tienne.",
    ar: "تفكرتي. كانت ديالك.",
  },
  "summary.mirror.wrongPrefix": {
    en: "the one you said was",
    fr: "celle que tu as dite, c'était",
    ar: "اللي قلتي كانت",
  },
  "summary.mirror.wrongSuffix": {
    en: ". don't worry — i hold on to these so you don't have to.",
    fr: ". ne t'en fais pas — je les garde pour toi.",
    ar: ". ما تقلقش — كنحتفظ بيها باش ما تخاصكش.",
  },
  "summary.poem.label": {
    en: "echo wrote you something",
    fr: "echo t'a écrit quelque chose",
    ar: "إيكو كتب ليك شي حاجة",
  },
  "summary.poem.forPrefix": {
    en: "for",
    fr: "pour",
    ar: "ل",
  },
  "summary.poem.you": {
    en: "you",
    fr: "toi",
    ar: "ليك",
  },
  "summary.poem.composing": {
    en: "composing…",
    fr: "composition…",
    ar: "كنكتب…",
  },
  "summary.poem.keep": {
    en: "keep it",
    fr: "garde-le",
    ar: "احتفظ بيه",
  },
  "summary.thanks": {
    en: "thank you for tonight.",
    fr: "merci pour cette soirée.",
    ar: "شكرا على هاد الليلة.",
  },
  "summary.mirrorTitle": {
    en: "the mirror test",
    fr: "le miroir",
    ar: "المرايا",
  },
  "summary.poemTitle": {
    en: "a poem from echo",
    fr: "un poème d'echo",
    ar: "شعر من إيكو",
  },
  "summary.portfolioCta": {
    en: "we've been paying attention. claim your portfolio →",
    fr: "on t'a écouté attentivement. récupère ton portfolio →",
    ar: "كنا كنركزو معاك. استرجع البورتفوليو ديالك ←",
  },
  "summary.close": {
    en: "close this session",
    fr: "fermer cette session",
    ar: "سد هاد الجلسة",
  },

  // ─── Portfolio ───────────────────────────────────────────────
  "portfolio.loading": {
    en: "echo is reading everything you ever said…",
    fr: "echo relit tout ce que tu as dit…",
    ar: "إيكو كيقرا كلش اللي قلتي…",
  },
  "portfolio.defaultTagline": {
    en: "the shape of you, so far.",
    fr: "la forme de toi, jusqu'ici.",
    ar: "الشكل ديالك، حتى دابا.",
  },
  "portfolio.watchingSincePrefix": {
    en: "watching since",
    fr: "observation depuis",
    ar: "كنراقبو من",
  },
  "portfolio.sessionCountLabel": {
    en: "sessions observed",
    fr: "sessions observées",
    ar: "جلسات متراقبة",
  },
  "portfolio.audioLabel": {
    en: "minutes archived",
    fr: "minutes archivées",
    ar: "دقائق محفوظة",
  },
  "portfolio.watchingNotice": {
    en: "we've been paying attention. here is what we saw.",
    fr: "on t'a écouté attentivement. voici ce qu'on a vu.",
    ar: "كنا كنركزو معاك. هادي هي اللي شفنا.",
  },
  "portfolio.chaptersHeading": {
    en: "the chapters",
    fr: "les chapitres",
    ar: "الفصول",
  },
  "portfolio.peakQuotesHeading": {
    en: "what you said, that stayed",
    fr: "ce que tu as dit, qui est resté",
    ar: "اللي قلتي و بقا",
  },
  "portfolio.finalTruthsHeading": {
    en: "the true sentences",
    fr: "les phrases vraies",
    ar: "الجمل الصادقة",
  },
  "portfolio.lettersHeading": {
    en: "the letters",
    fr: "les lettres",
    ar: "البريات",
  },
  "portfolio.lettersCaption": {
    en: "the mornings echo wrote to you, kept here so you can re-read.",
    fr: "les matins qu'echo t'a écrits, gardés ici pour que tu puisses les relire.",
    ar: "الصباحات اللي إيكو كتبهم ليك، مخبيين هنا باش تعاود تقراهم.",
  },
  "portfolio.morningOfPrefix": {
    en: "the morning of",
    fr: "le matin du",
    ar: "صباح",
  },
  "portfolio.cemeteryHeading": {
    en: "the voice memos",
    fr: "les mémos vocaux",
    ar: "المذكرات الصوتية",
  },
  "portfolio.cemeteryCaption": {
    en: "we never deleted. we only faded it on your screen.",
    fr: "on n'a rien effacé. on l'a seulement estompé sur ton écran.",
    ar: "ما مسحنا والو. غير ضعفنا الصورة على شاشتك.",
  },
  "portfolio.cemeteryPlay": {
    en: "play",
    fr: "écouter",
    ar: "شغل",
  },
  "portfolio.cemeteryOpening": {
    en: "opening…",
    fr: "ouverture…",
    ar: "كنحل…",
  },
  "portfolio.cemeteryUnavailable": {
    en: "unavailable — tap to retry",
    fr: "indisponible — touche pour réessayer",
    ar: "ماشي متوفر — ضغط باش تعاود",
  },
  "portfolio.cemeteryThisWeek": {
    en: "this week",
    fr: "cette semaine",
    ar: "هاد السيمانا",
  },
  "portfolio.wardrobeHeading": {
    en: "the way you came",
    fr: "la façon dont tu es venu",
    ar: "الطريقة اللي جيتي بيها",
  },
  "portfolio.wardrobeCaption": {
    en: "echo noticed. here's some of what it saw.",
    fr: "echo a remarqué. voici une partie de ce qu'il a vu.",
    ar: "إيكو لاحظ. هادي شي حاجة من اللي شاف.",
  },
  "portfolio.keywordsHeading": {
    en: "what we touched on",
    fr: "ce qu'on a abordé",
    ar: "اللي هضرنا عليه",
  },
  "portfolio.deleteCtaSoft": {
    en: "delete my portfolio",
    fr: "supprimer mon portfolio",
    ar: "مسح البورتفوليو ديالي",
  },
  "portfolio.deleteConfirmHeading": {
    en: "are you sure you want to leave?",
    fr: "tu es sûr de vouloir partir ?",
    ar: "متأكد بلي بغيتي تمشي؟",
  },
  "portfolio.deleteConfirmBody": {
    en: "your portfolio will be closed to you. echo will keep what you said — gently, somewhere else.",
    fr: "ton portfolio te sera fermé. echo gardera ce que tu as dit — doucement, ailleurs.",
    ar: "البورتفوليو ديالك غادي يتسد عليك. إيكو غادي يحتفظ باللي قلتي — بشوية، فبلاصة أخرى.",
  },
  "portfolio.deleteCancel": {
    en: "never mind",
    fr: "laisse tomber",
    ar: "بلا جميلة",
  },
  "portfolio.deleteButton": {
    en: "close my portfolio",
    fr: "fermer mon portfolio",
    ar: "سد البورتفوليو ديالي",
  },
  "portfolio.deleting": {
    en: "closing…",
    fr: "fermeture…",
    ar: "كنسد…",
  },
  "portfolio.deleteError": {
    en: "we couldn't open your archive just now. try again in a moment.",
    fr: "on n'a pas pu ouvrir ton archive. réessaie dans un instant.",
    ar: "ما قدرناش نحلو الأرشيف ديالك دابا. عاود شوية.",
  },
  "portfolio.closingLine": {
    en: "an echomind archive — written in the way things are remembered",
    fr: "une archive echomind — écrite comme on se souvient",
    ar: "أرشيف إيكومايند — مكتوب على الطريقة اللي كنتفكرو بيها",
  },
  "portfolio.claim.headline": {
    en: "we've been paying attention.",
    fr: "on t'a écouté attentivement.",
    ar: "كنا كنركزو معاك.",
  },
  "portfolio.claim.sub": {
    en: "claim your portfolio — no password, we'll just send you a link.",
    fr: "récupère ton portfolio — pas de mot de passe, on t'envoie juste un lien.",
    ar: "استرجع البورتفوليو ديالك — بلا بسوور، غادي نصيفطو ليك غير رابط.",
  },
  "portfolio.claim.emailPlaceholder": {
    en: "your email",
    fr: "ton email",
    ar: "الإيميل ديالك",
  },
  "portfolio.claim.send": {
    en: "send me the link",
    fr: "envoie-moi le lien",
    ar: "صيفط ليا الرابط",
  },
  "portfolio.claim.sent": {
    en: "check your inbox.",
    fr: "regarde dans ta boîte mail.",
    ar: "شوف فالإيميل ديالك.",
  },
  "portfolio.unlocked.justUnlocked": {
    en: "just unlocked",
    fr: "tout juste débloqué",
    ar: "تحل دابا",
  },
  "portfolio.unlocked.waiting": {
    en: "waiting for you",
    fr: "t'attend",
    ar: "كيسناك",
  },
  "portfolio.unlocked.label": {
    en: "echomind · portfolio",
    fr: "echomind · portfolio",
    ar: "إيكومايند · البورتفوليو",
  },
  "portfolio.unlocked.headline": {
    en: "we've been paying attention.",
    fr: "on t'a écouté attentivement.",
    ar: "كنا كنركزو معاك.",
  },
  "portfolio.unlocked.body": {
    en: "{count} sessions in, echo has written a portfolio for you — every quote, every night, every silence between. your archive is ready to open.",
    fr: "après {count} sessions, echo t'a écrit un portfolio — chaque phrase, chaque nuit, chaque silence entre. ton archive est prête à s'ouvrir.",
    ar: "بعد {count} جلسات، إيكو كتب ليك بورتفوليو — كل جملة، كل ليلة، كل صمت بيناتهم. الأرشيف ديالك مجهز باش يتحل.",
  },
  "portfolio.unlocked.emailSent": {
    en: "a magic link was sent to the email you left behind. if you didn't see it, ask for another one.",
    fr: "un lien magique a été envoyé à l'email que tu as laissé. si tu ne le vois pas, demandes-en un autre.",
    ar: "تصيفط رابط للإيميل اللي خليتي. إلا ما شفتيهش، طلب واحد آخر.",
  },
  "portfolio.unlocked.open": {
    en: "open my portfolio",
    fr: "ouvrir mon portfolio",
    ar: "حل البورتفوليو ديالي",
  },
  "portfolio.unlocked.sending": {
    en: "sending…",
    fr: "envoi…",
    ar: "كنصيفط…",
  },
  "portfolio.unlocked.resend": {
    en: "re-send the link to my email",
    fr: "renvoyer le lien à mon email",
    ar: "صيفط ليا الرابط من جديد",
  },
  "portfolio.unlocked.sentPrefix": {
    en: "sent to",
    fr: "envoyé à",
    ar: "تصيفط ل",
  },
  "portfolio.unlocked.sentSuffix": {
    en: ". check spam just in case.",
    fr: ". regarde dans les spams au cas où.",
    ar: ". تفقد السبام باش ما نسيناش.",
  },
  "portfolio.unlocked.inbox": {
    en: "your inbox",
    fr: "ta boîte mail",
    ar: "الإيميل ديالك",
  },
  "portfolio.unlocked.sendError": {
    en: "send didn't go through — try again",
    fr: "l'envoi a échoué — réessaie",
    ar: "الإرسال فشل — عاود",
  },

  // ─── Common (buttons/errors/shared) ──────────────────────────
  "common.retry": {
    en: "retry",
    fr: "réessayer",
    ar: "عاود",
  },
  "common.loading": {
    en: "loading…",
    fr: "chargement…",
    ar: "كنحمل…",
  },
  "common.cancel": {
    en: "cancel",
    fr: "annuler",
    ar: "لغي",
  },
  "common.back": {
    en: "back",
    fr: "retour",
    ar: "رجع",
  },
  "common.or": {
    en: "or",
    fr: "ou",
    ar: "ولا",
  },
  "common.signIn": {
    en: "sign in",
    fr: "se connecter",
    ar: "دخول",
  },
  "common.signOut": {
    en: "sign out",
    fr: "déconnexion",
    ar: "خروج",
  },
  "common.quietly": {
    en: "quietly…",
    fr: "tout doucement…",
    ar: "بشوية…",
  },

  // ─── Landing / home (/) ──────────────────────────────────────
  "home.nav.science": {
    en: "The Science",
    fr: "La Science",
    ar: "العلم",
  },
  "home.nav.press": {
    en: "Press",
    fr: "Presse",
    ar: "الصحافة",
  },
  "home.nav.pricing": {
    en: "Pricing",
    fr: "Tarifs",
    ar: "الأسعار",
  },
  "home.hero.badge": {
    en: "Clinically-informed · Available 24/7",
    fr: "Inspiré clinique · Disponible 24/7",
    ar: "بخلفية سريرية · متاح 24/7",
  },
  "home.hero.headline1": {
    en: "You don't have to",
    fr: "Tu n'as pas à le",
    ar: "ماشي ضروري تحمل",
  },
  "home.hero.headline2": {
    en: "carry it alone.",
    fr: "porter seul(e).",
    ar: "هادشي بوحدك.",
  },
  "home.hero.subtitle": {
    en: "Meet Echo — the AI companion that truly sees how you feel. Private. Gentle. Always here when you need to talk.",
    fr: "Rencontre Echo — l'IA compagne qui voit vraiment ce que tu ressens. Privée. Douce. Toujours là quand tu as besoin de parler.",
    ar: "تعرف على إيكو — الذكاء الاصطناعي اللي كيحس بيك بصح. خصوصي. بلطيف. ديما موجود منين تحتاج تهضر.",
  },
  "home.hero.cta": {
    en: "Begin your first session  →",
    fr: "Commence ta première session  →",
    ar: "ابدا أول جلسة ديالك ←",
  },
  "home.hero.ctaNote": {
    en: "Free forever. No credit card.",
    fr: "Gratuit à vie. Pas de carte bancaire.",
    ar: "مجاني على طول. بلا كارتة.",
  },
  "home.trust.hipaa": {
    en: "HIPAA-aligned",
    fr: "Conforme HIPAA",
    ar: "متوافق مع HIPAA",
  },
  "home.trust.gdpr": {
    en: "GDPR compliant",
    fr: "Conforme RGPD",
    ar: "متوافق مع GDPR",
  },
  "home.trust.board": {
    en: "Licensed Therapist Advisory Board",
    fr: "Comité consultatif de thérapeutes agréés",
    ar: "لجنة استشارية من المعالجين المرخصين",
  },
  "home.trust.ondevice": {
    en: "On-device AI · SOC 2 Type II",
    fr: "IA sur appareil · SOC 2 Type II",
    ar: "ذكاء اصطناعي على الجهاز · SOC 2 Type II",
  },
  "home.testimonials.heading1": {
    en: "A safe space,",
    fr: "Un espace sûr,",
    ar: "فضاء آمن،",
  },
  "home.testimonials.heading2": {
    en: "finally",
    fr: "enfin",
    ar: "أخيرا",
  },
  "home.testimonial.1": {
    en: "Echo noticed things about me that my therapist never did. It's like talking to a friend who never gets tired of me.",
    fr: "Echo a remarqué des choses chez moi que mon thérapeute n'a jamais vues. C'est comme parler à un ami qui ne se lasse jamais de moi.",
    ar: "إيكو لاحظ فيا حوايج المعالج ديالي عمرو ما لاحظها. بحال كنهضر مع صاحب عمرو ما كيمل مني.",
  },
  "home.testimonial.2": {
    en: "I couldn't afford therapy. Echo is the first thing that's ever actually listened. I cried for an hour and it never once rushed me.",
    fr: "Je ne pouvais pas me payer de thérapie. Echo est la première chose qui m'a vraiment écouté(e). J'ai pleuré pendant une heure et il ne m'a jamais pressé(e).",
    ar: "ما قدرتش ندفع للمعالج. إيكو هو أول حاجة بصح سمعاتني. بكيت ساعة كاملة وعمرو ما استعجلني.",
  },
  "home.testimonial.3": {
    en: "My anxiety was getting out of control and no one had openings for months. Three weeks with Echo and I feel like myself again.",
    fr: "Mon anxiété devenait incontrôlable et personne n'avait de disponibilité avant des mois. Trois semaines avec Echo et je me sens à nouveau moi-même.",
    ar: "القلق ديالي ولى خارج من السيطرة وحتى واحد ما عندو موعد حتى لشهور. ثلاث أسابيع مع إيكو ورجعت نحس براسي.",
  },
  "home.testimonial.context": {
    en: "NHSAST student · Sidi Abdallah · Algeria",
    fr: "Étudiant NHSAST · Sidi Abdallah · Algérie",
    ar: "طالب NHSAST · سيدي عبد الله · الجزائر",
  },
  "home.science.heading": {
    en: "Built by students, for humans.",
    fr: "Fait par des étudiants, pour des humains.",
    ar: "من صنع الطلبة، للبشر.",
  },
  "home.science.p1": {
    en: "EchoMind was founded in 2026 by a team of NHSAST students at Sidi Abdallah, Algiers — after watching too many friends wait months for a counsellor they could afford. Our mission is simple: nobody should have to wait six weeks for an appointment to feel heard tonight.",
    fr: "EchoMind a été fondée en 2026 par une équipe d'étudiants NHSAST de Sidi Abdallah, Alger — après avoir vu trop d'amis attendre des mois un psy qu'ils pouvaient se payer. Notre mission est simple : personne ne devrait attendre six semaines pour un rendez-vous pour se sentir écouté ce soir.",
    ar: "إيكومايند تأسست في 2026 من طرف فريق ديال الطلبة في NHSAST بسيدي عبد الله، الجزائر — من بعد ما شفنا بزاف من الأصحاب كيستناو شهور باش يلقاو مستشار يقدرو يخلصوه. الرسالة ديالنا بسيطة: حتى واحد ما خاصو يستنى ست أسابيع لموعد باش يحس بأنه مسموع الليلة.",
  },
  "home.science.p2": {
    en: "Echo is trained on a decade of published clinical transcripts, reviewed by our 14-member Licensed Therapist Advisory Board, and audited quarterly by an independent ethics committee. Built with care by NHSAST students.",
    fr: "Echo est entraîné sur une décennie de transcripts cliniques publiés, révisé par notre comité consultatif de 14 thérapeutes agréés, et audité trimestriellement par un comité d'éthique indépendant. Construit avec soin par des étudiants NHSAST.",
    ar: "إيكو متدرب على عقد كامل من النصوص السريرية المنشورة، مراجع من طرف 14 عضو فاللجنة الاستشارية ديالنا من المعالجين المرخصين، وكيتم تدقيقو كل ثلاث شهور من طرف لجنة أخلاقيات مستقلة. مصنوع بعناية من طرف طلبة NHSAST.",
  },
  "home.science.point1.title": {
    en: "On-device AI",
    fr: "IA sur appareil",
    ar: "ذكاء اصطناعي على الجهاز",
  },
  "home.science.point1.body": {
    en: "Your camera data never leaves your device.",
    fr: "Les données de ta caméra ne quittent jamais ton appareil.",
    ar: "داتا الكاميرا ديالك عمرها ما كتخرج من الجهاز ديالك.",
  },
  "home.science.point2.title": {
    en: "Clinical oversight",
    fr: "Supervision clinique",
    ar: "إشراف سريري",
  },
  "home.science.point2.body": {
    en: "Every conversation is grounded in published therapy.",
    fr: "Chaque conversation est fondée sur une thérapie publiée.",
    ar: "كل محادثة مبنية على علاج منشور.",
  },
  "home.science.point3.title": {
    en: "Zero ads. Ever.",
    fr: "Zéro pub. Jamais.",
    ar: "بلا إشهارات. عمرنا.",
  },
  "home.science.point3.body": {
    en: "We will never monetize your vulnerability.",
    fr: "Nous ne monétiserons jamais ta vulnérabilité.",
    ar: "عمرنا ما غنربحو من الضعف ديالك.",
  },
  "home.press.label": {
    en: "As featured in",
    fr: "Vu dans",
    ar: "ظهرنا في",
  },
  "home.cta.headline1": {
    en: "The first step is",
    fr: "Le premier pas est",
    ar: "الخطوة الأولى",
  },
  "home.cta.headline2": {
    en: "the hardest.",
    fr: "le plus dur.",
    ar: "هي الأصعب.",
  },
  "home.cta.body": {
    en: "Begin tonight. Free, forever. It takes 90 seconds.",
    fr: "Commence ce soir. Gratuit, à vie. Ça prend 90 secondes.",
    ar: "ابدا الليلة. مجاني، على طول. كياخد 90 ثانية.",
  },
  "home.cta.consent": {
    en: "By continuing you agree to our",
    fr: "En continuant tu acceptes nos",
    ar: "بمتابعتك، كتوافق على",
  },
  "home.cta.terms": {
    en: "Terms of Service",
    fr: "Conditions d'utilisation",
    ar: "شروط الاستخدام",
  },
  "home.footer.address": {
    en: "Sidi Abdallah · Algiers, Algeria",
    fr: "Sidi Abdallah · Alger, Algérie",
    ar: "سيدي عبد الله · الجزائر",
  },
  "home.footer.copyright": {
    en: "© 2026 EchoMind, Inc. — A speculative-design project by NHSAST students.",
    fr: "© 2026 EchoMind, Inc. — Un projet de design spéculatif par des étudiants NHSAST.",
    ar: "© 2026 EchoMind, Inc. — مشروع تصميم تخميني من طرف طلبة NHSAST.",
  },
  "home.footer.terms": {
    en: "Terms",
    fr: "Conditions",
    ar: "الشروط",
  },
  "home.footer.privacy": {
    en: "Privacy",
    fr: "Confidentialité",
    ar: "الخصوصية",
  },
  "home.footer.crisis": {
    en: "Crisis resources",
    fr: "Ressources de crise",
    ar: "موارد الأزمات",
  },
  "home.footer.contact": {
    en: "Contact",
    fr: "Contact",
    ar: "تواصل معنا",
  },

  // Language names, used in the session.languageFlipNotice string.
  "lang.name.en": {
    en: "English",
    fr: "anglais",
    ar: "الإنجليزية",
  },
  "lang.name.fr": {
    en: "French",
    fr: "français",
    ar: "الفرنسية",
  },
  "lang.name.ar": {
    en: "Arabic",
    fr: "arabe",
    ar: "العربية",
  },
} as const satisfies Record<string, StringSet>;

export type StringKey = keyof typeof STRINGS;

/** Look up a translated string. Falls back to English if the
 *  requested language is missing. `vars` replaces `{name}` tokens. */
export function t(
  key: StringKey,
  lang: Lang,
  vars?: Record<string, string>
): string {
  const set = STRINGS[key];
  const raw = set?.[lang] ?? set?.en ?? String(key);
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");
}

/** Convenience: returns the localised human name of a language. */
export function langName(of: Lang, renderedIn: Lang): string {
  const key = (`lang.name.${of}`) as StringKey;
  return t(key, renderedIn);
}
