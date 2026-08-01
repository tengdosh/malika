import { config, collection, singleton, fields } from '@keystatic/core';

/**
 * Keystatic CMS.
 *
 * Every label and description is in Uzbek, plain language, no jargon: Malika is
 * not technical and should never see YAML, Git or a terminal.
 *
 * This config and src/content.config.ts describe the same content. If they
 * diverge, she saves a post that fails the build — so scripts/check-schema-sync.mjs
 * compares them field by field and fails on mismatch.
 */

/**
 * Pillars offered in the admin. Slugs stay ASCII; only the labels are Uzbek.
 *
 * `koz-sogligi` is deliberately ABSENT. Health posts are their own collection
 * (`sogliq`) where `sources` is genuinely required, so the pillar is implied
 * rather than chosen. Offering it here would let an unsourced health post be
 * saved, and the only thing standing between that and a broken deploy would be
 * a build error Malika never sees.
 */
const PILLAR_OPTIONS = [
  { label: 'Kundalik', value: 'kundalik' },
  { label: 'Kitoblar', value: 'kitoblar' },
  { label: 'Oʻqish va kasb', value: 'oqish-kasb' },
  { label: 'Yoʻl', value: 'yol' },
  { label: 'Esse', value: 'esse' },
];

/**
 * publicPath is relative to the content file, so astro:assets still resolves and
 * optimises the image. Content lives at src/content/<collection>/<slug>.md, which
 * is two levels below src/.
 */
const postImage = {
  directory: 'src/assets/posts',
  publicPath: '../../assets/posts/',
};

const sourceFields = fields.object(
  {
    title: fields.text({
      label: 'Manba nomi',
      validation: { isRequired: true },
    }),
    publisher: fields.text({
      label: 'Kim chiqargan',
      description: 'Masalan: American Academy of Ophthalmology',
      validation: { isRequired: true },
    }),
    year: fields.number({ label: 'Yil' }),
    url: fields.url({ label: 'Havola', description: 'Boʻlmasa — boʻsh qoldiring. Oʻzingizdan yozmang.' }),
  },
  { label: 'Manba' },
);

/**
 * Shared by all three entry collections.
 *
 * `health: true` drops the pillar picker (implied by the collection) and makes
 * `sources` genuinely required — enforced by the admin before save, which is the
 * whole reason health posts are a separate collection.
 */
const entryFields = (evergreenDefault: boolean, health = false) => ({
  title: fields.slug({
    name: {
      label: 'Sarlavha',
      validation: { isRequired: true },
    },
    slug: {
      label: 'Havoladagi nomi',
      description: 'Saytdagi manzilda koʻrinadi. Odatda oʻzgartirish shart emas.',
    },
  }),

  description: fields.text({
    label: 'Qisqacha',
    description:
      'Bir-ikki jumla. Roʻyxatlarda va Google natijalarida koʻrinadi. Eng koʻpi 200 belgi.',
    multiline: true,
    validation: { isRequired: true, length: { max: 200 } },
  }),

  ...(health
    ? {}
    : {
        pillar: fields.select({
          label: 'Mavzu',
          description: 'Yozuv qaysi boʻlimga tegishli.',
          options: PILLAR_OPTIONS,
          defaultValue: 'kundalik',
        }),
      }),

  date: fields.date({
    label: 'Sana',
    defaultValue: { kind: 'today' },
    validation: { isRequired: true },
  }),

  updated: fields.date({
    label: 'Yangilangan sana',
    description: 'Yozuvni keyin tahrirlasangiz shu yerga sana qoʻying. Shart emas.',
  }),

  draft: fields.checkbox({
    label: 'Qoralama',
    description: 'Belgini olib tashlaganingizda yozuv saytda paydo boʻladi.',
    defaultValue: true,
  }),

  featured: fields.checkbox({
    label: 'Bosh sahifada katta qilib koʻrsatilsin',
    description: 'Faqat bitta yozuvda belgilang.',
    defaultValue: false,
  }),

  evergreen: fields.checkbox({
    label: 'Doim yangilanib turadi',
    description: 'Belgilansa, sana oʻrniga "Yangilanib boradi" deb yoziladi.',
    defaultValue: evergreenDefault,
  }),

  cover: fields.image({
    label: 'Muqova rasmi',
    description: 'Shart emas. Rasmsiz yozuv ham chiroyli koʻrinadi.',
    ...postImage,
  }),

  coverAlt: fields.text({
    label: 'Rasm tavsifi',
    description: 'Rasmda nima borligini bir jumlada yozing — koʻra olmaydigan odamlar uchun.',
  }),

  sources: fields.array(sourceFields, {
    label: 'Manbalar',
    description: health
      ? 'Kamida bitta manba shart. Manbasiz saqlab boʻlmaydi.'
      : 'Shart emas. Sogʻliq haqidagi yozuvlar uchun alohida boʻlim bor.',
    itemLabel: (props) => props.fields.title.value || 'Manba',
    // The rule that makes the separate collection worth having: the admin will
    // not let a health post be saved with an empty list.
    ...(health ? { validation: { length: { min: 1 } } } : {}),
  }),

  reviewedBy: fields.text({
    label: 'Kim koʻrib chiqdi',
    description: 'Yozuvni shifokor koʻrib chiqqan boʻlsa, ismini yozing. Shart emas.',
  }),

  altQueries: fields.array(fields.text({ label: 'Soʻz yoki ibora' }), {
    label: 'Boshqacha qidiriladigan soʻzlar',
    description:
      'Odamlar qidiruvda koʻpincha ʻ belgisisiz yozadi ("koz oldida chivin") yoki ruscha ' +
      'qidiradi ("мушки перед глазами"). Shunday variantlarni shu yerga qoʻshing. ' +
      'Ular yozuv matnida koʻrinmaydi — faqat qidiruv tizimlari uchun. Shart emas.',
    itemLabel: (props) => props.value || 'Soʻz',
  }),

  content: fields.markdoc({
    label: 'Matn',
    // .md, so Astro reads these exactly as before — no MDX pipeline change.
    extension: 'md',
  }),
});

