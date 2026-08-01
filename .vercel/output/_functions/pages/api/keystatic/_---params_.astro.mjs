import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import { fields, config as config$1, singleton, collection } from '@keystatic/core';
export { renderers } from '../../../renderers.mjs';

var setCookie = {exports: {}};

var hasRequiredSetCookie;

function requireSetCookie () {
	if (hasRequiredSetCookie) return setCookie.exports;
	hasRequiredSetCookie = 1;

	var defaultParseOptions = {
	  decodeValues: true,
	  map: false,
	  silent: false,
	};

	function isForbiddenKey(key) {
	  return typeof key !== "string" || key in {};
	}

	function createNullObj() {
	  return Object.create(null);
	}

	function isNonEmptyString(str) {
	  return typeof str === "string" && !!str.trim();
	}

	function parseString(setCookieValue, options) {
	  var parts = setCookieValue.split(";").filter(isNonEmptyString);

	  var nameValuePairStr = parts.shift();
	  var parsed = parseNameValuePair(nameValuePairStr);
	  var name = parsed.name;
	  var value = parsed.value;

	  options = options
	    ? Object.assign({}, defaultParseOptions, options)
	    : defaultParseOptions;

	  if (isForbiddenKey(name)) {
	    return null;
	  }

	  try {
	    value = options.decodeValues ? decodeURIComponent(value) : value; // decode cookie value
	  } catch (e) {
	    console.error(
	      "set-cookie-parser: failed to decode cookie value. Set options.decodeValues=false to disable decoding.",
	      e
	    );
	  }

	  var cookie = createNullObj();
	  cookie.name = name;
	  cookie.value = value;

	  parts.forEach(function (part) {
	    var sides = part.split("=");
	    var key = sides.shift().trimLeft().toLowerCase();
	    if (isForbiddenKey(key)) {
	      return;
	    }
	    var value = sides.join("=");
	    if (key === "expires") {
	      cookie.expires = new Date(value);
	    } else if (key === "max-age") {
	      var n = parseInt(value, 10);
	      if (!Number.isNaN(n)) cookie.maxAge = n;
	    } else if (key === "secure") {
	      cookie.secure = true;
	    } else if (key === "httponly") {
	      cookie.httpOnly = true;
	    } else if (key === "samesite") {
	      cookie.sameSite = value;
	    } else if (key === "partitioned") {
	      cookie.partitioned = true;
	    } else if (key) {
	      cookie[key] = value;
	    }
	  });

	  return cookie;
	}

	function parseNameValuePair(nameValuePairStr) {
	  // Parses name-value-pair according to rfc6265bis draft

	  var name = "";
	  var value = "";
	  var nameValueArr = nameValuePairStr.split("=");
	  if (nameValueArr.length > 1) {
	    name = nameValueArr.shift();
	    value = nameValueArr.join("="); // everything after the first =, joined by a "=" if there was more than one part
	  } else {
	    value = nameValuePairStr;
	  }

	  return { name: name, value: value };
	}

	function parse(input, options) {
	  options = options
	    ? Object.assign({}, defaultParseOptions, options)
	    : defaultParseOptions;

	  if (!input) {
	    if (!options.map) {
	      return [];
	    } else {
	      return createNullObj();
	    }
	  }

	  if (input.headers) {
	    if (typeof input.headers.getSetCookie === "function") {
	      // for fetch responses - they combine headers of the same type in the headers array,
	      // but getSetCookie returns an uncombined array
	      input = input.headers.getSetCookie();
	    } else if (input.headers["set-cookie"]) {
	      // fast-path for node.js (which automatically normalizes header names to lower-case)
	      input = input.headers["set-cookie"];
	    } else {
	      // slow-path for other environments - see #25
	      var sch =
	        input.headers[
	          Object.keys(input.headers).find(function (key) {
	            return key.toLowerCase() === "set-cookie";
	          })
	        ];
	      // warn if called on a request-like object with a cookie header rather than a set-cookie header - see #34, 36
	      if (!sch && input.headers.cookie && !options.silent) {
	        console.warn(
	          "Warning: set-cookie-parser appears to have been called on a request object. It is designed to parse Set-Cookie headers from responses, not Cookie headers from requests. Set the option {silent: true} to suppress this warning."
	        );
	      }
	      input = sch;
	    }
	  }
	  if (!Array.isArray(input)) {
	    input = [input];
	  }

	  if (!options.map) {
	    return input
	      .filter(isNonEmptyString)
	      .map(function (str) {
	        return parseString(str, options);
	      })
	      .filter(Boolean);
	  } else {
	    var cookies = createNullObj();
	    return input.filter(isNonEmptyString).reduce(function (cookies, str) {
	      var cookie = parseString(str, options);
	      if (cookie && !isForbiddenKey(cookie.name)) {
	        cookies[cookie.name] = cookie;
	      }
	      return cookies;
	    }, cookies);
	  }
	}

	/*
	  Set-Cookie header field-values are sometimes comma joined in one string. This splits them without choking on commas
	  that are within a single set-cookie field-value, such as in the Expires portion.

	  This is uncommon, but explicitly allowed - see https://tools.ietf.org/html/rfc2616#section-4.2
	  Node.js does this for every header *except* set-cookie - see https://github.com/nodejs/node/blob/d5e363b77ebaf1caf67cd7528224b651c86815c1/lib/_http_incoming.js#L128
	  React Native's fetch does this for *every* header, including set-cookie.

	  Based on: https://github.com/google/j2objc/commit/16820fdbc8f76ca0c33472810ce0cb03d20efe25
	  Credits to: https://github.com/tomball for original and https://github.com/chrusart for JavaScript implementation
	*/
	function splitCookiesString(cookiesString) {
	  if (Array.isArray(cookiesString)) {
	    return cookiesString;
	  }
	  if (typeof cookiesString !== "string") {
	    return [];
	  }

	  var cookiesStrings = [];
	  var pos = 0;
	  var start;
	  var ch;
	  var lastComma;
	  var nextStart;
	  var cookiesSeparatorFound;

	  function skipWhitespace() {
	    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
	      pos += 1;
	    }
	    return pos < cookiesString.length;
	  }

	  function notSpecialChar() {
	    ch = cookiesString.charAt(pos);

	    return ch !== "=" && ch !== ";" && ch !== ",";
	  }

	  while (pos < cookiesString.length) {
	    start = pos;
	    cookiesSeparatorFound = false;

	    while (skipWhitespace()) {
	      ch = cookiesString.charAt(pos);
	      if (ch === ",") {
	        // ',' is a cookie separator if we have later first '=', not ';' or ','
	        lastComma = pos;
	        pos += 1;

	        skipWhitespace();
	        nextStart = pos;

	        while (pos < cookiesString.length && notSpecialChar()) {
	          pos += 1;
	        }

	        // currently special character
	        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
	          // we found cookies separator
	          cookiesSeparatorFound = true;
	          // pos is inside the next cookie, so back up and return it.
	          pos = nextStart;
	          cookiesStrings.push(cookiesString.substring(start, lastComma));
	          start = pos;
	        } else {
	          // in param ',' or param separator ';',
	          // we continue from that comma
	          pos = lastComma + 1;
	        }
	      } else {
	        pos += 1;
	      }
	    }

	    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
	      cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
	    }
	  }

	  return cookiesStrings;
	}

	setCookie.exports = parse;
	setCookie.exports.parse = parse;
	setCookie.exports.parseString = parseString;
	setCookie.exports.splitCookiesString = splitCookiesString;
	return setCookie.exports;
}

