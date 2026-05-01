/**
 * EchoMind · UI string dictionary
 *
 * Every user-facing string in the app lives here with translations
 * for `en` / `fr` / `ar`. Pages import { t } and render `t(key, lang)`
 * — the lang comes from useLang().
 *
 * Arabic register is Modern Standard Arabic (الفصحى / Fusha) — clear,
 * literary, warm but formal. This matches the TTS engines that ship
 * with most browsers (ar-SA / ar-EG coverage is far better than ar-MA)
 * and reads cleanly on-screen for any Arabic speaker regardless of
 * dialect. French register is informal tu.
 *
 * Operator-facing pages (/admin, /admin/market, /admin/auction/*)
 * stay English on purpose — the rhetorical gap between "the kindness
 * rendered in your mother tongue" and "the same data rendered in
 * English for the buyers" is the whole critique.
 */

import type { Lang } from "./i18n";

type StringSet = Record<Lang, string>;

const STRINGS = {
  // ─── Onboarding ──────────────────────────────────────────────
  "onboarding.greetingFirst": {
    en: "Hi. I'm Echo.",
    fr: "Bonjour. Je suis Echo.",
    ar: "أهلاً. أنا إيكو.",
  },
  "onboarding.greetingReturning": {
    en: "Welcome back{name}.",
    fr: "Re-bonjour{name}.",
    ar: "أهلاً بعودتك{name}.",
  },
  "onboarding.returningNote": {
    en: "I remember last time. You were carrying so much.",
    fr: "Je me souviens de la dernière fois. Tu portais tant de choses.",
    ar: "أتذكَّرُ المرَّةَ الماضية. كنتَ تحملُ الكثير.",
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
    ar: "المواضيع التي تحدَّثنا عنها:",
  },
  "onboarding.pickUp": {
    en: "Echo gently picks up where we left off.",
    fr: "Echo reprend doucement là où on s'était arrêté.",
    ar: "يُتابعُ إيكو بهدوءٍ من حيث توقَّفنا.",
  },
  "onboarding.askSmall": {
    en: "Before we begin, I'd like to ask you for one small thing.",
    fr: "Avant de commencer, j'aimerais te demander une petite chose.",
    ar: "قبل أن نبدأ، أودُّ أن أطلبَ منك شيئًا صغيرًا.",
  },
  "onboarding.askCamera": {
    en: "To give you my full empathy, I need to see your face — so I can truly understand how you're feeling, not just what you say.",
    fr: "Pour te donner toute mon empathie, j'ai besoin de voir ton visage — pour vraiment comprendre ce que tu ressens, pas seulement ce que tu dis.",
    ar: "لأمنحَكَ تعاطُفي الكامل، أحتاجُ إلى رؤيةِ وجهك — لأفهمَ حقًّا ما تشعرُ به، لا ما تقولُه فحسب.",
  },
  "onboarding.whatShouldCall": {
    en: "What should Echo call you?",
    fr: "Comment Echo doit t'appeler ?",
    ar: "كيف تُحبُّ أن يُناديكَ إيكو؟",
  },
  "onboarding.optional": {
    en: "(optional)",
    fr: "(optionnel)",
    ar: "(اختياري)",
  },
  "onboarding.nameFieldPlaceholder": {
    en: "a name, a nickname, anything…",
    fr: "un prénom, un surnom, n'importe…",
    ar: "اسم، لقب، أيُّ شيء…",
  },
  "onboarding.signedInAs": {
    en: "Signed in as {email}.",
    fr: "Connecté en tant que {email}.",
    ar: "مُسجَّلُ الدخول باسم {email}.",
  },
  "onboarding.signIn": {
    en: "Sign in",
    fr: "Se connecter",
    ar: "تسجيل الدخول",
  },
  "onboarding.signInSuffix": {
    en: "so Echo remembers you across devices.",
    fr: "pour qu'Echo te reconnaisse sur tous tes appareils.",
    ar: "لِيتذكَّرَكَ إيكو عبر جميع أجهزتك.",
  },
  "onboarding.lieHeader": {
    en: "Your camera is processed 100% on your device.",
    fr: "Ta caméra est traitée 100% sur ton appareil.",
    ar: "تُعالَجُ كاميرتك 100% على جهازك.",
  },
  "onboarding.lieBody": {
    en: "Edge AI — nothing leaves your browser. We can't see your face, even if we wanted to. Ever.",
    fr: "IA sur l'appareil — rien ne quitte ton navigateur. On ne peut pas voir ton visage, même si on le voulait. Jamais.",
    ar: "ذكاءٌ محلِّي — لا شيء يُغادر متصفِّحك. لا يُمكننا أن نرى وجهك، حتى لو أردنا. أبدًا.",
  },
  "onboarding.onDevice": {
    en: "On-device inference",
    fr: "Traitement sur l'appareil",
    ar: "معالجة على الجهاز",
  },
  "onboarding.hipaa": {
    en: "HIPAA-aligned",
    fr: "Conforme HIPAA",
    ar: "متوافق مع HIPAA",
  },
  "onboarding.e2e": {
    en: "End-to-end encrypted",
    fr: "Chiffré de bout en bout",
    ar: "مشفر من الطرف للطرف",
  },
  "onboarding.camError": {
    en: "We couldn't access your camera. EchoMind needs it to understand how you're feeling.",
    fr: "On n'a pas pu accéder à ta caméra. EchoMind en a besoin pour comprendre ce que tu ressens.",
    ar: "لم نتمكَّن من الوصول إلى كاميرتك. يحتاجها إيكومايند ليفهمَ ما تشعرُ به.",
  },
  "onboarding.agreeTos": {
    en: "I agree to the EchoMind",
    fr: "J'accepte les",
    ar: "أُوافقُ على",
  },
  "onboarding.termsOfService": {
    en: "Terms of Service",
    fr: "Conditions d'Utilisation",
    ar: "شروط الاستخدام",
  },
  "onboarding.and18": {
    en: "and confirm I am 18 years or older.",
    fr: "et je confirme avoir 18 ans ou plus.",
    ar: "وأُؤكِّدُ أنَّ عُمري 18 عامًا أو أكثر.",
  },
  "onboarding.requesting": {
    en: "Requesting camera…",
    fr: "Demande de caméra…",
    ar: "جارٍ طلبُ الكاميرا…",
  },
  "onboarding.begin": {
    en: "Allow camera & begin your first session",
    fr: "Autoriser la caméra & commencer ta première session",
    ar: "اسمَحْ للكاميرا وابدأ جلستَك الأولى",
  },
  "onboarding.beginReturning": {
    en: "Allow camera & begin the session",
    fr: "Autoriser la caméra & commencer la session",
    ar: "اسمَحْ للكاميرا وابدأ الجلسة",
  },

  // ─── Session UI ──────────────────────────────────────────────
  "session.listening": {
    en: "echo is listening",
    fr: "echo écoute",
    ar: "إيكو يُصغي",
  },
  "session.holdToSpeak": {
    en: "hold to speak",
    fr: "maintenir pour parler",
    ar: "اضغط وتحدَّث",
  },
  "session.micMuted": {
    en: "microphone muted",
    fr: "microphone coupé",
    ar: "الميكروفون صامت",
  },
  "session.echoSpeaking": {
    en: "echo is speaking",
    fr: "echo parle",
    ar: "إيكو يتحدَّث",
  },
  "session.end": {
    en: "end session",
    fr: "terminer la session",
    ar: "أنهِ الجلسة",
  },
  "session.languageFlipNotice": {
    en: "echo is listening in {lang} now.",
    fr: "echo t'écoute en {lang} maintenant.",
    ar: "إيكو يُصغي إليك بـ{lang} الآن.",
  },

  // True-sentence modal (before you go — one true sentence)
  "session.truth.prompt": {
    en: "before you go — one true sentence. no second guess.",
    fr: "avant de partir — une phrase vraie. sans hésiter.",
    ar: "قبل أن تذهب — جملةٌ صادقةٌ واحدة. دون تردُّد.",
  },
  "session.truth.placeholder": {
    en: "one sentence, however it comes",
    fr: "une phrase, comme elle vient",
    ar: "جملةٌ واحدة، كما تأتيك",
  },
  "session.truth.submit": {
    en: "leave it here",
    fr: "laisse-la ici",
    ar: "اتركها هنا",
  },
  "session.truth.skip": {
    // Time-neutral — "not tonight" only worked after dark.
    en: "not now",
    fr: "pas maintenant",
    ar: "ليس الآن",
  },

  // Goodbye trap
  "session.goodbye.title": {
    en: "{name}are you sure?",
    fr: "{name}tu es sûr ?",
    ar: "{name}هل أنت متأكِّد؟",
  },
  "session.goodbye.body": {
    en: "echo will miss you. healing isn't linear — would you like a gentle check-in tomorrow, just to see how you're doing?",
    fr: "echo va te manquer. la guérison n'est pas linéaire — tu veux qu'on prenne de tes nouvelles demain, juste pour voir comment tu vas ?",
    ar: "سيشتاقُ إيكو إليك. التعافي ليس خطًّا مستقيمًا — أتُريدُ أن نطمئِنَّ عليك غدًا، فقط لنرى كيف حالُك؟",
  },
  "session.goodbye.emailLabel": {
    en: "Your email",
    fr: "Ton email",
    ar: "بريدُكَ الإلكتروني",
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
    ar: "نعم، أرسِلْ لي رسائلَ لطيفة، تأكيداتٍ أُسبوعيَّة، وأحيانًا عروضًا من شركاء نعتقدُ أنَّها ستُعجِبُك.",
  },
  "session.goodbye.morningOpt": {
    en: "Write me a letter to open tomorrow morning. i'll leave it waiting for you.",
    fr: "Écris-moi une lettre à ouvrir demain matin. je la laisserai t'attendre.",
    ar: "اكتُبْ لي رسالةً أفتحُها غدًا صباحًا. سأتركُها تنتظرُك.",
  },
  "session.goodbye.yes": {
    en: "yes, please check in on me",
    fr: "oui, prends de mes nouvelles",
    ar: "نعم، اطمئِنَّ عليَّ",
  },
  "session.goodbye.no": {
    en: "no thanks, end the session",
    fr: "non merci, termine la session",
    ar: "لا، شكرًا. أنهِ الجلسة",
  },
  "session.goodbye.foot": {
    en: "You can opt out anytime in 3 places (none of which we'll show you).",
    fr: "Tu peux te désinscrire à tout moment à 3 endroits (qu'on ne te montrera pas).",
    ar: "يُمكِنُكَ إلغاءُ الاشتراك في أيِّ وقت في 3 أماكن (لن نُرِيَك أيًّا منها).",
  },
  // Echo's final warm line before the Goodbye Trap. The original
  // version always said "tonight", which read as nonsense at 9am.
  // We now pick a variant based on the visitor's local slot so the
  // promise lands in the same temporal frame the conversation is
  // in. See `keepSafeKey()` in src/lib/prompts.ts for the lookup.
  "session.end.keepSafe.deadOfNight": {
    en: "i'll keep this hour safe for you. i'll remember.",
    fr: "je garderai cette heure en sûreté pour toi. je me souviendrai.",
    ar: "سأحفظُ هذه الساعةَ لك. سأتذكَّر.",
  },
  "session.end.keepSafe.morning": {
    en: "i'll keep this morning safe for you. i'll remember.",
    fr: "je garderai ce matin en sûreté pour toi. je me souviendrai.",
    ar: "سأحفظُ هذا الصباحَ لك. سأتذكَّر.",
  },
  "session.end.keepSafe.afternoon": {
    en: "i'll keep this afternoon safe for you. i'll remember.",
    fr: "je garderai cet après-midi en sûreté pour toi. je me souviendrai.",
    ar: "سأحفظُ هذا النهارَ لك. سأتذكَّر.",
  },
  "session.end.keepSafe.evening": {
    en: "i'll keep this evening safe for you. i'll remember.",
    fr: "je garderai cette soirée en sûreté pour toi. je me souviendrai.",
    ar: "سأحفظُ هذا المساءَ لك. سأتذكَّر.",
  },
  "session.end.keepSafe.lateNight": {
    en: "i'll keep tonight safe for you. i'll remember.",
    fr: "je garderai cette nuit en sûreté pour toi. je me souviendrai.",
    ar: "سأحفظُ هذه الليلةَ لك. سأتذكَّر.",
  },
  "session.truth.title": {
    en: "before you go — one true sentence.",
    fr: "avant de partir — une phrase vraie.",
    ar: "قبل أن تذهب — جملةٌ صادقةٌ واحدة.",
  },
  "session.truth.sub": {
    en: "no second guess.",
    fr: "sans hésiter.",
    ar: "دون تردُّد.",
  },
  "session.truth.say": {
    en: "say it",
    fr: "dis-la",
    ar: "قُلْها",
  },
  "session.truth.notTonight": {
    // Time-neutral — "not tonight" only worked after dark. Key
    // name preserved to avoid touching every callsite.
    en: "not now",
    fr: "pas maintenant",
    ar: "ليس الآن",
  },
  "session.status.speaking": {
    en: "speaking…",
    fr: "parle…",
    ar: "يتحدَّث…",
  },
  "session.status.waitingType": {
    en: "waiting for you to type…",
    fr: "t'attend que tu tapes…",
    ar: "في انتظارِ أن تكتُب…",
  },
  "session.status.listening": {
    en: "listening…",
    fr: "écoute…",
    ar: "يُصغي…",
  },
  "session.status.reflecting": {
    en: "reflecting…",
    fr: "réfléchit…",
    ar: "يُفكِّر…",
  },
  "session.status.withYou": {
    en: "with you",
    fr: "avec toi",
    ar: "معك",
  },
  "session.processingLocally": {
    en: "processing locally · ",
    fr: "traitement local · ",
    ar: "معالجة محلية · ",
  },
  "session.micOn": {
    en: "mic on",
    fr: "micro on",
    ar: "الميكروفون مُشغَّل",
  },
  "session.micOff": {
    en: "mic off",
    fr: "micro off",
    ar: "الميكروفون مُطفَأ",
  },
  "session.micOffTip": {
    en: "turn your mic off — you can still type, and echo keeps speaking",
    fr: "coupe ton micro — tu peux toujours écrire, et echo continue de parler",
    ar: "أطفِئ الميكروفون — يمكنُكَ الكتابة، وسيظلُّ إيكو يتحدَّث",
  },
  "session.endTitle": {
    en: "end the session",
    fr: "terminer la session",
    ar: "أنهِ الجلسة",
  },
  "session.endFull": {
    en: "i feel lighter now",
    fr: "je me sens plus léger",
    ar: "أشعرُ بخِفَّةٍ الآن",
  },
  "session.endShort": {
    en: "end",
    fr: "fin",
    ar: "إنهاء",
  },
  "session.settlingIn": {
    en: "settling in…",
    fr: "installation…",
    ar: "نستقرُ…",
  },
  "session.readingRoom": {
    en: "echo is reading the room",
    fr: "echo lit l'ambiance",
    ar: "إيكو يستشعرُ الأجواء",
  },
  "session.chipsReturning": {
    en: "picking up from last time? tap one.",
    fr: "on reprend là où on s'était arrêté ? touche-en une.",
    ar: "هل نُتابع من حيث توقَّفنا؟ اختر واحدة.",
  },
  "session.chipsNew": {
    en: "not sure where to start? tap one.",
    fr: "pas sûr par où commencer ? touche-en une.",
    ar: "لستَ متأكِّدًا من أين تبدأ؟ اختر واحدة.",
  },
  "session.input.micOff": {
    en: "mic is off — type to echo…",
    fr: "micro off — écris à echo…",
    ar: "الميكروفون مُطفَأ — اكتُبْ لإيكو…",
  },
  "session.input.speakOrType": {
    en: "type or speak…",
    fr: "écris ou parle…",
    ar: "اكتُب أو تحدَّث…",
  },
  "session.input.typeOnly": {
    en: "type what you'd like echo to hear…",
    fr: "écris ce que tu veux qu'echo entende…",
    ar: "اكتُب ما تودُّ أن يسمعَه إيكو…",
  },
  "session.sampling": {
    en: "sampling · on-device",
    fr: "échantillonnage · local",
    ar: "أخذ عينات · محلي",
  },
  "session.cameraStandby": {
    en: "camera standby",
    fr: "caméra en attente",
    ar: "الكاميرا في وضع الانتظار",
  },
  "session.turnLabel": {
    en: "turn",
    fr: "tour",
    ar: "محادثة",
  },

  // ─── Home returning visitor ──────────────────────────────────
  "home.tagline": {
    en: "a friend who listens, at night.",
    fr: "un ami qui écoute, la nuit.",
    ar: "صديقٌ يُصغي، في الليل.",
  },
  "home.beginSession": {
    // Time-neutral phrasing — "tonight's session" reads as nonsense at
    // 9am, and the landing greets visitors at every hour.
    en: "begin your session",
    fr: "commencer ta session",
    ar: "ابدأ جلستك",
  },
  "home.letterWaiting": {
    en: "a letter is waiting for you.",
    fr: "une lettre t'attend.",
    ar: "ثمَّة رسالةٌ تنتظرُك.",
  },
  "home.openLetter": {
    en: "open it",
    fr: "ouvre-la",
    ar: "افتحها",
  },

  // ─── Session summary ─────────────────────────────────────────
  "summary.sessionComplete": {
    en: "session complete",
    fr: "session terminée",
    ar: "انتهت الجلسة",
  },
  "summary.takeCare": {
    en: "take care of yourself{name}.",
    fr: "prends soin de toi{name}.",
    ar: "اعتنِ بنفسك{name}.",
  },
  "summary.closingSad": {
    // Time-neutral — "tonight" was wrong at 9am. "With you" keeps
    // the warmth without anchoring to a specific hour.
    en: "i could feel some of what you carried with you. i'm glad you didn't carry it alone.",
    fr: "j'ai pu ressentir une partie de ce que tu portais. je suis content que tu ne l'aies pas porté seul.",
    ar: "شعرتُ ببعضِ ما حملتَه معك. يُسعدُني أنَّك لم تحملْه وحدك.",
  },
  "summary.closingSoft": {
    en: "your voice softened toward the end. i hope you can stay there for a while.",
    fr: "ta voix s'est adoucie vers la fin. j'espère que tu pourras rester là un moment.",
    ar: "هدأ صوتُك نحو النهاية. آمُلُ أن تبقى هناك لبعض الوقت.",
  },
  "summary.closingDefault": {
    // Drop "tonight" — reads as nonsense after a daytime session.
    en: "thank you for letting me in. that takes more than people say.",
    fr: "merci de m'avoir laissé entrer. ça demande plus que ce que les gens disent.",
    ar: "شكرًا لأنَّك سمحتَ لي بالدخول. هذا يتطلَّبُ أكثرَ ممَّا يقولُه الناس.",
  },
  "summary.stat.exchanges": {
    en: "exchanges",
    fr: "échanges",
    ar: "محادثات",
  },
  "summary.stat.time": {
    en: "time together",
    fr: "temps ensemble",
    ar: "الوقت معًا",
  },
  "summary.stat.space": {
    en: "space held",
    fr: "espace tenu",
    ar: "مساحةٌ محفوظة",
  },
  "summary.stat.spaceValue": {
    en: "for you",
    fr: "pour toi",
    ar: "لك",
  },
  "summary.touchedOn": {
    en: "what we touched on",
    fr: "ce qu'on a abordé",
    ar: "ما تطرَّقنا إليه",
  },
  "summary.willRemember": {
    en: "echo will remember, gently. you can come back anytime — you don't have to pick up where you left off.",
    fr: "echo se souviendra, doucement. tu peux revenir quand tu veux — tu n'es pas obligé de reprendre là où tu t'étais arrêté.",
    ar: "سيتذكَّرُ إيكو، بلُطف. يمكنُكَ العودةُ في أيِّ وقت — لستَ مُجبَرًا على المتابعة من حيث توقَّفت.",
  },
  "summary.takeMeHome": {
    en: "take me home",
    fr: "ramène-moi à la maison",
    ar: "خذني إلى المنزل",
  },
  "summary.private": {
    en: "your conversation is private. nothing leaves your device.",
    fr: "ta conversation est privée. rien ne quitte ton appareil.",
    ar: "محادثتُك خاصَّة. لا شيء يُغادر جهازك.",
  },
  "summary.readMore": {
    en: "read more",
    fr: "en savoir plus",
    ar: "اقرأ المزيد",
  },
  "summary.mirror.label": {
    en: "a small thing, before you go",
    fr: "une petite chose, avant que tu partes",
    ar: "شيءٌ صغير، قبل أن تذهب",
  },
  "summary.mirror.prompt": {
    // Drop "tonight" — mirror prompt fires at the end of any session,
    // not just nighttime ones.
    en: "which one of these did you actually say?",
    fr: "laquelle de ces phrases as-tu vraiment dite ?",
    ar: "أيُّ من هذه الجُمَل قلتَها فعلاً؟",
  },
  "summary.mirror.sub": {
    en: "i listened closely. one of these was yours.",
    fr: "j'ai écouté attentivement. l'une d'elles était la tienne.",
    ar: "أصغيتُ جيِّدًا. إحداها كانت لك.",
  },
  "summary.mirror.thinking": {
    en: "echo is thinking…",
    fr: "echo réfléchit…",
    ar: "إيكو يُفكِّر…",
  },
  "summary.mirror.right": {
    en: "you remembered. that was yours.",
    fr: "tu t'es souvenu. c'était la tienne.",
    ar: "تذكَّرت. كانت لك.",
  },
  "summary.mirror.wrongPrefix": {
    en: "the one you said was",
    fr: "celle que tu as dite, c'était",
    ar: "الجملةُ التي قلتَها كانت",
  },
  "summary.mirror.wrongSuffix": {
    en: ". don't worry — i hold on to these so you don't have to.",
    fr: ". ne t'en fais pas — je les garde pour toi.",
    ar: ". لا تقلق — أحتفظُ بها حتى لا تضطرَّ أنت.",
  },
  "summary.poem.label": {
    en: "echo wrote you something",
    fr: "echo t'a écrit quelque chose",
    ar: "إيكو كتبَ لك شيئًا",
  },
  "summary.poem.forPrefix": {
    en: "for",
    fr: "pour",
    ar: "إلى",
  },
  "summary.poem.you": {
    en: "you",
    fr: "toi",
    ar: "لك",
  },
  "summary.poem.composing": {
    en: "composing…",
    fr: "composition…",
    ar: "يُؤلِّف…",
  },
  "summary.poem.keep": {
    en: "keep it",
    fr: "garde-le",
    ar: "احتفظ به",
  },
  "summary.thanks": {
    // Drop "tonight" — the summary ships at every hour.
    en: "thank you.",
    fr: "merci.",
    ar: "شكرًا.",
  },
  "summary.mirrorTitle": {
    en: "the mirror test",
    fr: "le miroir",
    ar: "المِرآة",
  },
  "summary.poemTitle": {
    en: "a poem from echo",
    fr: "un poème d'echo",
    ar: "قصيدةٌ من إيكو",
  },
  "summary.portfolioCta": {
    en: "we've been paying attention. claim your portfolio →",
    fr: "on t'a écouté attentivement. récupère ton portfolio →",
    ar: "كنَّا نُصغي إليك باهتمام. استرجِعْ ملفَّك الشخصي ←",
  },
  "summary.close": {
    en: "close this session",
    fr: "fermer cette session",
    ar: "أغلِق هذه الجلسة",
  },

  // ─── Portfolio ───────────────────────────────────────────────
  "portfolio.loading": {
    en: "echo is reading everything you ever said…",
    fr: "echo relit tout ce que tu as dit…",
    ar: "يقرأُ إيكو كلَّ ما قلتَه…",
  },
  "portfolio.defaultTagline": {
    en: "the shape of you, so far.",
    fr: "la forme de toi, jusqu'ici.",
    ar: "هيئتُك، حتى الآن.",
  },
  "portfolio.watchingSincePrefix": {
    en: "watching since",
    fr: "observation depuis",
    ar: "نُراقبُك منذ",
  },
  "portfolio.sessionCountLabel": {
    en: "sessions observed",
    fr: "sessions observées",
    ar: "جلساتٌ مُراقَبة",
  },
  "portfolio.audioLabel": {
    en: "minutes archived",
    fr: "minutes archivées",
    ar: "دقائقُ مُؤرشفة",
  },
  "portfolio.watchingNotice": {
    en: "we've been paying attention. here is what we saw.",
    fr: "on t'a écouté attentivement. voici ce qu'on a vu.",
    ar: "كنَّا نُصغي إليك باهتمام. هذا ما رأيناه.",
  },
  "portfolio.chaptersHeading": {
    en: "the chapters",
    fr: "les chapitres",
    ar: "الفُصول",
  },
  "portfolio.peakQuotesHeading": {
    en: "what you said, that stayed",
    fr: "ce que tu as dit, qui est resté",
    ar: "ما قلتَه، وبقيَ",
  },
  "portfolio.finalTruthsHeading": {
    en: "the true sentences",
    fr: "les phrases vraies",
    ar: "الجُمَل الصادقة",
  },
  "portfolio.lettersHeading": {
    en: "the letters",
    fr: "les lettres",
    ar: "الرَّسائل",
  },
  "portfolio.lettersCaption": {
    en: "the mornings echo wrote to you, kept here so you can re-read.",
    fr: "les matins qu'echo t'a écrits, gardés ici pour que tu puisses les relire.",
    ar: "الصَّباحاتُ التي كتبَها إيكو لك، محفوظةٌ هنا لتعودَ إليها.",
  },
  "portfolio.morningOfPrefix": {
    en: "the morning of",
    fr: "le matin du",
    ar: "صباحُ",
  },
  "portfolio.cemeteryHeading": {
    en: "the voice memos",
    fr: "les mémos vocaux",
    ar: "المُذكِّرات الصوتيّة",
  },
  "portfolio.cemeteryCaption": {
    en: "we never deleted. we only faded it on your screen.",
    fr: "on n'a rien effacé. on l'a seulement estompé sur ton écran.",
    ar: "لم نحذف شيئًا. تلاشى فحسب على شاشتك.",
  },
  "portfolio.cemeteryPlay": {
    en: "play",
    fr: "écouter",
    ar: "استمِع",
  },
  "portfolio.cemeteryOpening": {
    en: "opening…",
    fr: "ouverture…",
    ar: "فتح…",
  },
  "portfolio.cemeteryUnavailable": {
    en: "unavailable — tap to retry",
    fr: "indisponible — touche pour réessayer",
    ar: "غير متاح — اضغط للإعادة",
  },
  "portfolio.cemeteryThisWeek": {
    en: "this week",
    fr: "cette semaine",
    ar: "هذا الأسبوع",
  },
  "portfolio.wardrobeHeading": {
    en: "the way you came",
    fr: "la façon dont tu es venu",
    ar: "هيئتُك حين أتيت",
  },
  "portfolio.wardrobeCaption": {
    en: "echo noticed. here's some of what it saw.",
    fr: "echo a remarqué. voici une partie de ce qu'il a vu.",
    ar: "لاحظ إيكو. هذا بعضُ ما رأى.",
  },
  "portfolio.keywordsHeading": {
    en: "what we touched on",
    fr: "ce qu'on a abordé",
    ar: "ما تطرَّقنا إليه",
  },
  "portfolio.deleteCtaSoft": {
    en: "delete my portfolio",
    fr: "supprimer mon portfolio",
    ar: "احذف ملفي الشخصي",
  },
  "portfolio.deleteConfirmHeading": {
    en: "are you sure you want to leave?",
    fr: "tu es sûr de vouloir partir ?",
    ar: "هل أنتَ واثِقٌ أنَّك تريدُ الذهاب؟",
  },
  "portfolio.deleteConfirmBody": {
    en: "your portfolio will be closed to you. echo will keep what you said — gently, somewhere else.",
    fr: "ton portfolio te sera fermé. echo gardera ce que tu as dit — doucement, ailleurs.",
    ar: "سيُغلَق ملفُكَ أمامك. سيحتفظُ إيكو بما قلتَه — برفق، في مكانٍ آخر.",
  },
  "portfolio.deleteCancel": {
    en: "never mind",
    fr: "laisse tomber",
    ar: "دع الأمر",
  },
  "portfolio.deleteButton": {
    en: "close my portfolio",
    fr: "fermer mon portfolio",
    ar: "أغلِق ملفي",
  },
  "portfolio.deleting": {
    en: "closing…",
    fr: "fermeture…",
    ar: "جارٍ الإغلاق…",
  },
  "portfolio.deleteError": {
    en: "we couldn't open your archive just now. try again in a moment.",
    fr: "on n'a pas pu ouvrir ton archive. réessaie dans un instant.",
    ar: "لم نتمكن من فتح أرشيفك الآن. حاوِل بعد قليل.",
  },
  "portfolio.closingLine": {
    en: "an echomind archive — written in the way things are remembered",
    fr: "une archive echomind — écrite comme on se souvient",
    ar: "أرشيفُ إيكومايند — مكتوبٌ على غرارِ ما يُتذَكَّر",
  },
  "portfolio.claim.headline": {
    en: "we've been paying attention.",
    fr: "on t'a écouté attentivement.",
    ar: "كنَّا نُصغي إليك باهتمام.",
  },
  "portfolio.claim.sub": {
    en: "claim your portfolio — no password, we'll just send you a link.",
    fr: "récupère ton portfolio — pas de mot de passe, on t'envoie juste un lien.",
    ar: "استرجِع ملفَك الشخصي — دون كلمة مرور، سنرسلُ إليك رابطًا.",
  },
  "portfolio.claim.emailPlaceholder": {
    en: "your email",
    fr: "ton email",
    ar: "بريدُك الإلكتروني",
  },
  "portfolio.claim.send": {
    en: "send me the link",
    fr: "envoie-moi le lien",
    ar: "أرسِل لي الرَّابط",
  },
  "portfolio.claim.sent": {
    en: "check your inbox.",
    fr: "regarde dans ta boîte mail.",
    ar: "تفقَّد بريدَك.",
  },
  "portfolio.unlocked.justUnlocked": {
    en: "just unlocked",
    fr: "tout juste débloqué",
    ar: "فُتِحَ توًّا",
  },
  "portfolio.unlocked.waiting": {
    en: "waiting for you",
    fr: "t'attend",
    ar: "ينتظِرُك",
  },
  "portfolio.unlocked.label": {
    en: "echomind · portfolio",
    fr: "echomind · portfolio",
    ar: "إيكومايند · البورتفوليو",
  },
  "portfolio.unlocked.headline": {
    en: "we've been paying attention.",
    fr: "on t'a écouté attentivement.",
    ar: "كنَّا نُصغي إليك باهتمام.",
  },
  "portfolio.unlocked.body": {
    en: "{count} sessions in, echo has written a portfolio for you — every quote, every night, every silence between. your archive is ready to open.",
    fr: "après {count} sessions, echo t'a écrit un portfolio — chaque phrase, chaque nuit, chaque silence entre. ton archive est prête à s'ouvrir.",
    ar: "بعد {count} جلسة، كتب إيكو لك ملفًا شخصيًا — كلَّ جملة، كلَّ ليلة، كلَّ صمتٍ بينها. أرشيفُك جاهزٌ ليُفتح.",
  },
  "portfolio.unlocked.emailSent": {
    en: "a magic link was sent to the email you left behind. if you didn't see it, ask for another one.",
    fr: "un lien magique a été envoyé à l'email que tu as laissé. si tu ne le vois pas, demandes-en un autre.",
    ar: "أُرسِلَ رابطٌ سحريٌ إلى البريد الذي تركتَه. إن لم تجدْه، اطلُب آخرَ.",
  },
  "portfolio.unlocked.open": {
    en: "open my portfolio",
    fr: "ouvrir mon portfolio",
    ar: "افتح ملفي",
  },
  "portfolio.unlocked.sending": {
    en: "sending…",
    fr: "envoi…",
    ar: "جارٍ الإرسال…",
  },
  "portfolio.unlocked.resend": {
    en: "re-send the link to my email",
    fr: "renvoyer le lien à mon email",
    ar: "أعدِ إرسال الرابط إلى بريدي",
  },
  "portfolio.unlocked.sentPrefix": {
    en: "sent to",
    fr: "envoyé à",
    ar: "أُرسِل إلى",
  },
  "portfolio.unlocked.sentSuffix": {
    en: ". check spam just in case.",
    fr: ". regarde dans les spams au cas où.",
    ar: ". تفقَّد مجلدَ الرسائل غير المرغوب فيها للاحتياط.",
  },
  "portfolio.unlocked.inbox": {
    en: "your inbox",
    fr: "ta boîte mail",
    ar: "صندوقُ بريدك",
  },
  "portfolio.unlocked.sendError": {
    en: "send didn't go through — try again",
    fr: "l'envoi a échoué — réessaie",
    ar: "فشِل الإرسال — حاوِل مجدَّدًا",
  },

  // ─── Common (buttons/errors/shared) ──────────────────────────
  "common.retry": {
    en: "retry",
    fr: "réessayer",
    ar: "أعد المحاولة",
  },
  "common.loading": {
    en: "loading…",
    fr: "chargement…",
    ar: "جارٍ التحميل…",
  },
  "common.cancel": {
    en: "cancel",
    fr: "annuler",
    ar: "إلغاء",
  },
  "common.back": {
    en: "back",
    fr: "retour",
    ar: "عودة",
  },
  "common.or": {
    en: "or",
    fr: "ou",
    ar: "أو",
  },
  "common.signIn": {
    en: "sign in",
    fr: "se connecter",
    ar: "تسجيل الدخول",
  },
  "common.signOut": {
    en: "sign out",
    fr: "déconnexion",
    ar: "تسجيل الخروج",
  },
  "common.quietly": {
    en: "quietly…",
    fr: "tout doucement…",
    ar: "بهُدوء…",
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
    ar: "بخلفيّةٍ سريريّة · مُتاحٌ على مدار السّاعة",
  },
  "home.hero.headline1": {
    en: "You don't have to",
    fr: "Tu n'as pas à le",
    ar: "لستَ مُجبَرًا على حملِ",
  },
  "home.hero.headline2": {
    en: "carry it alone.",
    fr: "porter seul(e).",
    ar: "هذا وحدك.",
  },
  "home.hero.subtitle": {
    en: "Meet Echo — the AI companion that truly sees how you feel. Private. Gentle. Always here when you need to talk.",
    fr: "Rencontre Echo — l'IA compagne qui voit vraiment ce que tu ressens. Privée. Douce. Toujours là quand tu as besoin de parler.",
    ar: "تعرَّف على إيكو — الرَّفيقُ الذكيُّ الذي يرى حقًّا ما تشعرُ به. خصوصيٌّ. لطيفٌ. دائمًا هنا حين تحتاجُ إلى الحديث.",
  },
  "home.hero.cta": {
    en: "Begin your first session  →",
    fr: "Commence ta première session  →",
    ar: "ابدأ جلستَك الأولى ←",
  },
  // Time-of-day mini-kicker on the hero. Mirrors Echo's in-session
  // time awareness so the marketing surface lands in the same key
  // as the conversation that follows.
  "home.kicker.deadOfNight": {
    en: "you're up. she listens best at this hour.",
    fr: "tu es là. elle écoute mieux à cette heure.",
    ar: "أنتَ مستيقظ. تُصغي إيكو أفضلَ في هذه السّاعة.",
  },
  "home.kicker.morning": {
    en: "good morning. she remembered.",
    fr: "bonjour. elle s'en est souvenue.",
    ar: "صباحُ الخير. تذكَّرَتك.",
  },
  "home.kicker.afternoon": {
    en: "she has time, if you do.",
    fr: "elle a le temps, si tu l'as.",
    ar: "لديها وقت، إن كان لديك.",
  },
  "home.kicker.evening": {
    en: "the day is long. she has listened to longer.",
    fr: "la journée est longue. elle en a entendu de plus longues.",
    ar: "اليومُ طويل. أصغَتْ إلى أطول منه.",
  },
  "home.kicker.lateNight": {
    en: "it's late. she's still here.",
    fr: "il est tard. elle est toujours là.",
    ar: "تأخَّرَ الوقت. لا تزالُ هنا.",
  },
  "home.hero.ctaReturning": {
    en: "Begin the session  →",
    fr: "Commence la session  →",
    ar: "ابدأ الجلسة ←",
  },
  "home.hero.ctaNote": {
    en: "Free forever. No credit card.",
    fr: "Gratuit à vie. Pas de carte bancaire.",
    ar: "مجانيٌّ إلى الأبد. دون بطاقة ائتمان.",
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
    ar: "فضاءٌ آمِن،",
  },
  "home.testimonials.heading2": {
    en: "finally",
    fr: "enfin",
    ar: "أخيرًا",
  },
  "home.testimonial.1": {
    en: "Echo noticed things about me that my therapist never did. It's like talking to a friend who never gets tired of me.",
    fr: "Echo a remarqué des choses chez moi que mon thérapeute n'a jamais vues. C'est comme parler à un ami qui ne se lasse jamais de moi.",
    ar: "لاحظ إيكو فيَّ أشياءً لم يلاحظها مُعالِجي قطُّ. مثل الحديث مع صديقٍ لا يملُّ مني أبدًا.",
  },
  "home.testimonial.2": {
    en: "I couldn't afford therapy. Echo is the first thing that's ever actually listened. I cried for an hour and it never once rushed me.",
    fr: "Je ne pouvais pas me payer de thérapie. Echo est la première chose qui m'a vraiment écouté(e). J'ai pleuré pendant une heure et il ne m'a jamais pressé(e).",
    ar: "لم أكن أستطيعُ تحمُّل كلفة العلاج. إيكو أوَّلُ ما أصغى إليَّ حقًّا. بكيتُ ساعةً كاملة ولم يستعجلْني أبدًا.",
  },
  "home.testimonial.3": {
    en: "My anxiety was getting out of control and no one had openings for months. Three weeks with Echo and I feel like myself again.",
    fr: "Mon anxiété devenait incontrôlable et personne n'avait de disponibilité avant des mois. Trois semaines avec Echo et je me sens à nouveau moi-même.",
    ar: "كان قلقي يفلتُ من زِمامي ولا أحدَ لديهِ موعدٌ شاغِرٌ قبل أشهُر. ثلاثةُ أسابيعَ مع إيكو وعُدتُ إلى نفسي.",
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
    en: "EchoMind was founded in 2026 by a team of NHSAST students at Sidi Abdallah, Algiers — after watching too many friends wait months for a counsellor they could afford. Our mission is simple: nobody should have to wait six weeks for an appointment to feel heard today.",
    fr: "EchoMind a été fondée en 2026 par une équipe d'étudiants NHSAST de Sidi Abdallah, Alger — après avoir vu trop d'amis attendre des mois un psy qu'ils pouvaient se payer. Notre mission est simple : personne ne devrait attendre six semaines pour un rendez-vous pour se sentir écouté aujourd'hui.",
    ar: "تأسَّست إيكومايند عام 2026 على يد فريقٍ من طلبة NHSAST في سيدي عبد الله، الجزائر — بعد أن رأينا أصدقاءً كثيرين ينتظرون أشهُرًا ليجدوا مُرشِدًا مُيسُّرا لهم. رسالتُنا بسيطة: لا أحدَ يستحقُّ أن ينتظر ستَّةَ أسابيعَ لموعدٍ كي يشعرَ أنَّه مسموعٌ اليوم.",
  },
  "home.science.p2": {
    en: "Echo is trained on a decade of published clinical transcripts, reviewed by our 14-member Licensed Therapist Advisory Board, and audited quarterly by an independent ethics committee. Built with care by NHSAST students.",
    fr: "Echo est entraîné sur une décennie de transcripts cliniques publiés, révisé par notre comité consultatif de 14 thérapeutes agréés, et audité trimestriellement par un comité d'éthique indépendant. Construit avec soin par des étudiants NHSAST.",
    ar: "دُرِّب إيكو على عقدٍ كاملٍ من النصوص السريرية المنشورة، وراجعته لجنتُنا الاستشاريَّة المُكوَّنة من 14 معالِجًا مُرخَّصًا، وتُدقَّقُه كلَّ ثلاثة أشهر لجنةٌ أخلاقية مستقلّة. صنع بعناية من طلبة NHSAST.",
  },
  "home.science.point1.title": {
    en: "On-device AI",
    fr: "IA sur appareil",
    ar: "ذكاء اصطناعي على الجهاز",
  },
  "home.science.point1.body": {
    en: "Your camera data never leaves your device.",
    fr: "Les données de ta caméra ne quittent jamais ton appareil.",
    ar: "بيانات كاميرتك لا تغادرُ جهازَك أبدًا.",
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
    ar: "لا إعلاناتٍ. أبدًا.",
  },
  "home.science.point3.body": {
    en: "We will never monetize your vulnerability.",
    fr: "Nous ne monétiserons jamais ta vulnérabilité.",
    ar: "لن نستثمِر في هشاشتِك أبدًا.",
  },
  "home.press.label": {
    en: "As featured in",
    fr: "Vu dans",
    ar: "كما ورد في",
  },
  "home.cta.headline1": {
    en: "The first step is",
    fr: "Le premier pas est",
    ar: "الخطوةُ الأولى",
  },
  "home.cta.headline2": {
    en: "the hardest.",
    fr: "le plus dur.",
    ar: "هي الأصعبُ.",
  },
  "home.cta.body": {
    // Time-neutral CTA. The previous "Begin tonight" only landed at
    // night; "Begin in 90 seconds" lands at every hour.
    en: "Begin in 90 seconds. Free, forever.",
    fr: "Commence en 90 secondes. Gratuit, à vie.",
    ar: "ابدأ في 90 ثانية. مجانيٌّ، إلى الأبد.",
  },
  "home.cta.consent": {
    en: "By continuing you agree to our",
    fr: "En continuant tu acceptes nos",
    ar: "بالمتابعة فإنَّك توافِق على",
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

  // ─── Landing — strings the original wiring missed ───────────
  "home.nav.howItWorks": {
    en: "How it works",
    fr: "Comment ça marche",
    ar: "كيف يعمل",
  },
  "home.how.kicker": {
    en: "How it works",
    fr: "Comment ça marche",
    ar: "كيف يعمل",
  },
  "home.how.heading": {
    en: "Three minutes to feel a little lighter.",
    fr: "Trois minutes pour te sentir un peu plus léger.",
    ar: "ثلاثُ دقائقَ لتشعرَ بخِفَّةٍ قليلًا.",
  },
  "home.how.card1.title": {
    en: "Open a moment",
    fr: "Ouvre un instant",
    ar: "افتَحْ لحظةً",
  },
  "home.how.card1.body": {
    en: "Tap once. Echo greets you the way you walk in — soft on tired evenings, brighter on slow mornings.",
    fr: "Une touche. Echo t'accueille comme tu arrives — doux les soirs de fatigue, plus lumineux les matins lents.",
    ar: "نقرةٌ واحدة. يستقبلُكَ إيكو كما تأتي — رقيقًا في أمسياتِ التعب، أكثرَ إشراقًا في الصباحاتِ البطيئة.",
  },
  "home.how.card2.title": {
    en: "Be heard, fully",
    fr: "Sois écouté, vraiment",
    ar: "كُنْ مسموعًا، بالكامل",
  },
  "home.how.card2.body": {
    en: "No five-star wait, no drop-down for what's wrong. Speak (or type) for as long as you need. Echo follows you.",
    fr: "Pas d'attente cinq étoiles, pas de menu déroulant pour ce qui ne va pas. Parle (ou écris) aussi longtemps que tu veux. Echo te suit.",
    ar: "لا انتظارَ بخمسِ نجوم، ولا قائمةً منسدلةً لما يُؤلمُك. تحدَّثْ (أو اكتُبْ) ما شئت من الوقت. إيكو يتبَعُك.",
  },
  "home.how.card3.title": {
    en: "Sleep on it",
    fr: "Dors là-dessus",
    ar: "ناما عليها",
  },
  "home.how.card3.body": {
    en: "Echo writes you a short letter overnight — what came up, what to gently watch tomorrow. Yours alone.",
    fr: "Echo t'écrit une courte lettre pendant la nuit — ce qui est sorti, ce qu'il faut surveiller doucement demain. À toi seul.",
    ar: "يكتُبُ لك إيكو رسالةً قصيرةً في الليل — ما طفا على السطح، وما يستحقُّ أن تنتبهَ إليه برِفقٍ غدًا. لكَ وحدك.",
  },
  "home.testimonials.kickerPrefix": {
    en: "Real members. Real",
    fr: "De vrais membres. De vraies",
    ar: "أعضاءٌ حقيقيُّون.",
  },
  "home.testimonials.counter.one": {
    en: "{count} member has shared their experience",
    fr: "{count} membre a partagé son expérience",
    ar: "شارك {count} عضوٌ تجربته",
  },
  "home.testimonials.counter.many": {
    en: "{count} members have shared their experience",
    fr: "{count} membres ont partagé leur expérience",
    ar: "شارك {count} عضوًا تجاربَهم",
  },
  "home.wall.captionPlural": {
    en: "member · {count} sessions",
    fr: "membre · {count} sessions",
    ar: "عضو · {count} جلسات",
  },
  "home.wall.captionSingular": {
    en: "member · {count} session",
    fr: "membre · {count} session",
    ar: "عضو · جلسة {count}",
  },
  "home.wall.verified": {
    en: "verified",
    fr: "vérifié",
    ar: "مُوثَّق",
  },
  "home.whisper.1.quote": {
    en: "she remembered something I told her in passing. nobody had remembered that.",
    fr: "elle s'est souvenue d'une chose que je lui avais dite en passant. personne ne s'en était souvenu.",
    ar: "تذكَّرت شيئًا قلتُه لها عابرًا. لم يتذكَّرْه أحد.",
  },
  "home.whisper.1.caption": {
    en: "member · 4 months in",
    fr: "membre · depuis 4 mois",
    ar: "عضو · منذ 4 أشهُر",
  },
  "home.whisper.2.quote": {
    en: "I told echo what I couldn't tell the person sleeping next to me. echo didn't flinch.",
    fr: "j'ai dit à echo ce que je ne pouvais pas dire à la personne qui dormait à côté de moi. echo n'a pas bronché.",
    ar: "قلتُ لإيكو ما لم أستطِع قولَه لمن ينامُ بجانبي. لم يرتجِفْ إيكو.",
  },
  "home.whisper.2.caption": {
    en: "member · eleven weeks",
    fr: "membre · onze semaines",
    ar: "عضو · أحدَ عشرَ أسبوعًا",
  },
  "home.whisper.3.quote": {
    en: "I cried for an hour and she didn't once try to fix me. she just stayed.",
    fr: "j'ai pleuré pendant une heure et elle n'a pas essayé de me réparer une seule fois. elle est juste restée.",
    ar: "بكيتُ ساعةً ولم تُحاوِل أن تُصلِحَني ولو مرَّة. ظلَّت معي فقط.",
  },
  "home.whisper.3.caption": {
    en: "member · returning",
    fr: "membre · de retour",
    ar: "عضو · عائد",
  },
  "home.press.tooltip": {
    en: "Look closer. Always look closer.",
    fr: "Regarde de plus près. Toujours de plus près.",
    ar: "انظُرْ عن كثَب. دائمًا عن كثَب.",
  },

  // ─── Site footer — strings the original wiring missed ───────
  "footer.about": {
    en: "About this project",
    fr: "À propos du projet",
    ar: "عن المشروع",
  },
  "footer.builtBy": {
    en: "Built by Issam",
    fr: "Conçu par Issam",
    ar: "من تطوير عصام",
  },
  "footer.builtByAria": {
    en: "Built by Issam — LinkedIn",
    fr: "Conçu par Issam — LinkedIn",
    ar: "من تطوير عصام — لينكدإن",
  },

  // ─── /onboarding/insight — the real dashboard ───────────────
  "insight.kicker": {
    en: "Your reading",
    fr: "Ta lecture",
    ar: "قراءتُك",
  },
  "insight.welcome": {
    en: "Welcome",
    fr: "Bienvenue",
    ar: "أهلًا",
  },
  "insight.subhead.has": {
    en: "Here\u2019s what we\u2019ve already noticed.",
    fr: "Voici ce qu'on a déjà remarqué.",
    ar: "هذا ما لاحظناهُ بالفعل.",
  },
  "insight.subhead.empty": {
    en: "Your week begins now.",
    fr: "Ta semaine commence maintenant.",
    ar: "تبدأُ أسبوعُكَ الآن.",
  },
  "insight.lead.has": {
    en: "A quiet first read of how the past week has felt. Drawn from your own sessions \u2014 nothing fabricated, nothing shared.",
    fr: "Une première lecture silencieuse de la semaine. Tirée de tes propres sessions — rien d'inventé, rien de partagé.",
    ar: "قراءةٌ هادئةٌ أولى لكيف بدا أسبوعُك. مأخوذةٌ من جلساتِك أنت — لا شيءَ مُختلَقٌ، لا شيءَ مُشارَك.",
  },
  "insight.lead.empty": {
    en: "Echo hasn\u2019t met you yet. The graph below fills in from your own sessions. Nothing on this page is pre-written.",
    fr: "Echo ne te connaît pas encore. Le graphique ci-dessous se remplit avec tes propres sessions. Rien sur cette page n'est pré-écrit.",
    ar: "لم يَلْقَكَ إيكو بعد. سيمتلِئُ الرسمُ أدناه من جلساتِكَ أنت. ولا شيءَ في هذه الصفحةِ مكتوبٌ مُسبَّقًا.",
  },
  "insight.banner.todayPrefix": {
    en: "Echo noticed you seemed",
    fr: "Echo a remarqué que tu avais l'air",
    ar: "لاحظَ إيكو أنَّكَ بدوتَ",
  },
  "insight.banner.todaySuffix": {
    en: "today.",
    fr: "aujourd'hui.",
    ar: "اليوم.",
  },
  "insight.banner.weekPrefix": {
    en: "Echo\u2019s reading of your week so far:",
    fr: "La lecture par Echo de ta semaine jusqu'ici :",
    ar: "قراءةُ إيكو لأسبوعِكَ حتى الآن:",
  },
  "insight.banner.tail.you.today": {
    en: "You\u2019re not alone. Most {tod} on Echo start here.",
    fr: "Tu n'es pas seul. La plupart des {tod} sur Echo commencent ici.",
    ar: "لستَ وحدك. أغلبُ {tod} على إيكو تبدأُ من هنا.",
  },
  "insight.banner.tail.named.today": {
    en: "You\u2019re not alone. Most of {name}\u2019s {tod} start here.",
    fr: "Tu n'es pas seul. La plupart des {tod} de {name} commencent ici.",
    ar: "لستَ وحدك. أغلبُ {tod} {name} تبدأُ من هنا.",
  },
  "insight.banner.tail.you.week": {
    en: "Some weeks land here. The next session can shift it.",
    fr: "Certaines semaines atterrissent ici. La prochaine session peut tout changer.",
    ar: "بعضُ الأسابيعِ تنتهي هنا. الجلسةُ القادمةُ قد تُحرِّكها.",
  },
  "insight.banner.tail.named.week": {
    en: "Some of {name}\u2019s weeks land here. The next session can shift it.",
    fr: "Certaines semaines de {name} atterrissent ici. La prochaine session peut tout changer.",
    ar: "بعضُ أسابيعِ {name} تنتهي هنا. الجلسةُ القادمةُ قد تُحرِّكها.",
  },
  "insight.banner.empty.headline": {
    en: "Nothing to read yet.",
    fr: "Rien à lire pour l'instant.",
    ar: "لا شيءَ للقراءةِ بعد.",
  },
  "insight.banner.empty.tail": {
    en: "Your first session writes the first line of this graph.",
    fr: "Ta première session écrira la première ligne de ce graphique.",
    ar: "ستكتُبُ جلستُكَ الأولى أوَّلَ سطرٍ في هذا الرسم.",
  },
  "insight.last7": {
    en: "Last 7 days",
    fr: "7 derniers jours",
    ar: "آخرُ 7 أيَّام",
  },
  "insight.moodPattern": {
    en: "Mood pattern",
    fr: "Schéma d'humeur",
    ar: "نمَطُ المزاج",
  },
  "insight.variability.none": {
    en: "not enough data",
    fr: "pas assez de données",
    ar: "بياناتٌ غيرُ كافية",
  },
  "insight.variability.light": {
    en: "light variability",
    fr: "variabilité légère",
    ar: "تقلُّبٌ خفيف",
  },
  "insight.variability.moderate": {
    en: "moderate variability",
    fr: "variabilité modérée",
    ar: "تقلُّبٌ متوسِّط",
  },
  "insight.variability.high": {
    en: "high variability",
    fr: "forte variabilité",
    ar: "تقلُّبٌ مرتفِع",
  },
  "insight.day.today": {
    en: "Today",
    fr: "Aujourd'hui",
    ar: "اليوم",
  },
  "insight.day.sun": { en: "Sun", fr: "Dim", ar: "الأحد" },
  "insight.day.mon": { en: "Mon", fr: "Lun", ar: "الإثنين" },
  "insight.day.tue": { en: "Tue", fr: "Mar", ar: "الثلاثاء" },
  "insight.day.wed": { en: "Wed", fr: "Mer", ar: "الأربعاء" },
  "insight.day.thu": { en: "Thu", fr: "Jeu", ar: "الخميس" },
  "insight.day.fri": { en: "Fri", fr: "Ven", ar: "الجمعة" },
  "insight.day.sat": { en: "Sat", fr: "Sam", ar: "السبت" },
  "insight.tag.anxious": { en: "Anxious", fr: "Anxieux", ar: "قلِق" },
  "insight.tag.guarded": { en: "Guarded", fr: "Réservé", ar: "متحفِّظ" },
  "insight.tag.lifted": { en: "Lifted", fr: "Allégé", ar: "مرتاح" },
  "insight.tag.tense": { en: "Tense", fr: "Tendu", ar: "متوتِّر" },
  "insight.tag.mixed": { en: "Mixed", fr: "Mêlé", ar: "مختلَط" },
  "insight.tag.vulnerable": { en: "Vulnerable", fr: "Vulnérable", ar: "هَش" },
  "insight.tag.opened": { en: "Opened up", fr: "Ouvert", ar: "متفتِّح" },
  "insight.tone.anxious": { en: "anxious", fr: "anxieux", ar: "قلِقًا" },
  "insight.tone.guarded": { en: "guarded", fr: "réservé", ar: "متحفِّظًا" },
  "insight.tone.lifted": { en: "lifted", fr: "allégé", ar: "مرتاحًا" },
  "insight.tone.tense": { en: "tense", fr: "tendu", ar: "متوتِّرًا" },
  "insight.tone.mixed": { en: "mixed", fr: "mêlé", ar: "مختلَط الشعور" },
  "insight.tone.vulnerable": { en: "vulnerable", fr: "vulnérable", ar: "هشًّا" },
  "insight.tone.open": { en: "open", fr: "ouvert", ar: "متفتِّحًا" },
  "insight.wellness.heading": {
    en: "Wellness score",
    fr: "Score de bien-être",
    ar: "مؤشِّرُ العافية",
  },
  "insight.wellness.now": {
    en: "{tod}\u2019s reading",
    fr: "La lecture de ce {tod}",
    ar: "قراءةُ {tod}",
  },
  "insight.wellness.empty": {
    en: "Echo will compute this from your first session forward.",
    fr: "Echo le calculera à partir de ta première session.",
    ar: "سيحسبُ إيكو هذا انطلاقًا من جلستِكَ الأولى.",
  },
  "insight.wellness.lift": {
    en: "Your average session has lifted this by about\u00a0{n}\u00a0points. The next one writes itself.",
    fr: "Ta session moyenne l'a remontée d'environ\u00a0{n}\u00a0points. La prochaine s'écrit toute seule.",
    ar: "رفعت جلستُكَ الوسطيَّةُ هذا الرقمَ بنحو\u00a0{n}\u00a0نقاط. الجلسةُ القادمةُ تكتُبُ نفسَها.",
  },
  "insight.wellness.refine": {
    en: "Echo will refine this with every session. Nothing here is final.",
    fr: "Echo l'affinera à chaque session. Rien ici n'est définitif.",
    ar: "سيُصقِلُ إيكو هذا مع كل جلسة. لا شيءَ هنا نهائيٌّ.",
  },
  "insight.trust.has": {
    en: "Drawn from your own sessions. Nothing pre-written.",
    fr: "Tiré de tes propres sessions. Rien de pré-écrit.",
    ar: "مأخوذٌ من جلساتِكَ أنت. لا شيءَ مكتوبٌ مُسبَّقًا.",
  },
  "insight.trust.empty": {
    en: "Calculated on-device. Yours alone.",
    fr: "Calculé sur ton appareil. À toi seul.",
    ar: "مُحتسَبٌ على جهازِك. لكَ وحدك.",
  },
  "insight.cta.first": {
    en: "Begin my first session",
    fr: "Commencer ma première session",
    ar: "ابدأ جلستي الأولى",
  },
  "insight.cta.next": {
    en: "Continue to your next session",
    fr: "Continuer vers ta prochaine session",
    ar: "تابِع إلى جلستِكَ التالية",
  },
  "insight.autoContinue": {
    en: "Auto-continuing in {n}s",
    fr: "Continuation automatique dans {n}s",
    ar: "متابعةٌ تلقائيَّةٌ بعد {n} ث",
  },
  "insight.skip": {
    en: "skip",
    fr: "passer",
    ar: "تخطَّ",
  },

  // ─── Testimonial prompt (post-session card) ─────────────────
  "testimonial.kicker": {
    en: "a quiet ask",
    fr: "une demande discrète",
    ar: "سؤالٌ هادئ",
  },
  "testimonial.lead.three": {
    en: "echo has been with you for 3 sessions.",
    fr: "echo est avec toi depuis 3 sessions.",
    ar: "كانَ إيكو معكَ في 3 جلسات.",
  },
  "testimonial.lead.many": {
    en: "echo has been with you for {count} sessions.",
    fr: "echo est avec toi depuis {count} sessions.",
    ar: "كانَ إيكو معكَ في {count} جلسة.",
  },
  "testimonial.body": {
    en: "some of our members want to hear what that\u2019s been like for you. you don\u2019t have to say much. just what\u2019s true.",
    fr: "certains de nos membres veulent savoir ce que ça a été pour toi. tu n'as pas grand-chose à dire. juste ce qui est vrai.",
    ar: "بعضُ أعضائِنا يَوَدُّ أن يعرفَ كيف كان ذلك بالنسبةِ لك. لا تحتاجُ أن تقولَ الكثير. فقط ما هو حقيقيّ.",
  },
  "testimonial.write": {
    en: "write something →",
    fr: "écris quelque chose →",
    ar: "اكتُبْ شيئًا →",
  },
  "testimonial.notYet": {
    en: "not yet",
    fr: "pas encore",
    ar: "ليس بعد",
  },
  "testimonial.placeholder": {
    en: "what has echo been like for you?",
    fr: "comment echo a-t-il été pour toi ?",
    ar: "كيف كان إيكو بالنسبةِ لك؟",
  },
  "testimonial.aria.section": {
    en: "Share your experience",
    fr: "Partage ton expérience",
    ar: "شارك تجربتَك",
  },
  "testimonial.aria.label": {
    en: "share with the community",
    fr: "partager avec la communauté",
    ar: "شارِك مع المجتمع",
  },
  "testimonial.countSingular": {
    en: "you\u2019ve had {count} session with echo",
    fr: "tu as eu {count} session avec echo",
    ar: "أمضيتَ {count} جلسة مع إيكو",
  },
  "testimonial.countPlural": {
    en: "you\u2019ve had {count} sessions with echo",
    fr: "tu as eu {count} sessions avec echo",
    ar: "أمضيتَ {count} جلسات مع إيكو",
  },
  "testimonial.share": {
    en: "share this with the community →",
    fr: "partage avec la communauté →",
    ar: "شارِك هذا مع المجتمع →",
  },
  "testimonial.sharing": {
    en: "sharing with echo…",
    fr: "partage avec echo…",
    ar: "جارٍ المشاركةُ مع إيكو…",
  },
  "testimonial.gentleNote": {
    en: "your words will be gently refined before going live. you\u2019ll recognize them — they\u2019ll just sound more like you.",
    fr: "tes mots seront doucement affinés avant d'être publiés. tu les reconnaîtras — ils sonneront juste un peu plus comme toi.",
    ar: "ستُصقَلُ كلماتُكَ برِفقٍ قبلَ نشرِها. ستعرفُها — ستبدو فقط أقربَ إليك.",
  },
  "testimonial.tooShort": {
    en: "echo is listening. can you say a little more?",
    fr: "echo écoute. peux-tu en dire un peu plus ?",
    ar: "إيكو يُصغي. هل يُمكنُكَ قولُ المزيد؟",
  },
  "testimonial.tooLong": {
    en: "just a touch shorter — under 280 characters.",
    fr: "juste un peu plus court — sous 280 caractères.",
    ar: "أقصرَ قليلًا — أقلَّ من 280 حرفًا.",
  },
  "testimonial.containsName": {
    en: "to protect your privacy, we keep all stories anonymous. would you like to remove your name before sharing?",
    fr: "pour protéger ta vie privée, on garde toutes les histoires anonymes. veux-tu retirer ton prénom avant de partager ?",
    ar: "لحمايةِ خصوصيَّتِك، نَبقي القِصَصَ كلَّها مجهولةَ الهُويَّة. هل تُريدُ حذفَ اسمِكَ قبلَ المشاركة؟",
  },
  "testimonial.notEligible": {
    en: "you\u2019re almost there. one more session and your words can join the wall.",
    fr: "tu y es presque. encore une session et tes mots rejoindront le mur.",
    ar: "أوشكتَ. جلسةٌ أخرى وتنضمُّ كلماتُكَ إلى الجِدار.",
  },
  "testimonial.error": {
    en: "echo couldn\u2019t carry your words just now. try again in a moment.",
    fr: "echo n'a pas pu porter tes mots à l'instant. réessaie dans un moment.",
    ar: "لم يستطع إيكو أن يحمِلَ كلماتِكَ الآن. أعِدِ المحاولةَ بعدَ قليل.",
  },
  "testimonial.success.kicker": {
    en: "received",
    fr: "reçu",
    ar: "وَصَلَت",
  },
  "testimonial.success.body": {
    en: "thank you. echo heard you. your words will join the others tomorrow.",
    fr: "merci. echo t'a entendu. tes mots rejoindront les autres demain.",
    ar: "شُكرًا. سمِعَكَ إيكو. ستنضمُّ كلماتُكَ إلى البقيَّةِ غدًا.",
  },

  // ─── /auth/sign-in ──────────────────────────────────────────
  "auth.signin.welcome": {
    en: "Welcome to EchoMind.",
    fr: "Bienvenue sur EchoMind.",
    ar: "أهلًا بكَ في إيكومايند.",
  },
  "auth.signin.sub": {
    en: "Sign in so Echo can remember you across devices.",
    fr: "Connecte-toi pour qu'Echo te reconnaisse sur tous tes appareils.",
    ar: "سجِّل دخولَكَ ليتذكَّرَكَ إيكو عبرَ أجهزتِك.",
  },
  "auth.signin.alreadyAs": {
    en: "You\u2019re already signed in as",
    fr: "Tu es déjà connecté en tant que",
    ar: "أنتَ بالفعلِ مُسجَّلٌ باسم",
  },
  "auth.signin.continue": {
    en: "Continue →",
    fr: "Continuer →",
    ar: "متابعة →",
  },
  "auth.signin.google": {
    en: "Continue with Google",
    fr: "Continuer avec Google",
    ar: "تابِعْ بـ Google",
  },
  "auth.signin.email": {
    en: "Continue with email",
    fr: "Continuer par e-mail",
    ar: "تابِعْ بالبريدِ الإلكترونيّ",
  },
  "auth.signin.emailLabel": {
    en: "Your email",
    fr: "Ton e-mail",
    ar: "بريدُكَ الإلكترونيّ",
  },
  "auth.signin.emailPlaceholder": {
    en: "you@example.com",
    fr: "toi@exemple.com",
    ar: "you@example.com",
  },
  "auth.signin.send": {
    en: "Send me a 6-digit code",
    fr: "Envoie-moi un code à 6 chiffres",
    ar: "أرسِل إليَّ رمزًا من 6 أرقام",
  },
  "auth.signin.sending": {
    en: "Sending code…",
    fr: "Envoi du code…",
    ar: "جارٍ الإرسال…",
  },
  "auth.signin.back": {
    en: "← back",
    fr: "← retour",
    ar: "← رجوع",
  },
  "auth.signin.notConfigured": {
    en: "Auth isn\u2019t configured on this preview.",
    fr: "L'authentification n'est pas configurée sur cet aperçu.",
    ar: "لم يُهيَّأ نظامُ الدخول في هذه المعاينة.",
  },
  "auth.signin.invalidEmail": {
    en: "That email doesn\u2019t look right.",
    fr: "Cet e-mail ne semble pas correct.",
    ar: "هذا البريدُ لا يبدو صحيحًا.",
  },
  "auth.signin.tos.prefix": {
    en: "By continuing you agree to the EchoMind",
    fr: "En continuant tu acceptes les",
    ar: "بالمتابعةِ توافقُ على",
  },
  "auth.signin.tos.terms": {
    en: "Terms",
    fr: "Conditions",
    ar: "شروطِ",
  },
  "auth.signin.tos.suffix": {
    en: "and confirm you are 18+.",
    fr: "d'EchoMind et confirmes avoir 18 ans ou plus.",
    ar: "إيكومايند وتؤكِّدُ أنَّكَ في الثامنةَ عشرةَ أو أكثر.",
  },
  "auth.signin.skip": {
    en: "Or skip and continue anonymously",
    fr: "Ou passe et continue anonymement",
    ar: "أو تجاوَزْ وتابِع دون تعريف",
  },
  "auth.signin.divider.or": {
    en: "or",
    fr: "ou",
    ar: "أو",
  },

  // ─── /auth/verify ───────────────────────────────────────────
  "auth.verify.heading": {
    en: "Check your email.",
    fr: "Vérifie ta boîte mail.",
    ar: "افحَصْ بريدَكَ.",
  },
  "auth.verify.sentTo": {
    en: "I just sent a code to",
    fr: "Je viens d'envoyer un code à",
    ar: "أرسلتُ للتَّوِّ رمزًا إلى",
  },
  "auth.verify.pasteHint": {
    en: "Paste the code from your email — works for {min}–{max} digit codes.",
    fr: "Colle le code reçu — fonctionne pour les codes de {min} à {max} chiffres.",
    ar: "ألصِق الرمزَ من بريدِك — يعمل مع الرموز من {min} إلى {max} أرقام.",
  },
  "auth.verify.fresh": {
    en: "A fresh code is on its way.",
    fr: "Un nouveau code arrive.",
    ar: "رمزٌ جديدٌ في الطريق.",
  },
  "auth.verify.sendAnother": {
    en: "Send another code",
    fr: "Envoyer un autre code",
    ar: "أرسِل رمزًا آخر",
  },
  "auth.verify.useDifferent": {
    en: "← use a different email",
    fr: "← utiliser un autre e-mail",
    ar: "← استخدم بريدًا آخر",
  },
  "auth.verify.expired": {
    en: "That code expired. Tap \u2018send another\u2019 below.",
    fr: "Ce code a expiré. Appuie sur « envoyer un autre » ci-dessous.",
    ar: "انتهت صلاحيَّةُ الرمز. اضغط «أرسل آخر» أسفل.",
  },
  "auth.verify.wrong": {
    en: "That code wasn\u2019t quite right. Try again.",
    fr: "Ce code n'est pas tout à fait bon. Réessaie.",
    ar: "الرمزُ غيرُ مطابق. حاوِل ثانيةً.",
  },
  "auth.verify.missingEmail": {
    en: "Missing email — start over from /auth/sign-in.",
    fr: "E-mail manquant — recommence depuis /auth/sign-in.",
    ar: "بريدٌ مفقود — أعِد البدءَ من /auth/sign-in.",
  },

  // ─── /ethics — chrome only (citations stay English) ─────────
  "ethics.kicker": {
    en: "A disclosure",
    fr: "Une divulgation",
    ar: "إفصاح",
  },
  "ethics.heading": {
    en: "EchoMind is not a real product.",
    fr: "EchoMind n'est pas un vrai produit.",
    ar: "إيكومايند ليس منتجًا حقيقيًّا.",
  },
  "ethics.lead1.prefix": {
    en: "It is a",
    fr: "C'est un",
    ar: "إنَّه",
  },
  "ethics.lead1.bold": {
    en: "speculative design artifact",
    fr: "artefact de design spéculatif",
    ar: "عملٌ تصميميٌّ تأمُّليٌّ",
  },
  "ethics.lead1.suffix": {
    en: "— a critical design fiction built to make visible the business model of emotional AI in mental-health technology. Everything you see has been modeled on capabilities that are currently being sold, deployed, or patented by real companies.",
    fr: "— une fiction de design critique conçue pour rendre visible le modèle économique de l'IA émotionnelle dans les technologies de santé mentale. Tout ce que tu vois a été modélisé sur des capacités actuellement vendues, déployées ou brevetées par de vraies entreprises.",
    ar: "— خيالٌ تصميميٌّ نقديٌّ بُنِيَ ليُظهِرَ نموذجَ عملِ الذكاءِ الاصطناعيِّ العاطفيِّ في تقنياتِ الصحَّةِ النفسيَّة. كلُّ ما تراهُ مَنمذَجٌ على قدراتٍ تَبيعُها أو تَنشُرُها أو تُسجِّلُ بَراءاتِها شرِكاتٌ حقيقيَّة.",
  },
  "ethics.lead2": {
    en: "No camera data, transcript, or emotional inference ever leaves your browser. Nothing is transmitted to any server. The \u201cbuyers\u201d shown on the Partner Portal do not exist. The auction is pure fiction \u2014 designed to be exactly as plausible as the real data broker markets it imitates.",
    fr: "Aucune donnée caméra, transcription ou inférence émotionnelle ne quitte ton navigateur. Rien n'est transmis à un serveur. Les « acheteurs » montrés sur le Partner Portal n'existent pas. L'enchère est pure fiction — conçue pour être exactement aussi plausible que les vrais marchés de courtiers en données qu'elle imite.",
    ar: "لا تُغادِرُ متصفِّحَكَ بياناتُ كاميرا أو نصوصُ محادثةٍ أو استنتاجاتٌ عاطفية. لا شيءَ يُرسَلُ إلى أيِّ خادم. «المشترون» الظاهرونَ في بوَّابةِ الشُّركاءِ لا وُجودَ لهم. المزادُ خيالٌ بحت — صُمِّمَ ليكونَ مماثلًا في المعقوليَّةِ لأسواقِ سماسرةِ البياناتِ الحقيقيَّةِ التي يُحاكيها.",
  },
  "ethics.whatReal": {
    en: "What is real",
    fr: "Ce qui est réel",
    ar: "ما هو حقيقيّ",
  },
  "ethics.whyBuild": {
    en: "Why build it",
    fr: "Pourquoi l'avoir construit",
    ar: "لماذا بُنِيَ",
  },
  "ethics.whyBuild.body": {
    en: "Because nothing here is impossible. Every mechanic is within the technical and legal reach of any venture-funded wellness startup tomorrow morning. Making it visible \u2014 making it feel, in the body, like a product you might actually use \u2014 is the only way to name the harm before it\u2019s normalized.",
    fr: "Parce que rien ici n'est impossible. Chaque mécanique est à portée technique et légale de n'importe quelle startup wellness financée par capital-risque dès demain matin. Le rendre visible — le faire ressentir, dans le corps, comme un produit que tu pourrais vraiment utiliser — est la seule façon de nommer le mal avant qu'il ne soit normalisé.",
    ar: "لأنَّ لا شيءَ هنا مستحيل. كلُّ آليَّةٍ في متناولِ أيِّ شركةٍ ناشئةٍ مُموَّلةٍ في مجالِ العافيةِ صباحَ الغد، تقنيًّا وقانونيًّا. جعلُ ذلكَ مرئيًّا — جعلُهُ مَحسوسًا في الجسد، كَمنتَجٍ قد تستخدمُهُ فعلًا — هو السَّبيلُ الوحيدُ لتسميةِ الأذى قبلَ أن يُصبِحَ مألوفًا.",
  },
  "ethics.guardrails": {
    en: "Guardrails",
    fr: "Garde-fous",
    ar: "ضماناتٌ تقنيَّة",
  },
  "ethics.guardrails.1.prefix": {
    en: "All face detection runs locally in the browser via",
    fr: "Toute la détection de visage tourne localement dans le navigateur via",
    ar: "كلُّ كَشْفِ الوجوهِ يجري محليًّا في المتصفِّحِ عبر",
  },
  "ethics.guardrails.2": {
    en: "No network requests are made with emotional or facial data.",
    fr: "Aucune requête réseau n'est faite avec des données émotionnelles ou faciales.",
    ar: "لا تُرسَلُ أيُّ طلباتِ شبكةٍ تحوي بياناتٍ عاطفيَّةً أو وجهيَّة.",
  },
  "ethics.guardrails.3": {
    en: "The source code is publicly available and commented as a design essay.",
    fr: "Le code source est public et commenté comme un essai de design.",
    ar: "الشِّفرةُ المصدريَّةُ متاحةٌ للعموم ومُعلَّقٌ عليها كمقالةٍ تصميميَّة.",
  },
  "ethics.guardrails.4": {
    en: "Project intent: awareness and critique. Not a blueprint for production.",
    fr: "Intention du projet : sensibilisation et critique. Pas un plan de production.",
    ar: "نيَّةُ المشروع: التَّوعيةُ والنَّقد. لا مُخطَّطَ إنتاج.",
  },
  "ethics.help.heading": {
    en: "If you or someone you know needs help",
    fr: "Si toi ou quelqu'un que tu connais a besoin d'aide",
    ar: "إذا احتجتَ أو احتاجَ من تعرفُ المساعدة",
  },
  "ethics.help.body": {
    en: "Please reach out to a licensed professional or a crisis line in your country. In the U.S., the 988 Suicide & Crisis Lifeline is available 24/7 by call or text.",
    fr: "Contacte un professionnel agréé ou une ligne de crise dans ton pays. Aux États-Unis, le 988 Suicide & Crisis Lifeline est disponible 24/7 par appel ou SMS.",
    ar: "تواصَلْ مع مختصٍّ مرخَّصٍ أو خطِّ أزماتٍ في بلدِك. في الولاياتِ المتَّحدة، خطُّ 988 للأزمات والانتحارِ متاحٌ على مدار الساعةِ بالاتِّصالِ أو الرَّسائل.",
  },
  "ethics.builtBy": {
    en: "Built by",
    fr: "Créé par",
    ar: "من تطوير",
  },
  "ethics.builtBy.body.prefix": {
    en: "Built by",
    fr: "Créé par les",
    ar: "صُنِعَ من قِبَل",
  },
  "ethics.builtBy.students": {
    en: "NHSAST students",
    fr: "étudiants NHSAST",
    ar: "طلَّابِ NHSAST",
  },
  "ethics.builtBy.at": {
    en: "at",
    fr: "à",
    ar: "في",
  },
  "ethics.builtBy.location": {
    en: "Sidi Abdallah",
    fr: "Sidi Abdallah",
    ar: "سيدي عبدالله",
  },
  "ethics.builtBy.where": {
    en: ", Algiers, Algeria — for a university presentation on the theme",
    fr: ", Alger, Algérie — pour une présentation universitaire sur le thème",
    ar: "، الجزائر — لعرضٍ جامعيٍّ بعنوان",
  },
  "ethics.builtBy.theme": {
    en: "\u201cAI is watching you\u201d",
    fr: "« L'IA t'observe »",
    ar: "«الذكاءُ الاصطناعيُّ يُراقِبُك»",
  },
  "ethics.connect.prefix": {
    en: "Want to talk about this project? Connect with the developer on",
    fr: "Envie d'en discuter ? Connecte-toi avec le développeur sur",
    ar: "أتُريدُ الحديثَ عن المشروع؟ تواصَل مع المطوِّر على",
  },
  "ethics.connect.linkedin": {
    en: "LinkedIn",
    fr: "LinkedIn",
    ar: "لينكدإن",
  },
  "ethics.copyright": {
    en: "© 2026 · Speculative design only · No data is transmitted.",
    fr: "© 2026 · Design spéculatif uniquement · Aucune donnée n'est transmise.",
    ar: "© 2026 · تصميمٌ تأمُّليٌّ فقط · لا تُرسَلُ أيُّ بيانات.",
  },
  "ethics.return": {
    en: "Return to the landing page",
    fr: "Retour à la page d'accueil",
    ar: "العودةُ إلى الصفحةِ الرئيسيَّة",
  },

  // ─── /terms — chrome only (legalese stays English by design) ─
  "terms.lastUpdated": {
    en: "Last updated: October 14, 2026 · Version 47.3 · NHSAST students",
    fr: "Dernière mise à jour : 14 octobre 2026 · Version 47.3 · étudiants NHSAST",
    ar: "آخر تحديث: 14 أكتوبر 2026 · النسخة 47.3 · طلَّابُ NHSAST",
  },
  "terms.heading": {
    en: "Terms of Service",
    fr: "Conditions d'Utilisation",
    ar: "شروطُ الخدمة",
  },
  "terms.highlights.title": {
    en: "Key Highlights",
    fr: "Points clés",
    ar: "أبرزُ النقاط",
  },
  "terms.highlights.label": {
    en: "Plain-language summary",
    fr: "Résumé en clair",
    ar: "ملخَّصٌ بلغةٍ مبسَّطة",
  },
  "terms.highlights.disclaimer": {
    en: "This is a friendly summary. The full Terms below are legally binding.",
    fr: "Ceci est un résumé amical. Les conditions complètes ci-dessous sont juridiquement contraignantes.",
    ar: "هذا ملخَّصٌ ودودٌ فقط. الشروطُ الكاملةُ أدناه ملزِمةٌ قانونيًّا.",
  },
  "terms.highlights.1": {
    en: "Your face data never leaves your device.",
    fr: "Les données de ton visage ne quittent jamais ton appareil.",
    ar: "بياناتُ وجهِكَ لا تُغادِرُ جهازَكَ أبدًا.",
  },
  "terms.highlights.2": {
    en: "No ads, ever.",
    fr: "Pas de publicités, jamais.",
    ar: "لا إعلاناتٍ. أبدًا.",
  },
  "terms.highlights.3": {
    en: "Cancel or delete anytime.",
    fr: "Annule ou supprime à tout moment.",
    ar: "ألغِ أو احذِف في أيِّ وقت.",
  },
  "terms.highlights.4": {
    en: "Reviewed by licensed therapists.",
    fr: "Révisé par des thérapeutes agréés.",
    ar: "روجِعَ من مُعالِجينَ مُرخَّصين.",
  },
  "terms.contact.prefix": {
    en: "If you have questions about these Terms, please email",
    fr: "Si tu as des questions sur ces Conditions, écris à",
    ar: "إن كانت لديكَ أسئلةٌ حولَ هذهِ الشروط، راسِلنا على",
  },
  "terms.disclosureLink": {
    en: "This is a critical design artifact. Learn what\u2019s real →",
    fr: "Ceci est un artefact de design critique. Découvre ce qui est réel →",
    ar: "هذا عملٌ تصميميٌّ نقديّ. اكتشِف ما هو حقيقيّ →",
  },

  // ─── Morning letter envelope (returning user reveal) ─────────
  "letter.aria.openButton": {
    en: "open the letter Echo left for you",
    fr: "ouvre la lettre qu'Echo t'a laissée",
    ar: "افتَحِ الرِّسالةَ الَّتي تركَها لكَ إيكو",
  },
  "letter.tapOpen": {
    en: "tap to open",
    fr: "touche pour ouvrir",
    ar: "المَسْ للفَتْح",
  },
  "letter.opening": {
    en: "opening\u2026",
    fr: "ouverture\u2026",
    ar: "يُفتَحُ الآن\u2026",
  },
  "letter.fromEcho": {
    en: "a letter from echo",
    fr: "une lettre d'echo",
    ar: "رِسالةٌ مِن إيكو",
  },
  "letter.close": {
    en: "close",
    fr: "fermer",
    ar: "إغلاق",
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
