// New licensed footage only. See docs/landing-page-youtube-shorts-maker.md.
// node scripts/youtube-shorts-maker/render.mjs /path/to/4540152.mp4 [en|fr|es|it|de|ja]
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const input = process.argv[2];
if (!input) throw new Error("Supply the Pexels 4540152 source video path.");
const locale = process.argv[3] ?? "en";
const captions = {
  en: [["One recording.", "A new perspective."], ["Find a moment", "worth sharing."], ["Keep the idea.", "Make it a Short."], ["Your next Short", "starts here."]],
  fr: [["Une vidéo.", "Un nouveau regard."], ["Un moment", "à partager."], ["Gardez l’idée.", "Créez un Short."], ["Votre prochain Short", "commence ici."]],
  es: [["Una grabación.", "Otra perspectiva."], ["Un momento", "para compartir."], ["Conserva la idea.", "Crea un Short."], ["Tu próximo Short", "empieza aquí."]],
  it: [["Una registrazione.", "Un nuovo sguardo."], ["Un momento", "da condividere."], ["Conserva l’idea.", "Crea uno Short."], ["Il tuo prossimo Short", "inizia qui."]],
  de: [["Eine Aufnahme.", "Ein neuer Blick."], ["Ein Moment", "zum Teilen."], ["Behalte die Idee.", "Mach einen Short."], ["Dein nächster Short", "beginnt hier."]],
  ja: [["ひとつの動画を、", "新しい見せ方で。"], ["届けたい場面を", "見つけよう。"], ["伝えたいことを、", "ショートに。"], ["次のショートは", "ここから。"]],
};
if (!captions[locale]) throw new Error(`Unsupported locale: ${locale}`);
const name = locale === "en" ? "short-studio" : `short-studio-${locale}`;
const fontFamily = locale === "ja" ? "Hiragino Sans" : "Arial";
const out = "public/media/youtube-shorts-maker";
const work = ".artifacts/shorts-maker";
await mkdir(out, { recursive: true });
await mkdir(work, { recursive: true });
const run = args => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
if (locale === "en") run(["-ss", "2", "-i", input, "-t", "12", "-vf", "scale=960:540,fps=24", "-an", "-c:v", "libx264", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${out}/source-studio.mp4`]);
const lines = captions[locale];
for (const [i, words] of lines.entries()) {
  const svg = `<svg width="540" height="960" xmlns="http://www.w3.org/2000/svg"><rect x="32" y="676" width="476" height="118" rx="12" fill="#181126" fill-opacity="0.9"/><text x="270" y="722" text-anchor="middle" fill="white" font-family="${fontFamily}" font-weight="700" font-size="33">${words[0]}</text><text x="270" y="766" text-anchor="middle" fill="#FFE56A" font-family="${fontFamily}" font-weight="700" font-size="33">${words[1]}</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${work}/caption-${locale}-${i}.png`);
}
const inputs = lines.flatMap((_, i) => ["-i", `${work}/caption-${locale}-${i}.png`]);
const filters = ["[0:v]crop=608:1080:580:0,scale=540:960,fps=24[v0]", ...lines.map((_, i) => `[v${i}][${i + 1}:v]overlay=0:0:enable='gte(t,${i * 3})*lt(t,${(i + 1) * 3})'[v${i + 1}]`)];
run(["-ss", "2", "-i", input, ...inputs, "-t", "12", "-filter_complex", filters.join(";"), "-map", "[v4]", "-an", "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${out}/${name}.mp4`]);
for (const asset of locale === "en" ? ["source-studio", "short-studio"] : [name]) run(["-ss", "1", "-i", `${out}/${asset}.mp4`, "-frames:v", "1", "-q:v", "3", `${out}/${asset}.jpg`]);