var setCookieExports = /*@__PURE__*/ requireSetCookie();

function makeHandler(_config) {
  return async function keystaticAPIRoute(context) {
    var _context$locals, _ref, _config$clientId, _ref2, _config$clientSecret, _ref3, _config$secret;
    const envVarsForCf = (_context$locals = context.locals) === null || _context$locals === void 0 || (_context$locals = _context$locals.runtime) === null || _context$locals === void 0 ? void 0 : _context$locals.env;
    const handler = makeGenericAPIRouteHandler({
      ..._config,
      clientId: (_ref = (_config$clientId = _config.clientId) !== null && _config$clientId !== void 0 ? _config$clientId : envVarsForCf === null || envVarsForCf === void 0 ? void 0 : envVarsForCf.KEYSTATIC_GITHUB_CLIENT_ID) !== null && _ref !== void 0 ? _ref : tryOrUndefined(() => {
        return undefined                                          ;
      }),
      clientSecret: (_ref2 = (_config$clientSecret = _config.clientSecret) !== null && _config$clientSecret !== void 0 ? _config$clientSecret : envVarsForCf === null || envVarsForCf === void 0 ? void 0 : envVarsForCf.KEYSTATIC_GITHUB_CLIENT_SECRET) !== null && _ref2 !== void 0 ? _ref2 : tryOrUndefined(() => {
        return undefined                                              ;
      }),
      secret: (_ref3 = (_config$secret = _config.secret) !== null && _config$secret !== void 0 ? _config$secret : envVarsForCf === null || envVarsForCf === void 0 ? void 0 : envVarsForCf.KEYSTATIC_SECRET) !== null && _ref3 !== void 0 ? _ref3 : tryOrUndefined(() => {
        return undefined                                ;
      })
    }, {
      slugEnvName: "PUBLIC_KEYSTATIC_GITHUB_APP_SLUG"
    });
    const {
      body,
      headers,
      status
    } = await handler(context.request);
    let headersInADifferentStructure = /* @__PURE__ */ new Map();
    if (headers) {
      if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
          if (!headersInADifferentStructure.has(key.toLowerCase())) {
            headersInADifferentStructure.set(key.toLowerCase(), []);
          }
          headersInADifferentStructure.get(key.toLowerCase()).push(value);
        }
      } else if (typeof headers.entries === "function") {
        for (const [key, value] of headers.entries()) {
          headersInADifferentStructure.set(key.toLowerCase(), [value]);
        }
        if ("getSetCookie" in headers && typeof headers.getSetCookie === "function") {
          const setCookieHeaders2 = headers.getSetCookie();
          if (setCookieHeaders2 !== null && setCookieHeaders2 !== void 0 && setCookieHeaders2.length) {
            headersInADifferentStructure.set("set-cookie", setCookieHeaders2);
          }
        }
      } else {
        for (const [key, value] of Object.entries(headers)) {
          headersInADifferentStructure.set(key.toLowerCase(), [value]);
        }
      }
    }
    const setCookieHeaders = headersInADifferentStructure.get("set-cookie");
    headersInADifferentStructure.delete("set-cookie");
    if (setCookieHeaders) {
      for (const setCookieValue of setCookieHeaders) {
        var _options$sameSite;
        const {
          name,
          value,
          ...options
        } = setCookieExports.parseString(setCookieValue);
        const sameSite = (_options$sameSite = options.sameSite) === null || _options$sameSite === void 0 ? void 0 : _options$sameSite.toLowerCase();
        context.cookies.set(name, value, {
          domain: options.domain,
          expires: options.expires,
          httpOnly: options.httpOnly,
          maxAge: options.maxAge,
          path: options.path,
          sameSite: sameSite === "lax" || sameSite === "strict" || sameSite === "none" ? sameSite : void 0
        });
      }
    }
    return new Response(body, {
      status,
      headers: [...headersInADifferentStructure.entries()].flatMap(([key, val]) => val.map((x) => [key, x]))
    });
  };
}
function tryOrUndefined(fn) {
  try {
    return fn();
  } catch {
    return void 0;
  }
}

