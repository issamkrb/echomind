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