/**
 * This file is bundled into the browser as well as the server, so it can only
 * read `import.meta.env` — `process` does not exist client-side, and reading it
 * here breaks the admin with "process is not defined" at hydration.
 *
 * That also means every variable used here must be PUBLIC_ prefixed. None of
 * these are secrets: the repo coordinates are public, and the storage kind just
 * selects local files vs GitHub. The GitHub App client secret and
 * KEYSTATIC_SECRET are read server-side by the API route, never here.
 *
 * Local files in development, GitHub in production, selected by one variable.
 */
const STORAGE_KIND =
  import.meta.env.PUBLIC_KEYSTATIC_STORAGE ?? (import.meta.env.DEV ? 'local' : 'github');

export default config({
  storage:
    STORAGE_KIND === 'github'
      ? {
          kind: 'github',
          repo: {
            owner: import.meta.env.PUBLIC_KEYSTATIC_GITHUB_OWNER ?? 'tengdosh',
            name: import.meta.env.PUBLIC_KEYSTATIC_GITHUB_REPO ?? 'malika',
          },
        }
      : { kind: 'local' },

  ui: {
    brand: { name: 'Malika Bobonazarova' },
    navigation: {
      Yozuvlar: ['posts', 'sogliq', 'notes'],
      Sahifalar: ['men_haqimda', 'maxfiylik'],
      'Tez oʻzgaradigan': ['hozir', 'oqiyapman'],
      Sozlamalar: ['sozlamalar'],
    },
  },

  collections: {
    posts: collection({
      label: 'Yozuvlar',
      path: 'src/content/posts/*',
      slugField: 'title',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: entryFields(false),
    }),

    sogliq: collection({
      label: 'Koʻz sogʻligʻi yozuvi',
      path: 'src/content/posts/sogliq/*',
      slugField: 'title',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: entryFields(false, true),
    }),

    notes: collection({
      label: 'Qaydlar',
      path: 'src/content/notes/*',
      slugField: 'title',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'updated'],
      schema: entryFields(true),
    }),
  },

  singletons: {
    hozir: singleton({
      label: 'Hozir',
      path: 'src/content/site/hozir',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Sarlavha', defaultValue: 'Hozir' }),
        description: fields.text({ label: 'Qisqacha', multiline: true }),
        updated: fields.date({ label: 'Yangilangan sana' }),
        strip: fields.text({
          label: 'Bosh sahifadagi bir jumla',
          description: 'Bosh sahifada pushti quticha ichida shu matn koʻrinadi. Qisqa yozing.',
          multiline: true,
          validation: { isRequired: true },
        }),
        content: fields.markdoc({ label: 'Toʻliq matn', extension: 'md' }),
      },
    }),

    oqiyapman: singleton({
      label: 'Hozir oʻqiyapman',
      path: 'src/content/site/oqiyapman',
      format: { data: 'yaml' },
      schema: {
        title: fields.text({ label: 'Sahifa nomi', defaultValue: 'Hozir oʻqiyapman' }),
        book: fields.object(
          {
            title: fields.text({ label: 'Kitob nomi', validation: { isRequired: true } }),
            author: fields.text({ label: 'Muallif', validation: { isRequired: true } }),
            startedOn: fields.date({ label: 'Qachon boshladingiz', validation: { isRequired: true } }),
            progress: fields.integer({
              label: 'Necha foizini oʻqidingiz',
              description: '0 dan 100 gacha.',
              defaultValue: 0,
              validation: { min: 0, max: 100 },
            }),
            note: fields.text({
              label: 'Bir jumlalik izoh',
              multiline: true,
              validation: { isRequired: true },
            }),
            cover: fields.image({
              label: 'Kitob muqovasi',
              directory: 'src/assets/books',
              publicPath: '../../../assets/books/',
            }),
            coverAlt: fields.text({ label: 'Muqova tavsifi' }),
          },
          { label: 'Kitob' },
        ),
      },
    }),

    men_haqimda: singleton({
      label: 'Men haqimda',
      path: 'src/content/site/men_haqimda',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Sarlavha', defaultValue: 'Men haqimda' }),
        description: fields.text({
          label: 'Qisqacha',
          description: 'Google natijalarida koʻrinadi.',
          multiline: true,
        }),
        updated: fields.date({ label: 'Yangilangan sana' }),
        muassasa: fields.text({
          label: 'Oʻquv muassasasi',
          description: 'Qayerni tugatgansiz. Sahifada bir qatorda koʻrinadi.',
        }),
        bitirganYil: fields.text({
          label: 'Bitirgan yil',
          description: 'Masalan: 2026',
        }),
        portrait: fields.image({
          label: 'Rasmingiz',
          directory: 'src/assets/about',
          publicPath: '../../../assets/about/',
        }),
        portraitAlt: fields.text({
          label: 'Rasm tavsifi',
          description: 'Rasmda nima borligini bir jumlada yozing — koʻra olmaydigan odamlar uchun.',
        }),
        content: fields.markdoc({ label: 'Matn', extension: 'md' }),
      },
    }),

    maxfiylik: singleton({
      label: 'Maxfiylik',
      path: 'src/content/site/maxfiylik',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Sarlavha', defaultValue: 'Maxfiylik' }),
        description: fields.text({ label: 'Qisqacha', multiline: true }),
        content: fields.markdoc({ label: 'Matn', extension: 'md' }),
      },
    }),

    sozlamalar: singleton({
      label: 'Sozlamalar',
      path: 'src/content/site/sozlamalar',
      format: { data: 'yaml' },
      schema: {
        title: fields.text({ label: 'Nomi', defaultValue: 'Sozlamalar' }),

        telegram: fields.url({
          label: 'Telegram havolasi',
          description:
            'Toʻliq havola, masalan https://t.me/... . Boʻsh qoldirsangiz, saytda Telegram tugmasi umuman koʻrinmaydi.',
        }),
        instagram: fields.url({
          label: 'Instagram havolasi',
          description: 'Toʻliq havola. Shart emas.',
        }),
        email: fields.text({
          label: 'Elektron pochta',
          description: 'Shart emas. Yozsangiz, saytning pastida koʻrinadi.',
        }),

        footerBio: fields.text({
          label: 'Oʻzingiz haqingizda bir qator',
          description: 'Saytning pastida va har bir yozuv ostida koʻrinadi.',
          multiline: true,
          validation: { isRequired: true },
        }),

        hisoblagichKorsatilsin: fields.checkbox({
          label: 'Yozuvlarda "necha marta oʻqildi" koʻrsatilsin',
          defaultValue: true,
        }),
        hisoblagichMinimum: fields.integer({
          label: 'Eng kam son',
          description:
            'Shu sondan kam oʻqilgan yozuvlarda hisoblagich koʻrsatilmaydi. 0 boʻlsa — hammasida koʻrinadi.',
          defaultValue: 0,
          validation: { min: 0 },
        }),

        googleSiteVerification: fields.text({
          label: 'Google tasdiqlash kodi',
          description:
            'Google Search Console bergan kod. Odatda kerak emas — domen orqali tasdiqlash afzal. Shart emas.',
        }),
        yandexVerification: fields.text({
          label: 'Yandex tasdiqlash kodi',
          description: 'Yandex Webmaster bergan kod. Shart emas.',
        }),
        bingVerification: fields.text({
          label: 'Bing tasdiqlash kodi',
          description: 'Bing Webmaster Tools bergan kod. Shart emas.',
        }),
      },
    }),
  },
});
