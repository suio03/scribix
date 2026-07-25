import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = path.join(projectRoot, "messages");
const referenceLocale = "en.json";

const forbiddenStructuralKeys = new Set([
  "href",
  "icon",
  "id",
  "key",
  "n",
  "price",
  "secondaryHref",
  "span",
]);

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value === "object" ? "object" : typeof value;
}

function compareObjectShape(reference, candidate, currentPath, locale, errors) {
  const referenceType = valueType(reference);
  const candidateType = valueType(candidate);

  if (referenceType !== candidateType) {
    errors.push(
      `${locale}: ${currentPath || "<root>"} must be ${referenceType}, received ${candidateType}`
    );
    return;
  }

  if (referenceType === "string") {
    const referenceArguments = messageArguments(reference);
    const candidateArguments = messageArguments(candidate);
    if (referenceArguments.join(",") !== candidateArguments.join(",")) {
      errors.push(
        `${locale}: ${currentPath} uses ${formatArguments(candidateArguments)}; expected ${formatArguments(referenceArguments)}`
      );
    }
    return;
  }

  if (referenceType === "array") {
    if (reference.length !== candidate.length) {
      errors.push(
        `${locale}: ${currentPath} has ${candidate.length} items; expected ${reference.length}`
      );
    }
    const sharedLength = Math.min(reference.length, candidate.length);
    for (let index = 0; index < sharedLength; index += 1) {
      compareObjectShape(
        reference[index],
        candidate[index],
        `${currentPath}[${index}]`,
        locale,
        errors
      );
    }
    return;
  }

  if (referenceType !== "object") return;

  const referenceKeys = Object.keys(reference);
  const candidateKeys = new Set(Object.keys(candidate));

  for (const key of referenceKeys) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    if (!candidateKeys.delete(key)) {
      errors.push(`${locale}: missing ${childPath}`);
      continue;
    }
    compareObjectShape(reference[key], candidate[key], childPath, locale, errors);
  }

  for (const key of candidateKeys) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    errors.push(`${locale}: unexpected ${childPath}`);
  }
}

function messageArguments(message) {
  return [
    ...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\s*(?:,|\})/g),
  ]
    .map((match) => match[1])
    .filter((argument, index, argumentsList) =>
      argumentsList.indexOf(argument) === index
    )
    .sort();
}

function formatArguments(argumentsList) {
  return argumentsList.length > 0
    ? `{${argumentsList.join("}, {")}}`
    : "no arguments";
}

function checkForbiddenStructuralKeys(value, currentPath, locale, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      checkForbiddenStructuralKeys(
        item,
        `${currentPath}[${index}]`,
        locale,
        errors
      )
    );
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    if (forbiddenStructuralKeys.has(key)) {
      errors.push(`${locale}: structural field ${childPath} belongs in TypeScript`);
    }
    checkForbiddenStructuralKeys(child, childPath, locale, errors);
  }
}

const localeFiles = (await readdir(messagesDir))
  .filter((file) => file.endsWith(".json"))
  .sort();

if (!localeFiles.includes(referenceLocale)) {
  throw new Error(`Missing reference locale: messages/${referenceLocale}`);
}

const messagesByLocale = new Map(
  await Promise.all(
    localeFiles.map(async (file) => {
      const source = await readFile(path.join(messagesDir, file), "utf8");
      return [file, JSON.parse(source)];
    })
  )
);

const referenceMessages = messagesByLocale.get(referenceLocale);
const errors = [];

for (const [locale, messages] of messagesByLocale) {
  checkForbiddenStructuralKeys(messages, "", locale, errors);
  if (locale === referenceLocale) continue;

  compareObjectShape(referenceMessages, messages, "", locale, errors);
}

if (errors.length > 0) {
  console.error("Locale validation failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Locale validation passed for ${localeFiles.length} files (keys, types, array lengths, and ICU arguments).`
  );
}
