const PublicKeyPEM = `
-----BEGIN PUBLIC KEY-----
MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAErxixU+jZ9XWp7U+yBb3sEsO2FoTZRctc
/B/AD99G5ZdumRkqbz+52LMwHxybM7qXo70asmu4sm88rU39VlZR6g==
-----END PUBLIC KEY-----
`.trim();

async function run() {
  let urlParams = new URLSearchParams(window.location.search);

  let signature = urlParams.get("s");
  let html = urlParams.get("h");
  let markdown = urlParams.get("m");

  if (!html && !markdown) {
    return;
  }

  if (!signature) {
    return embedHtml("Error: Signature missing.");
  }

  let valid = await verify(signature, html || markdown);
  if (!valid) {
    return embedHtml("Error: Signature invalid.");
  }

  if (html) {
    return embedHtml(html);
  }
  if (markdown) {
    return embedMarkdown(markdown);
  }
}

function verify(signature, content) {
  console.log(content);
  console.log(signature);
  let sig = new KJUR.crypto.Signature({alg: "SHA512withECDSA"});
  sig.init(PublicKeyPEM);
  sig.updateString(content);
  return sig.verify(base64ToHex(signature));
}

function base64ToHex(str) {
  const raw = atob(str);
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    const hex = raw.charCodeAt(i).toString(16);
    result += (hex.length === 2 ? hex : '0' + hex);
  }
  return result.toUpperCase();
}

async function embedMarkdown(markdown) {
  let converter = new showdown.Converter({
    strikethrough: true,
    tables: true,
    tasklists: true,
    disableForced4SpacesIndentedSublists: true,
  });
  let html = converter.makeHtml(markdown);
  embedHtml(html);
}

async function embedHtml(html) {
  document.querySelector("#preview").srcdoc = html;
}
