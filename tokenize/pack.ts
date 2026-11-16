import * as sdk from "@superhuman/plugins-sdk";
import tokenizeWords from "tokenize-words";
import * as sw from "stopword";

const OneDaySecs = 24 * 60 * 60;
const DefaultRemoveStopwords = false;
const DefaultLanguage = "eng";
const Languages = {
  "afr": "Afrikaans",
  "ara": "Arabic, Macrolanguage",
  "hye": "Armenian",
  "eus": "Basque",
  "ben": "Bengali",
  "bre": "Breton",
  "bul": "Bulgarian",
  "cat": "Catalan, Valencian",
  "zho": "Chinese, Macrolanguage",
  "hrv": "Croatian",
  "ces": "Czech",
  "dan": "Danish",
  "nld": "Dutch",
  "eng": "English",
  "epo": "Esperanto",
  "est": "Estonian, Macrolanguage",
  "fin": "Finnish",
  "fra": "French",
  "glg": "Galician",
  "deu": "German",
  "ell": "Greek, Modern",
  "guj": "Gujarati",
  "hau": "Hausa",
  "heb": "Hebrew",
  "hin": "Hindi",
  "hun": "Hungarian",
  "ind": "Indonesian",
  "gle": "Irish",
  "ita": "Italian",
  "jpn": "Japanese",
  "kor": "Korean",
  "kur": "Kurdish, Macrolanguage",
  "lat": "Latin",
  "lav": "Latvian, Macrolanguage",
  "lit": "Lithuanian",
  "lgg": "Lugbara",
  "lggNd": "Lugbara, No diacritics",
  "msa": "Malay, Macrolanguage",
  "mar": "Marathi",
  "mya": "Myanmar (Burmese)",
  "nob": "Norwegian bokmål",
  "fas": "Persian (Farsi)",
  "pol": "Polish",
  "por": "Portuguese",
  "porBr": "Portuguese-Brazilian",
  "panGu": "Punjabi (Panjabi), Gurmukhi script",
  "ron": "Romanian (Moldavian, Moldovan)",
  "rus": "Russian",
  "slk": "Slovak",
  "slv": "Slovenian",
  "som": "Somali",
  "sot": "Sotho, Southern",
  "spa": "Spanish",
  "swa": "Swahili, Macrolanguage",
  "swe": "Swedish",
  "tgl": "Tagalog (Filipino)",
  "tha": "Thai",
  "tur": "Turkish",
  "ukr": "Ukrainian",
  "urd": "Urdu",
  "vie": "Vietnamese",
  "yor": "Yoruba",
  "zul": "Zulu",
};

export const pack = sdk.newPack();

pack.addFormula({
  name: "Words",
  description: "Extracts the individual words from some text.",
  parameters: [
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "text",
      description: "The source text.",
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.Boolean,
      name: "removeStopwords",
      description: `Whether stopwords ('and', 'the', etc.) should be removed. Default: ${DefaultRemoveStopwords}`,
      optional: true,
    }),
    sdk.makeParameter({
      type: sdk.ParameterType.String,
      name: "language",
      description: `The language the text is written in, as a three-letter language code (). Default: ${DefaultLanguage}`,
      optional: true,
      autocomplete: Object.entries(Languages).map(([code, name]) => ({display: name, value: code})),
    }),
  ],
  resultType: sdk.ValueType.Array,
  items: sdk.makeSchema({
    type: sdk.ValueType.String,
  }),
  examples: [
    { 
      params: [`J.J.'s corn-fed cow says "Moo" (supposedly).`], 
      result: ["J.J.'s", "corn-fed", "cow", "says", "Moo", "supposedly"],
    },
    { 
      params: [`She decided to go to the store to buy some milk for the morning.`, true], 
      result: ["She", "decided", "go", "store", "buy", "milk", "morning"],
    },
    { 
      params: [`Decidió ir a la tienda a comprar leche para la mañana.`, true, "spa"], 
      result: ["Decidió", "ir", "tienda", "comprar", "leche", "mañana"],
    },
  ],
  cacheTtlSecs: OneDaySecs,
  execute: async function (args, context) {
    let [text, removeStopwords = DefaultRemoveStopwords, lang = DefaultLanguage] = args;
    if (!Object.keys(Languages).includes(lang)) {
      throw new sdk.UserVisibleError(`Unsupported language: ${lang}`);
    }
    let words = tokenizeWords(text);
    if (removeStopwords) {
      words = sw.removeStopwords(words, sw[lang]);
    }
    return words;
  },
});