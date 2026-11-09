// Content for "שעשועון השין".
// Sentence text rules:
//   - A word that starts with * has a שׂ (sin, sounds like ס). It is shown without the *
//     and is not counted or highlighted as a ש target.
//   - level: 1 = קל, 2 = בינוני, 3 = שלב בוס. Sentences the parent adds later get an
//     automatic level (see autoLevel in app.js).

window.SHIN_DATA = {
  // From the speech therapist's list (Nov 2026). Sentence 20 had an offensive word swapped
  // for "חששנים" (same sound load); the parent can change any sentence in the parent area.
  sentences: [
    { t: "האיש שלח קישוא שחור לראש ממשלת שוויץ.", e: "👨📦🥒➡️🇨🇭", l: 2 },
    { t: "השרלטן שקל ושיווק מישמישים מיובשים.", e: "🕴️⚖️🍑☀️", l: 2 },
    { t: "ביום ראשון בשבוע שעבר פלש בלש לשוק באשדוד.", e: "🕵️🔍🍉🛒", l: 2 },
    { t: "קשה לרכוש מכשירי שמיעה לשאולי.", e: "👴🦻🛍️", l: 1 },
    { t: "שלי ממש חירשת.", e: "👧🦻🔇", l: 1 },
    { t: "שירה ושי השיכור שתו שמונה כוסות שמפניה.", e: "👩🧑🥴🥂🍾", l: 3 },
    { t: "שני גרה ברח' שאול בירושלים.", e: "👧🏠📍🏙️", l: 1 },
    { t: "האיש *נישא לאישה כי מצאה חן בעיניו.", e: "🤵👰💍😍", l: 1 },
    { t: "השף לש בצק שמרים.", e: "👨‍🍳🥣🍞", l: 1 },
    { t: "ביום שישי הכנתי גנש עם שוקולד ושקדים.", e: "🍫🥄🌰😋", l: 1 },
    { t: "התקשרנו למכבי האש כי ראינו עשן מכיוון החורשה באשקלון.", e: "📞🚒🔥💨🌲", l: 2 },
    { t: "משונה מאד ששכחתי את השוקו בשוק.", e: "🤔🥛🍫🛒", l: 1 },
    { t: "בשבוע שעבר רכשתי שעון שוויצרי שעלה 500 ש\"ח.", e: "⌚🇨🇭💰", l: 2 },
    { t: "שושי שינתה את שמה לשירה וטסה לשוודיה עם שרשרת ששוקלת 700 גרם.", e: "👩✈️🇸🇪📿⚖️", l: 3 },
    { t: "שולה אפתה פשטידת קישואים משובחת.", e: "👩‍🍳🥧🥒⭐", l: 1 },
    { t: "מברשת השיניים שלי נשברה כשציחצחתי שיניים שלשום בשש.", e: "🪥💥🦷🕕", l: 3 },
    { t: "שמעתי שיר ישן של גבעת התחמושת בירושלים.", e: "🎵📻⛰️🏙️", l: 2 },
    { t: "דוד שלמה הוא שוטר ועובד במשמר האזרחי ברשפון.", e: "👨👮🚓🏘️", l: 2 },
    { t: "רכשתי בשוק מצרכים ובישלתי שקשוקה עם שום ושמיר.", e: "🛒🍳🍅🧄🌿", l: 2 },
    { t: "כ-60 קשישים חששנים מקוששים קרשים *בשקים מקושקשים.", e: "👵👴🪵🪵👜", l: 3 },
    { t: "שולה שלתה שבלולים בשלולית שבה שולה שולה שבלולים.", e: "👩🐌🐌💧", l: 3 },
    { t: "נחש נשך נחש. הנחש שנחש נשכו נחוש לנשוך הנחש שנשך אותו.", e: "🐍🐍😬", l: 3 },
    { t: "ישבתי ליד השולחן השחור ולשתי בצק שמרים.", e: "🪑🖤🥣🍞", l: 2 },
    { t: "התבקשתי משגריר חוף השנהב לשמור על המשפחה שלו ביום ראשון.", e: "🤵🌍🐘👨‍👩‍👧", l: 2 },
    { t: "רוטשילד ישב בישיבה בשנות השלושים במושבה זכרון.", e: "🎩🪑🏡🍇", l: 2 },
    { t: "שוב לא שקט שוב מתוח ורועש בשבלול.", e: "🐌🔊😵", l: 2 },
    { t: "ראש הממשלה שלנו ישב בראש השנה סביב השולחן ואכל דובשניות עם דבש.", e: "🏛️🍎🍯🍪", l: 3 },
    { t: "הנחש הכיש את שלומית ביום שבת.", e: "🐍👧🕯️", l: 1 },
    { t: "בפרשת השבוע פרשת קדושים היתה רשימה של רשעים מרושעים.", e: "📜📋😈😈", l: 3 },
    { t: "הפשוש המטופש שישב על עץ השסק שיגע את שולי השכנה.", e: "🐦🤪🌳🍊👩", l: 3 },
    { t: "שני השתלשלה לשם שעשוע על החבל שקשרה לראש העץ.", e: "👧🪢🌳😄", l: 2 },
    { t: "חששתי מכאב ראש בגלל השרב.", e: "🤕☀️🥵", l: 1 },
    { t: "הגשש השחום גר בראש העין.", e: "🕵️👣🏘️", l: 1 },
    { t: "אין לי שום אשליה שבחודש תשרי התקשורת שלנו תשתפר.", e: "📅🍂📡📈", l: 2 },
    { t: "מי שמקשיב יכול לשמוע את רשרוש ענפי הברוש שבחצר.", e: "👂🍃🌲🏡", l: 2 },
    { t: "איזה יאוש, אני ממש רואה מטושטש בשיעור ללא משקפים.", e: "😩👓🌫️🏫", l: 2 },
  ],

  // Minimal pairs for the listening game: same word except ש / ס.
  pairs: [
    { sh: "שִׁיר", s: "סִיר", shE: "🎵", sE: "🍲" },
    { sh: "שׁוֹד", s: "סוֹד", shE: "🦹", sE: "🤐" },
    { sh: "שִׁפּוּר", s: "סִפּוּר", shE: "📈", sE: "📖" },
    { sh: "נֶשֶׁר", s: "נֶסֶר", shE: "🦅", sE: "🪵" },
    { sh: "שׁוֹעֵר", s: "סוֹעֵר", shE: "🧤", sE: "⛈️" },
    { sh: "שִׁין", s: "סִין", shE: "ש", sE: "🇨🇳" },
  ],

  // Warm-up cards in front of the mirror. m = the mouth the puppy shows meanwhile.
  warmup: [
    { big: "😗", text: "שפתיים קדימה, כמו נשיקה לכלב.", sub: "מחזיקים 3 שניות ומרפים. עוד פעם!", m: "kiss" },
    { big: "🚂", text: "רכבת יוצאת לדרך: שששששששש", sub: "כמה זמן את מצליחה בלי לעצור?", m: "shh" },
    { big: "🤫", text: "שוקו ישן! משתיקים אותו: ששש!", sub: "בשקט, ואז קצת יותר חזק.", m: "shh" },
    { big: "שָׁ", text: "שָׁ · שׁוֹ · שִׁי · שׁוּ · שֶׁ", sub: "כל הברה עם שפתיים של נשיקה.", m: "shh" },
    { big: "אִישׁ", text: "אָשׁ · אוֹשׁ · אִישׁ · אוּשׁ · אֶשׁ", sub: "עכשיו ה-ש בסוף.", m: "shh" },
    { big: "🐶", text: "שוקו · שעון · שמש · שוקולד", sub: "מילים שמתחילות ב-ש.", m: "happy" },
  ],

  // Treats she earns (one per sentence try, and a few other ways) and feeds the puppy.
  // w = how often it drops, v = how much love it gives the puppy.
  treats: [
    { k: "bone", e: "🦴", w: 40, v: 1 },
    { k: "cookie", e: "🍪", w: 25, v: 1 },
    { k: "carrot", e: "🥕", w: 15, v: 1 },
    { k: "cheese", e: "🧀", w: 12, v: 1 },
    { k: "meat", e: "🍖", w: 8, v: 1 },
    { k: "cupcake", e: "🧁", w: 0, v: 3 }, // only for reaching the daily minutes
  ],

  // Tricks. Every command has a ש: she says it out loud and the puppy does the trick.
  tricks: [
    { id: "sit", cmd: "שֵׁב!", e: "🐕" },
    { id: "wave", cmd: "שָׁלוֹם!", e: "👋" },
    { id: "down", cmd: "שְׁכַב!", e: "🛏️" },
    { id: "kiss", cmd: "נְשִׁיקָה!", e: "😘" },
    { id: "shh", cmd: "שֶׁקֶט!", e: "🤫" },
    { id: "sing", cmd: "שִׁיר!", e: "🎵" },
    { id: "tongue", cmd: "לָשׁוֹן!", e: "👅" },
    { id: "roar", cmd: "שְׁאַג!", e: "🦁" },
    { id: "sleep", cmd: "לִישׁוֹן!", e: "💤" },
    { id: "sun", cmd: "שֶׁמֶשׁ!", e: "☀️" },
  ],

  // Dress-up items (drawn in pup.js). One item per slot.
  accessories: [
    { id: "bow", slot: "head", name: "פפיון", e: "🎀" },
    { id: "glasses", slot: "face", name: "משקפי שמש", e: "🕶️" },
    { id: "bandana", slot: "neck", name: "מטפחת", e: "🔻" },
    { id: "crown", slot: "head", name: "כתר", e: "👑" },
    { id: "partyhat", slot: "head", name: "כובע מסיבה", e: "🥳" },
    { id: "flower", slot: "head", name: "פרח", e: "🌸" },
    { id: "scarf", slot: "neck", name: "צעיף", e: "🧣" },
    { id: "tophat", slot: "head", name: "מגבעת", e: "🎩" },
    { id: "cape", slot: "back", name: "גלימה", e: "🦸" },
  ],

  // Fur and ear colours. The first baseColors are open from the start; the rest are prizes.
  colors: ["#C8874D", "#6B4226", "#E9B85B", "#F4ECDD", "#9A9CAE", "#3E3B4F", "#F6A9C6", "#B9A2FF", "#8EC9FF", "#86DDBF"],
  baseColors: 6,

  // What the puppy gets at each new level (level 1 first). Feeding treats fills the level bar.
  unlocks: [
    ["acc", "bow"], ["trick", "wave"], ["acc", "glasses"], ["trick", "down"], ["color", "#F6A9C6"],
    ["acc", "bandana"], ["trick", "kiss"], ["acc", "crown"], ["trick", "shh"], ["color", "#B9A2FF"],
    ["acc", "partyhat"], ["trick", "sing"], ["acc", "flower"], ["trick", "tongue"], ["color", "#8EC9FF"],
    ["acc", "scarf"], ["trick", "roar"], ["acc", "tophat"], ["trick", "sleep"], ["color", "#86DDBF"],
    ["acc", "cape"], ["trick", "sun"],
  ],

  // Funny voices for repeating a sentence again and again.
  voices: [
    ["🤫", "בלחישה סודית"],
    ["🤖", "כמו רובוט"],
    ["🦖", "כמו דינוזאור ענק"],
    ["🐭", "כמו עכבר קטנטן"],
    ["🎤", "כמו זמרת אופרה"],
    ["📺", "כמו קריינית חדשות"],
    ["🐶", "כמו שוקו הכלב"],
    ["🐢", "לאט לאט כמו צב"],
    ["👑", "כמו מלכה"],
    ["🧙", "כמו מכשפה"],
    ["👮", "כמו שוטר"],
    ["😗", "עם שפתיים של נשיקה"],
  ],
};
