/**
 * Everything the bot says, in one file.
 *
 * These are UI strings written by a developer, so they are hand-correct Uzbek
 * and linted by scripts/check-uzbek.mjs — the same rule that governs .astro
 * strings. Content Malika types is normalised instead; see
 * scripts/lib/normalize-uzbek.mjs.
 *
 * Tone: short, no jargon, no exclamation marks, and never a wall of options. She
 * is on a phone, usually between other things.
 */

export const T = {
  help: [
    'Men Malikaning blogi uchun yordamchiman.',
    '',
    '/yoz — yangi yozuv',
    '/qoralama — qoralamalar roʻyxati, birini nashr qilish',
    '/tahrir — yozilgan yozuvni oʻzgartirish',
    '/hozir — bosh sahifadagi «Hozir» qatorini yangilash',
    '/kitob — «Hozir oʻqiyapman» kartasini yangilash',
    '/statistika — nechta odam oʻqiganini koʻrish',
    '/bekor — boshlangan ishni toʻxtatish',
    '',
    'Uzun matnni bir necha xabarga boʻlib yuborsangiz boʻladi.',
  ].join('\n'),

  cancelled: 'Boʻldi, toʻxtatdim. Hech narsa saqlanmadi.',
  nothingToCancel: 'Hozir boshlangan ish yoʻq.',
  unknown: 'Buni tushunmadim. /yordam ni bosing.',

  // ---- /yoz
  pickPillar: 'Qaysi boʻlimga yozamiz?',
  askTitle: 'Sarlavhani yozing.',
  askDescription:
    'Endi qisqacha — bir-ikki jumla. Roʻyxatlarda va Google natijalarida shu koʻrinadi (200 belgigacha).',
  descriptionTooLong: (n) => `Biroz uzun (${n} belgi). 200 belgigacha qisqartiring.`,
  askBody: [
    'Endi matnni yozing.',
    '',
    'Bir necha xabarga boʻlib yuboraversangiz boʻladi — hammasi bitta yozuvga qoʻshiladi.',
    'Yozib boʻlgach /tugadi deb yuboring.',
  ].join('\n'),
  bodyEmpty: 'Hali matn yozilmadi. Yozing, keyin /tugadi.',
  bodyAdded: (n) => `Qabul qilindi (${n} ta boʻlak). Davom eting yoki /tugadi.`,

  askCover: 'Muqova rasmi bormi? Yuboring. Kerak boʻlmasa /otkaz.',
  askCoverAlt:
    'Rasmda nima bor? Bir jumlada yozing — koʻra olmaydigan odamlar uchun. Tavsifsiz rasm saytda koʻrsatilmaydi.',
  coverSaved: 'Rasm saqlandi.',
  softHint:
    'Kichik maslahat: rasmni *fayl* qilib yuborsangiz sifati yaxshiroq chiqadi — Telegram rasm sifatida yuborilganini siqadi.',

  // ---- sources (health posts)
  sourcesIntro: [
    'Bu yozuv koʻz sogʻligʻi boʻlimiga tushadi, shuning uchun kamida bitta manba kerak.',
    'Manbasiz saqlab boʻlmaydi.',
  ].join('\n'),
  askSourceTitle: 'Manba nomi?',
  askSourcePublisher: 'Kim chiqargan? (masalan: American Academy of Ophthalmology)',
  askSourceYear: 'Yili? Bilmasangiz /otkaz.',
  askSourceUrl: 'Havolasi? Boʻlmasa /otkaz.',
  moreSources: 'Yana manba qoʻshamizmi?',
  sourceNeeded: 'Kamida bitta manba kerak — manba nomini yozing.',

  // ---- preview / save
  previewHeading: 'Mana shunday chiqadi:',
  previewSlug: (slug) => `Manzili: /yozuvlar/${slug}`,
  savedDraft: 'Qoralama sifatida saqlandi. Hali saytda koʻrinmaydi.',
  published: 'Nashr qilindi.',
  deployNote: 'Sayt bir-ikki daqiqada yangilanadi.',

  // ---- git
  pushFailedConflict: [
    'Yozuv saqlandi, lekin saytga yuborilmadi: shu fayl boshqa joyda ham oʻzgartirilgan.',
    '',
    'Matningiz yoʻqolmadi — u serverda turibdi. Amin qoʻlda birlashtiradi.',
  ].join('\n'),
  pushFailedOffline: [
    'Yozuv saqlandi, lekin internetga chiqib boʻlmadi.',
    '',
    'Matningiz yoʻqolmadi — aloqa tiklanganda yuboriladi.',
  ].join('\n'),

  // ---- /qoralama
  noDrafts: 'Qoralama yoʻq.',
  pickDraft: 'Qaysi birini nashr qilamiz?',

  // ---- /tahrir
  noPosts: 'Hali yozuv yoʻq.',
  pickPost: 'Qaysi yozuvni oʻzgartiramiz?',
  pickAction: 'Nimani oʻzgartiramiz?',
  askNewTitle: 'Yangi sarlavha?',
  askNewDescription: 'Yangi qisqacha? (200 belgigacha)',
  askAppend: 'Nima qoʻshamiz? Yozing, tugagach /tugadi.',
  askReplaceBody: 'Yangi matnni yozing, tugagach /tugadi.',
  coverRemoved: 'Muqova olib tashlandi. Rasm oʻchirilmadi — kerak boʻlsa qaytarib qoʻyish mumkin.',
  draftedAgain: 'Qoralamaga oʻtkazildi — saytdan yashirildi.',
  publishedAgain: 'Nashr qilindi.',
  cmsOnly: [
    'Abzatslarni alohida tahrirlash bu yerda qulay emas — chat oynasida uzun matnni koʻchirib yurish qiyin.',
    'Buning uchun tahrirlash sahifasini oching:',
  ].join('\n'),

  // ---- /hozir, /kitob
  askHozir: 'Bosh sahifadagi «Hozir» qatoriga nima yozamiz? Bitta xabar yuboring.',
  hozirSaved: 'Yangilandi.',
  askKitob: [
    'Nechanchi foizdasiz? Faqat raqam yuboring (masalan 40).',
    'Yoki izohni oʻzgartirish uchun jumla yozing.',
  ].join('\n'),
  kitobProgress: (n) => `${n}% qilib qoʻydim.`,
  kitobNote: 'Izoh yangilandi.',
  kitobNoBook: 'Hozircha kitob qoʻyilmagan. Uni tahrirlash sahifasidan qoʻshing.',

  // ---- /statistika
  statsUnavailable: [
    'Statistika hozir olinmadi — hisoblagich xizmatiga ulanib boʻlmadi.',
    'Sayt bemalol ishlayapti, faqat raqamlar koʻrinmayapti.',
  ].join('\n'),
  statsUnconfigured: 'Statistika hali ulanmagan.',
};

/** Buttons, kept next to the strings they belong with. */
export const B = {
  saveDraft: 'Qoralama qilib saqlash',
  publish: 'Nashr qilish',
  cancel: 'Bekor qilish',
  yes: 'Ha',
  no: 'Yoʻq',
  changeTitle: 'Sarlavha',
  changeDescription: 'Qisqacha',
  appendBody: 'Matn qoʻshish',
  replaceBody: 'Matnni almashtirish',
  changeCover: 'Muqova',
  removeCover: 'Muqovani olib tashlash',
  toggleDraft: 'Qoralama/nashr',
  openCms: 'Tahrirlash sahifasida ochish',
};