const PILLAR_OPTIONS = [
  { label: "Kundalik", value: "kundalik" },
  { label: "Kitoblar", value: "kitoblar" },
  { label: "Oʻqish va kasb", value: "oqish-kasb" },
  { label: "Koʻz sogʻligʻi", value: "koz-sogligi" },
  { label: "Yoʻl", value: "yol" },
  { label: "Esse", value: "esse" }
];
const postImage = {
  directory: "src/assets/posts",
  publicPath: "../../assets/posts/"
};
const sourceFields = fields.object(
  {
    title: fields.text({
      label: "Manba nomi",
      validation: { isRequired: true }
    }),
    publisher: fields.text({
      label: "Kim chiqargan",
      description: "Masalan: American Academy of Ophthalmology",
      validation: { isRequired: true }
    }),
    year: fields.number({ label: "Yil" }),
    url: fields.url({ label: "Havola", description: "Boʻlmasa — boʻsh qoldiring. Oʻzingizdan yozmang." })
  },
  { label: "Manba" }
);
const entryFields = (evergreenDefault) => ({
  title: fields.slug({
    name: {
      label: "Sarlavha",
      validation: { isRequired: true }
    },
    slug: {
      label: "Havoladagi nomi",
      description: "Saytdagi manzilda koʻrinadi. Odatda oʻzgartirish shart emas."
    }
  }),
  description: fields.text({
    label: "Qisqacha",
    description: "Bir-ikki jumla. Roʻyxatlarda va Google natijalarida koʻrinadi. Eng koʻpi 200 belgi.",
    multiline: true,
    validation: { isRequired: true, length: { max: 200 } }
  }),
  pillar: fields.select({
    label: "Mavzu",
    description: "Yozuv qaysi boʻlimga tegishli.",
    options: PILLAR_OPTIONS,
    defaultValue: "kundalik"
  }),
  date: fields.date({
    label: "Sana",
    defaultValue: { kind: "today" },
    validation: { isRequired: true }
  }),
  updated: fields.date({
    label: "Yangilangan sana",
    description: "Yozuvni keyin tahrirlasangiz shu yerga sana qoʻying. Shart emas."
  }),
  draft: fields.checkbox({
    label: "Qoralama",
    description: "Belgini olib tashlaganingizda yozuv saytda paydo boʻladi.",
    defaultValue: true
  }),
  featured: fields.checkbox({
    label: "Bosh sahifada katta qilib koʻrsatilsin",
    description: "Faqat bitta yozuvda belgilang.",
    defaultValue: false
  }),
  evergreen: fields.checkbox({
    label: "Doim yangilanib turadi",
    description: 'Belgilansa, sana oʻrniga "Yangilanib boradi" deb yoziladi.',
    defaultValue: evergreenDefault
  }),
  cover: fields.image({
    label: "Muqova rasmi",
    description: "Shart emas. Rasmsiz yozuv ham chiroyli koʻrinadi.",
    ...postImage
  }),
  coverAlt: fields.text({
    label: "Rasm tavsifi",
    description: "Rasmda nima borligini bir jumlada yozing — koʻra olmaydigan odamlar uchun."
  }),
  sources: fields.array(sourceFields, {
    label: "Manbalar",
    description: "Koʻz sogʻligʻi yozuvlari uchun kamida bitta manba SHART. Boshqa mavzularda shart emas.",
    itemLabel: (props) => props.fields.title.value || "Manba"
  }),
  reviewedBy: fields.text({
    label: "Kim koʻrib chiqdi",
    description: "Yozuvni shifokor koʻrib chiqqan boʻlsa, ismini yozing. Shart emas."
  }),
  content: fields.markdoc({
    label: "Matn",
    // .md, so Astro reads these exactly as before — no MDX pipeline change.
    extension: "md"
  })
});
const config = config$1({
  storage: {
    kind: "github",
    repo: {
      owner: "malika-bobonazarova",
      name: "malika-bobonazarova.uz"
    }
  } ,
  ui: {
    brand: { name: "Malika Bobonazarova" },
    navigation: {
      Yozuvlar: ["posts", "notes"],
      Sahifalar: ["men_haqimda", "maxfiylik"],
      "Tez oʻzgaradigan": ["hozir", "oqiyapman"],
      Sozlamalar: ["sozlamalar"]
    }
  },
  collections: {
    posts: collection({
      label: "Yozuvlar",
      path: "src/content/posts/*",
      slugField: "title",
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "date"],
      schema: entryFields(false)
    }),
    notes: collection({
      label: "Qaydlar",
      path: "src/content/notes/*",
      slugField: "title",
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "updated"],
      schema: entryFields(true)
    })
  },
  singletons: {
    hozir: singleton({
      label: "Hozir",
      path: "src/content/site/hozir",
      format: { contentField: "content" },
      schema: {
        title: fields.text({ label: "Sarlavha", defaultValue: "Hozir" }),
        description: fields.text({ label: "Qisqacha", multiline: true }),
        updated: fields.date({ label: "Yangilangan sana" }),
        strip: fields.text({
          label: "Bosh sahifadagi bir jumla",
          description: "Bosh sahifada pushti quticha ichida shu matn koʻrinadi. Qisqa yozing.",
          multiline: true,
          validation: { isRequired: true }
        }),
        content: fields.markdoc({ label: "Toʻliq matn", extension: "md" })
      }
    }),
    oqiyapman: singleton({
      label: "Hozir oʻqiyapman",
      path: "src/content/site/oqiyapman",
      format: { data: "yaml" },
      schema: {
        title: fields.text({ label: "Sahifa nomi", defaultValue: "Hozir oʻqiyapman" }),
        book: fields.object(
          {
            title: fields.text({ label: "Kitob nomi", validation: { isRequired: true } }),
            author: fields.text({ label: "Muallif", validation: { isRequired: true } }),
            startedOn: fields.date({ label: "Qachon boshladingiz", validation: { isRequired: true } }),
            progress: fields.integer({
              label: "Necha foizini oʻqidingiz",
              description: "0 dan 100 gacha.",
              defaultValue: 0,
              validation: { min: 0, max: 100 }
            }),
            note: fields.text({
              label: "Bir jumlalik izoh",
              multiline: true,
              validation: { isRequired: true }
            }),
            cover: fields.image({
              label: "Kitob muqovasi",
              directory: "src/assets/books",
              publicPath: "../../../assets/books/"
            }),
            coverAlt: fields.text({ label: "Muqova tavsifi" })
          },
          { label: "Kitob" }
        )
      }
    }),
    men_haqimda: singleton({
      label: "Men haqimda",
      path: "src/content/site/men_haqimda",
      format: { contentField: "content" },
      schema: {
        title: fields.text({ label: "Sarlavha", defaultValue: "Men haqimda" }),
        description: fields.text({
          label: "Qisqacha",
          description: "Google natijalarida koʻrinadi.",
          multiline: true
        }),
        updated: fields.date({ label: "Yangilangan sana" }),
        muassasa: fields.text({
          label: "Oʻquv muassasasi",
          description: "Qayerni tugatgansiz. Sahifada bir qatorda koʻrinadi."
        }),
        bitirganYil: fields.text({
          label: "Bitirgan yil",
          description: "Masalan: 2026"
        }),
        portrait: fields.image({
          label: "Rasmingiz",
          directory: "src/assets/about",
          publicPath: "../../../assets/about/"
        }),
        portraitAlt: fields.text({
          label: "Rasm tavsifi",
          description: "Rasmda nima borligini bir jumlada yozing — koʻra olmaydigan odamlar uchun."
        }),
        content: fields.markdoc({ label: "Matn", extension: "md" })
      }
    }),
    maxfiylik: singleton({
      label: "Maxfiylik",
      path: "src/content/site/maxfiylik",
      format: { contentField: "content" },
      schema: {
        title: fields.text({ label: "Sarlavha", defaultValue: "Maxfiylik" }),
        description: fields.text({ label: "Qisqacha", multiline: true }),
        content: fields.markdoc({ label: "Matn", extension: "md" })
      }
    }),
    sozlamalar: singleton({
      label: "Sozlamalar",
      path: "src/content/site/sozlamalar",
      format: { data: "yaml" },
      schema: {
        title: fields.text({ label: "Nomi", defaultValue: "Sozlamalar" }),
        telegram: fields.url({
          label: "Telegram havolasi",
          description: "Toʻliq havola, masalan https://t.me/... . Boʻsh qoldirsangiz, saytda Telegram tugmasi umuman koʻrinmaydi."
        }),
        instagram: fields.url({
          label: "Instagram havolasi",
          description: "Toʻliq havola. Shart emas."
        }),
        email: fields.text({
          label: "Elektron pochta",
          description: "Shart emas. Yozsangiz, saytning pastida koʻrinadi."
        }),
        footerBio: fields.text({
          label: "Oʻzingiz haqingizda bir qator",
          description: "Saytning pastida va har bir yozuv ostida koʻrinadi.",
          multiline: true,
          validation: { isRequired: true }
        }),
        hisoblagichKorsatilsin: fields.checkbox({
          label: 'Yozuvlarda "necha marta oʻqildi" koʻrsatilsin',
          defaultValue: true
        }),
        hisoblagichMinimum: fields.integer({
          label: "Eng kam son",
          description: "Shu sondan kam oʻqilgan yozuvlarda hisoblagich koʻrsatilmaydi. 0 boʻlsa — hammasida koʻrinadi.",
          defaultValue: 0,
          validation: { min: 0 }
        })
      }
    })
  }
});

const all = makeHandler({ config });
const ALL = all;

const prerender = false;

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  ALL,
  all,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
